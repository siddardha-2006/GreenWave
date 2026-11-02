"""
routes.py
FastAPI REST API routes and WebSocket endpoints for GREEN-WAVE.
Implements the contract defined in README Section 14.
"""

from typing import Any, Dict, List, Optional
import time
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import qiskit.qasm2
import numpy as np
from qiskit_aer import AerSimulator

from ..core.config import settings
from ..db.repository import repo
from ..schemas import (
    ExperimentCreateSchema,
    ExperimentResponseSchema,
    ScenarioInfoSchema,
    SimulationMetricsSchema,
    SolverResultSchema,
)
from ..services.run_manager import run_manager
from ..simulation.scenarios import AVAILABLE_SCENARIOS
from ..optimization.conflict_graph import create_default_conflict_graph
from ..optimization.qubo import QUBOFormulation
from ..optimization.ising import IsingHamiltonian
from ..optimization.qaoa_circuit import QAOAQuantumCircuit, decode_bitstring
from ..optimization.movement_model import MovementRegistry, TrafficState, calculate_weights
from ..optimization.feasibility import FeasibilityValidator
from ..optimization.exact_solver import ExactMWISSolver

api_router = APIRouter()


@api_router.get("/health")
def health_check():
    """Health check endpoint validating API and database connectivity."""
    db_ok = repo.is_healthy()
    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "app_env": settings.APP_ENV,
    }


@api_router.get("/api/scenarios", response_model=List[ScenarioInfoSchema])
def list_scenarios():
    """Lists all available traffic scenarios."""
    return [
        ScenarioInfoSchema(
            id=s.id,
            name=s.name,
            description=s.description,
            duration_seconds=s.duration_seconds,
        )
        for s in AVAILABLE_SCENARIOS.values()
    ]


@api_router.post("/api/experiments", response_model=ExperimentResponseSchema)
def create_experiment(exp_in: ExperimentCreateSchema):
    """Creates a new simulation experiment."""
    doc = repo.create_experiment(exp_in.model_dump())
    return ExperimentResponseSchema(**doc)


@api_router.get("/api/experiments", response_model=List[ExperimentResponseSchema])
def list_experiments(limit: int = 50):
    """Lists recent experiments with pagination/limit."""
    docs = repo.list_experiments(limit=limit)
    return [ExperimentResponseSchema(**d) for d in docs]


@api_router.get("/api/experiments/{exp_id}", response_model=ExperimentResponseSchema)
def get_experiment(exp_id: str):
    """Fetches details for a single experiment."""
    doc = repo.get_experiment(exp_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    return ExperimentResponseSchema(**doc)


@api_router.post("/api/experiments/{exp_id}/start")
def start_experiment(exp_id: str):
    """Starts the simulation loop for an experiment in the background."""
    doc = repo.get_experiment(exp_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Experiment not found.")
    try:
        run_manager.start_run(exp_id)
        return {"status": "started", "experiment_id": exp_id}
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))


@api_router.post("/api/experiments/{exp_id}/stop")
def stop_experiment(exp_id: str):
    """Requests graceful termination of a running experiment."""
    run_manager.stop_run(exp_id)
    return {"status": "stopping", "experiment_id": exp_id}


@api_router.post("/api/experiments/{exp_id}/inject_pedestrian")
def inject_pedestrian(exp_id: str, approach: str = "North"):
    """Interactively triggers a pedestrian crossing call on the active intersection."""
    ok = run_manager.inject_pedestrian(exp_id, approach=approach)
    if not ok:
        raise HTTPException(status_code=400, detail="Experiment is not currently active.")
    return {"status": "injected", "type": "pedestrian", "approach": approach}


@api_router.post("/api/experiments/{exp_id}/inject_emergency")
def inject_emergency(exp_id: str, movement: str = "M0"):
    """Interactively injects an emergency vehicle requiring safe preemption."""
    ok = run_manager.inject_emergency(exp_id, movement_id=movement)
    if not ok:
        raise HTTPException(status_code=400, detail="Experiment is not currently active.")
    return {"status": "injected", "type": "emergency", "movement": movement}


@api_router.get("/api/experiments/{exp_id}/metrics", response_model=List[SimulationMetricsSchema])
def get_metrics(exp_id: str, limit: int = 500):
    """Fetches time-series telemetry metrics for an experiment."""
    docs = repo.get_metrics(exp_id, limit=limit)
    return [SimulationMetricsSchema(**d) for d in docs]


@api_router.get("/api/experiments/{exp_id}/latest")
def get_latest_state(exp_id: str):
    """Fetches the most recent metrics and safety state snapshot for polling fallback."""
    docs = repo.get_metrics(exp_id, limit=1)
    exp = repo.get_experiment(exp_id)
    if not exp:
        raise HTTPException(status_code=404, detail="Experiment not found.")

    latest_metric = docs[-1] if docs else None
    return {
        "experiment": exp,
        "latest_metrics": latest_metric,
    }


@api_router.get("/api/experiments/{exp_id}/solvers", response_model=List[SolverResultSchema])
def get_solver_results(exp_id: str):
    """Fetches optimization solver performance results for an experiment."""
    docs = repo.get_solver_results(exp_id)
    return [SolverResultSchema(**d) for d in docs]


@api_router.get("/api/config")
def get_config():
    """Returns validated application and simulation configuration."""
    return {
        "app_env": settings.APP_ENV,
        "step_length": settings.SIMULATION_STEP_LENGTH,
        "decision_interval": settings.DECISION_INTERVAL_SECONDS,
        "default_qaoa_p": settings.DEFAULT_QAOA_P,
        "default_qaoa_shots": settings.DEFAULT_QAOA_SHOTS,
    }


@api_router.websocket("/ws/experiments/{exp_id}")
async def websocket_telemetry(websocket: WebSocket, exp_id: str):
    """Streams live simulation updates (read-only telemetry) to connected clients."""
    await websocket.accept()
    loop = asyncio.get_running_loop()
    run_manager.register_websocket(exp_id, websocket, loop)
    try:
        while True:
            # Keep socket open and listen for ping/client messages
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        run_manager.unregister_websocket(exp_id, websocket)
    except Exception:
        run_manager.unregister_websocket(exp_id, websocket)


# =========================================================================
# QUANTUM CIRCUIT VISUALIZATION & SIMULATION ENDPOINTS
# =========================================================================

class QuantumSimulateRequest(BaseModel):
    p: int = Field(default=1, ge=1, le=3)
    gammas: List[float] = [0.5]
    betas: List[float] = [0.3]
    shots: int = Field(default=1024, ge=128, le=4096)
    scenario_id: Optional[str] = "balanced_peak"
    experiment_id: Optional[str] = None
    custom_weights: Optional[Dict[str, float]] = None


@api_router.get("/api/quantum/circuit")
def get_quantum_circuit_info(
    p: int = 1,
    gamma: Optional[float] = None,
    beta: Optional[float] = None,
    scenario_id: Optional[str] = "balanced_peak",
    experiment_id: Optional[str] = None,
):
    """Generates complete QAOA quantum circuit architecture, gate metrics, QASM, and ASCII diagrams."""
    p_clamped = max(1, min(p, 3))
    registry = MovementRegistry()
    conflict_graph = create_default_conflict_graph()

    # Determine traffic state & priority weights
    weights = np.ones(12, dtype=float) * 5.0
    if experiment_id:
        metrics_docs = repo.get_metrics(experiment_id, limit=1)
        if metrics_docs:
            q_map = metrics_docs[0].get("queue_lengths", {})
            st = TrafficState(queue_lengths=q_map)
            weights = calculate_weights(st, registry)
    elif scenario_id and scenario_id in AVAILABLE_SCENARIOS:
        sc = AVAILABLE_SCENARIOS[scenario_id]
        q_map = {m_id: rate * 30.0 for m_id, rate in sc.arrival_rates.items()}
        st = TrafficState(queue_lengths=q_map)
        weights = calculate_weights(st, registry)

    qubo = QUBOFormulation(weights, conflict_graph)
    ising = IsingHamiltonian(qubo)
    qaoa = QAOAQuantumCircuit(ising, p=p_clamped)

    # Parameterized and bound circuit variants
    qc_param, _, _ = qaoa.build_parameterized_circuit(measure=True)
    g_val = gamma if gamma is not None else 0.5
    b_val = beta if beta is not None else 0.3
    qc_bound = qaoa.build_bound_circuit([g_val] * p_clamped, [b_val] * p_clamped, measure=True)

    ascii_diagram = str(qc_param.draw(output="text"))
    qasm_code = qiskit.qasm2.dumps(qc_bound)

    exact_solver = ExactMWISSolver(qubo, conflict_graph)
    exact_res = exact_solver.solve()

    # Qubit metadata table (12 qubits mapped to 12 intersection movements)
    qubits_meta = []
    for i in range(12):
        m = registry.get_by_index(i)
        qubits_meta.append({
            "qubit_index": i,
            "movement_id": m.id,
            "movement_name": m.name,
            "approach": m.approach,
            "exit": m.exit_direction,
            "movement_type": m.movement_type,
            "description": m.description,
            "weight": round(float(weights[i]), 2),
            "degree": int(conflict_graph.degree(i)),
            "h_coeff": round(float(ising.h_coeffs[i]), 3),
            "conflicts": [registry.get_by_index(c).id for c in sorted(list(conflict_graph.conflicts_with(i)))],
        })

    # Conflict couplings (28 edges of G=(V,E))
    conflict_edges = []
    for u, v in conflict_graph.get_edges():
        m_u = registry.get_by_index(u)
        m_v = registry.get_by_index(v)
        conflict_edges.append({
            "u": u,
            "v": v,
            "movement_u": m_u.id,
            "movement_v": m_v.id,
            "name_u": m_u.name,
            "name_v": m_v.name,
            "J_coeff": round(float(ising.J_coeffs[(u, v)]), 3),
        })

    # Logical circuit layer decomposition
    layers = [
        {
            "name": "State Preparation Layer",
            "type": "hadamard",
            "description": "Uniform superposition across all 2^12 = 4096 states via H^{\\otimes 12}",
            "gates_count": 12,
            "qubits": list(range(12)),
        }
    ]

    for layer_idx in range(p_clamped):
        layers.append({
            "name": f"Layer {layer_idx + 1}: Cost Unitary U_C(gamma_{layer_idx + 1}) — Local Fields",
            "type": "rz_local",
            "description": f"Phase rotation R_Z(2 \\cdot \\gamma_{layer_idx + 1} \\cdot h_i) encoding movement priority weights and conflict degrees",
            "gates_count": 12,
            "gamma_index": layer_idx,
        })
        layers.append({
            "name": f"Layer {layer_idx + 1}: Cost Unitary U_C(gamma_{layer_idx + 1}) — Conflict Interactions",
            "type": "zz_couplings",
            "description": f"28 Two-qubit ZZ interaction gates (CX -> R_Z(2 \\cdot \\gamma_{layer_idx + 1} \\cdot J_{{ij}}) -> CX) penalizing incompatible movements",
            "gates_count": 28 * 3,
            "gamma_index": layer_idx,
            "edges_count": 28,
        })
        layers.append({
            "name": f"Layer {layer_idx + 1}: Mixer Unitary U_M(beta_{layer_idx + 1})",
            "type": "rx_mixer",
            "description": f"Transverse field driver R_X(2 \\cdot \\beta_{layer_idx + 1}) enabling quantum tunneling between orthogonal bitstrings",
            "gates_count": 12,
            "beta_index": layer_idx,
        })

    layers.append({
        "name": "Measurement Layer",
        "type": "measurement",
        "description": "Z-basis projection mapping 12 quantum states into classical bitstring register c[0..11]",
        "gates_count": 12,
    })

    return {
        "p": p_clamped,
        "num_qubits": 12,
        "num_clbits": 12,
        "depth": int(qc_param.depth()),
        "total_gates": int(sum(qc_param.count_ops().values())),
        "gate_counts": dict(qc_param.count_ops()),
        "penalty_p": round(float(ising.penalty_p), 2),
        "constant_offset": round(float(ising.constant_offset), 2),
        "qubits": qubits_meta,
        "conflict_edges": conflict_edges,
        "layers": layers,
        "ascii_diagram": ascii_diagram,
        "qasm": qasm_code,
        "exact_optimum": {
            "active_movements": [registry.get_by_index(i).id for i in exact_res.active_movements],
            "reward": round(float(exact_res.optimal_reward), 2),
            "qubo_energy": round(float(exact_res.qubo_energy), 2),
            "bitstring": "".join(str(b) for b in exact_res.bitstring),
            "runtime_ms": round(float(exact_res.runtime_ms), 2),
        },
    }


@api_router.post("/api/quantum/simulate")
def simulate_quantum_circuit(req: QuantumSimulateRequest):
    """Executes QAOA circuit on Qiskit AerSimulator and returns sampled measurement distributions."""
    p_clamped = max(1, min(req.p, 3))
    shots = max(128, min(req.shots, 4096))
    gammas = req.gammas[:p_clamped] if len(req.gammas) >= p_clamped else req.gammas + [0.5] * (p_clamped - len(req.gammas))
    betas = req.betas[:p_clamped] if len(req.betas) >= p_clamped else req.betas + [0.3] * (p_clamped - len(req.betas))

    registry = MovementRegistry()
    conflict_graph = create_default_conflict_graph()

    # Determine traffic state & priority weights
    if req.custom_weights:
        weights = np.zeros(12, dtype=float)
        for i in range(12):
            m_id = registry.get_by_index(i).id
            weights[i] = float(req.custom_weights.get(m_id, 2.0))
    elif req.experiment_id:
        metrics_docs = repo.get_metrics(req.experiment_id, limit=1)
        if metrics_docs:
            q_map = metrics_docs[0].get("queue_lengths", {})
            st = TrafficState(queue_lengths=q_map)
            weights = calculate_weights(st, registry)
        else:
            weights = np.ones(12, dtype=float) * 5.0
    elif req.scenario_id and req.scenario_id in AVAILABLE_SCENARIOS:
        sc = AVAILABLE_SCENARIOS[req.scenario_id]
        q_map = {m_id: rate * 30.0 for m_id, rate in sc.arrival_rates.items()}
        st = TrafficState(queue_lengths=q_map)
        weights = calculate_weights(st, registry)
    else:
        weights = np.ones(12, dtype=float) * 5.0

    qubo = QUBOFormulation(weights, conflict_graph)
    ising = IsingHamiltonian(qubo)
    qaoa = QAOAQuantumCircuit(ising, p=p_clamped)
    qc = qaoa.build_bound_circuit(gammas, betas, measure=True)

    sim = AerSimulator()
    start_t = time.perf_counter()
    job_result = sim.run(qc, shots=shots).result()
    runtime_ms = round((time.perf_counter() - start_t) * 1000.0, 2)
    counts = job_result.get_counts()

    validator = FeasibilityValidator(conflict_graph)
    exact_solver = ExactMWISSolver(qubo, conflict_graph)
    exact_res = exact_solver.solve()

    samples = []
    feasible_count = 0
    best_feasible_sample = None
    best_feasible_reward = -1.0

    sorted_counts = sorted(counts.items(), key=lambda x: -x[1])
    for raw_str, cnt in sorted_counts:
        bits = decode_bitstring(raw_str, 12)
        is_feasible = validator.is_feasible(bits)
        violations = validator.find_violations(bits)
        reward = qubo.evaluate_reward(bits)
        energy = qubo.evaluate_energy(bits)
        active_ids = [registry.get_by_index(i).id for i, b in enumerate(bits) if b == 1]

        if is_feasible:
            feasible_count += cnt
            if reward > best_feasible_reward:
                best_feasible_reward = reward
                best_feasible_sample = {
                    "bitstring": "".join(str(b) for b in bits),
                    "active_movements": active_ids,
                    "reward": round(reward, 2),
                    "qubo_energy": round(energy, 2),
                    "count": cnt,
                    "probability": round(cnt / shots, 4),
                }

        samples.append({
            "bitstring": "".join(str(b) for b in bits),
            "raw_qiskit": raw_str,
            "active_movements": active_ids,
            "count": cnt,
            "probability": round(cnt / shots, 4),
            "feasible": is_feasible,
            "violations": [(registry.get_by_index(u).id, registry.get_by_index(v).id) for u, v in violations],
            "reward": round(reward, 2),
            "qubo_energy": round(energy, 2),
        })

    valid_rate = round(feasible_count / shots, 4)
    approx_ratio = round(best_feasible_reward / exact_res.optimal_reward, 4) if exact_res.optimal_reward > 0 and best_feasible_reward >= 0 else None

    return {
        "shots": shots,
        "runtime_ms": runtime_ms,
        "feasible_shots": feasible_count,
        "valid_sample_rate": valid_rate,
        "unique_bitstrings": len(counts),
        "best_feasible_sample": best_feasible_sample,
        "exact_optimum_reward": round(float(exact_res.optimal_reward), 2),
        "approximation_ratio": approx_ratio,
        "top_samples": samples[:20],
    }

