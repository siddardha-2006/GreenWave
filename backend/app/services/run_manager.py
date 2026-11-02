"""
run_manager.py
Background Orchestration Service for GREEN-WAVE.
Manages isolated simulation threads, coordinates the decision pipeline:
  Predictor -> QUBO/QAOA Optimizer -> Safety Controller -> Simulator,
persists metrics, and streams live telemetry over WebSockets.
"""

import asyncio
import logging
import threading
import time
from typing import Dict, List, Optional, Set
import numpy as np
from fastapi import WebSocket

from ..core.config import settings
from ..db.repository import repo
from ..optimization import (
    MovementRegistry,
    calculate_weights,
    create_default_conflict_graph,
    QUBOFormulation,
    ExactMWISSolver,
    GreedyMWISSolver,
    SimulatedAnnealingSolver,
    QAOASolver,
)
from ..prediction.baseline_predictor import BaselinePredictor
from ..safety.controller import SafetyController
from ..safety.phase_model import PhaseTimingConfig
from ..simulation.scenarios import AVAILABLE_SCENARIOS, ScenarioConfig
from ..simulation.simulator import IntersectionSimulator

logger = logging.getLogger("greenwave.run_manager")


class ActiveRun:
    """Encapsulates a running simulation job."""
    def __init__(self, exp_id: str, exp_data: dict):
        self.exp_id = exp_id
        self.exp_data = exp_data
        self.stop_requested = threading.Event()
        self.thread: Optional[threading.Thread] = None
        self.subscribers: List[Tuple[WebSocket, asyncio.AbstractEventLoop]] = []
        self.lock = threading.Lock()

        # Shared component references for interactive event injection
        self.safety_controller: Optional[SafetyController] = None
        self.simulator: Optional[IntersectionSimulator] = None


class RunManager:
    """Manages active simulation jobs and WebSocket subscribers."""

    def __init__(self):
        self.active_runs: Dict[str, ActiveRun] = {}
        self.lock = threading.Lock()

    def start_run(self, exp_id: str) -> None:
        with self.lock:
            if exp_id in self.active_runs and self.active_runs[exp_id].thread and self.active_runs[exp_id].thread.is_alive():
                logger.warning("Experiment %s is already running.", exp_id)
                return

            exp_data = repo.get_experiment(exp_id)
            if not exp_data:
                raise ValueError(f"Experiment {exp_id} not found.")

            run = ActiveRun(exp_id, exp_data)
            self.active_runs[exp_id] = run

            t = threading.Thread(target=self._run_simulation_loop, args=(run,), daemon=True)
            run.thread = t
            t.start()
            logger.info("Launched background simulation thread for experiment %s.", exp_id)

    def stop_run(self, exp_id: str) -> None:
        with self.lock:
            if exp_id in self.active_runs:
                self.active_runs[exp_id].stop_requested.set()
                logger.info("Graceful stop requested for experiment %s.", exp_id)

    def inject_pedestrian(self, exp_id: str, approach: str = "North") -> bool:
        with self.lock:
            run = self.active_runs.get(exp_id)
            if run and run.safety_controller and run.simulator:
                run.safety_controller.request_pedestrian_crossing(approach)
                run.simulator.pedestrian_request_time = run.simulator.current_time
                logger.info("Injected pedestrian crossing request for %s on experiment %s.", approach, exp_id)
                return True
            return False

    def inject_emergency(self, exp_id: str, movement_id: str = "M0") -> bool:
        with self.lock:
            run = self.active_runs.get(exp_id)
            if run and run.safety_controller and run.simulator:
                run.safety_controller.request_emergency_preemption(movement_id)
                logger.info("Injected emergency vehicle %s on experiment %s.", movement_id, exp_id)
                return True
            return False

    def register_websocket(self, exp_id: str, ws: WebSocket, loop: asyncio.AbstractEventLoop) -> None:
        with self.lock:
            if exp_id not in self.active_runs:
                exp_data = repo.get_experiment(exp_id) or {"id": exp_id}
                self.active_runs[exp_id] = ActiveRun(exp_id, exp_data)
            self.active_runs[exp_id].subscribers.append((ws, loop))

    def unregister_websocket(self, exp_id: str, ws: WebSocket) -> None:
        with self.lock:
            if exp_id in self.active_runs:
                self.active_runs[exp_id].subscribers = [
                    (w, l) for (w, l) in self.active_runs[exp_id].subscribers if w != ws
                ]

    def _broadcast(self, run: ActiveRun, data: dict) -> None:
        """Sends live message to connected WebSockets via threadsafe loop dispatch."""
        dead_subs = []
        for ws, loop in list(run.subscribers):
            try:
                if loop.is_running():
                    asyncio.run_coroutine_threadsafe(ws.send_json(data), loop)
                else:
                    dead_subs.append((ws, loop))
            except Exception:
                dead_subs.append((ws, loop))
        for dead in dead_subs:
            if dead in run.subscribers:
                run.subscribers.remove(dead)

    def _run_simulation_loop(self, run: ActiveRun) -> None:
        exp_id = run.exp_id
        exp_data = run.exp_data

        scenario_id = exp_data.get("scenario_id", "balanced_peak")
        scenario = AVAILABLE_SCENARIOS.get(scenario_id, AVAILABLE_SCENARIOS["balanced_peak"])
        seed = int(exp_data.get("seed", 42))
        controller_name = exp_data.get("controller", "qaoa").lower()
        qaoa_cfg = exp_data.get("qaoa") or {"p": 1, "shots": 2048, "optimizer": "COBYLA"}

        registry = MovementRegistry()
        conflict_graph = create_default_conflict_graph()
        simulator = IntersectionSimulator(scenario, registry, seed=seed)
        predictor = BaselinePredictor()
        safety_controller = SafetyController(conflict_graph, registry)

        run.simulator = simulator
        run.safety_controller = safety_controller

        repo.update_experiment_status(exp_id, "running")
        logger.info("Experiment %s started simulation with controller %s on scenario %s.", exp_id, controller_name, scenario_id)

        dt = settings.SIMULATION_STEP_LENGTH
        decision_interval = settings.DECISION_INTERVAL_SECONDS
        last_decision_time = -decision_interval

        candidate_movements: Optional[Set[int]] = None
        weights = np.ones(12, dtype=float)

        try:
            while not run.stop_requested.is_set() and simulator.current_time < scenario.duration_seconds:
                sim_t = simulator.current_time

                # 1. Update queue observations in baseline predictor
                current_state = simulator.get_traffic_state()
                predictor.update(sim_t, current_state.queue_lengths)

                # 2. Decision Pipeline: Execute Optimizer at periodic intervals
                if (sim_t - last_decision_time) >= decision_interval:
                    last_decision_time = sim_t
                    predicted_queues = predictor.predict(30.0)
                    current_state.predicted_queues = predicted_queues

                    # Compute priority weights w_i = alpha*Q + beta*Q_pred + gamma*W
                    weights = calculate_weights(current_state, registry, alpha=1.0, beta=0.5, gamma=0.3)
                    qubo = QUBOFormulation(weights, conflict_graph)

                    # Always compute exact optimum for ground-truth benchmark and approximation ratio audit
                    exact_sol = ExactMWISSolver(qubo, conflict_graph).solve()
                    exact_optimum_reward = exact_sol.optimal_reward

                    # Solve using configured controller
                    if controller_name == "exact":
                        sol = exact_sol
                        candidate_movements = set(sol.active_movements)
                        solver_record = {
                            "experiment_id": exp_id,
                            "simulation_time": sim_t,
                            "solver": "exact",
                            "objective_reward": sol.optimal_reward,
                            "qubo_energy": sol.qubo_energy,
                            "bitstring": "".join(str(b) for b in sol.bitstring),
                            "active_movements": [registry.get_by_index(i).id for i in sol.active_movements],
                            "feasible": sol.is_feasible,
                            "valid_sample_rate": 1.0,
                            "runtime_ms": sol.runtime_ms,
                            "fallback_used": False,
                            "approximation_ratio": 1.0,
                        }
                    elif controller_name == "greedy":
                        sol = GreedyMWISSolver(qubo, conflict_graph).solve()
                        candidate_movements = set(sol.active_movements)
                        approx_ratio = round(sol.reward / exact_optimum_reward, 4) if exact_optimum_reward > 0 else 1.0
                        solver_record = {
                            "experiment_id": exp_id,
                            "simulation_time": sim_t,
                            "solver": "greedy",
                            "objective_reward": sol.reward,
                            "qubo_energy": sol.qubo_energy,
                            "bitstring": "".join(str(b) for b in sol.bitstring),
                            "active_movements": [registry.get_by_index(i).id for i in sol.active_movements],
                            "feasible": sol.is_feasible,
                            "valid_sample_rate": 1.0,
                            "runtime_ms": sol.runtime_ms,
                            "fallback_used": False,
                            "approximation_ratio": approx_ratio,
                        }
                    elif controller_name == "simulated_annealing":
                        sol = SimulatedAnnealingSolver(qubo, conflict_graph, seed=seed).solve()
                        candidate_movements = set(sol.active_movements)
                        approx_ratio = round(sol.reward / exact_optimum_reward, 4) if exact_optimum_reward > 0 else 1.0
                        solver_record = {
                            "experiment_id": exp_id,
                            "simulation_time": sim_t,
                            "solver": "simulated_annealing",
                            "objective_reward": sol.reward,
                            "qubo_energy": sol.qubo_energy,
                            "bitstring": "".join(str(b) for b in sol.bitstring),
                            "active_movements": [registry.get_by_index(i).id for i in sol.active_movements],
                            "feasible": sol.is_feasible,
                            "valid_sample_rate": 1.0,
                            "runtime_ms": sol.runtime_ms,
                            "fallback_used": sol.fallback_used,
                            "approximation_ratio": approx_ratio,
                        }
                    else:  # QAOA (Default)
                        p_val = int(qaoa_cfg.get("p", 1))
                        shots_val = int(qaoa_cfg.get("shots", 2048))
                        qaoa_solver = QAOASolver(qubo, conflict_graph, p=p_val, shots=shots_val, seed=seed)
                        qaoa_res = qaoa_solver.solve(exact_optimum_reward=exact_optimum_reward)
                        candidate_movements = set(qaoa_res.active_movements)
                        approx_ratio = qaoa_res.approximation_ratio
                        if approx_ratio is None or np.isnan(approx_ratio):
                            approx_ratio = round(qaoa_res.objective_reward / exact_optimum_reward, 4) if exact_optimum_reward > 0 else 1.0
                        solver_record = {
                            "experiment_id": exp_id,
                            "simulation_time": sim_t,
                            "solver": f"qaoa-p{p_val}",
                            "objective_reward": qaoa_res.objective_reward,
                            "qubo_energy": qaoa_res.qubo_energy,
                            "bitstring": "".join(str(b) for b in qaoa_res.bitstring),
                            "active_movements": [registry.get_by_index(i).id for i in qaoa_res.active_movements],
                            "feasible": qaoa_res.feasible,
                            "valid_sample_rate": qaoa_res.valid_sample_rate,
                            "runtime_ms": qaoa_res.runtime_ms,
                            "fallback_used": qaoa_res.fallback_used,
                            "approximation_ratio": approx_ratio,
                        }

                    repo.save_solver_result(solver_record)

                # 3. Step Safety Controller
                safety_state = safety_controller.step(candidate_movements, weights, dt=dt)
                signal_colors = safety_controller.get_signal_colors()

                # 4. Step Simulator with safe signals
                active_movement_ids = [registry.get_by_index(i).id for i in safety_state.active_movements]
                simulator.step(
                    signal_colors=signal_colors,
                    pedestrian_state=safety_state.pedestrian_state,
                    emergency_state=safety_state.emergency_state,
                    dt=dt,
                )

                # 5. Snapshot & Persist Metrics
                metrics_snap = simulator.get_metrics_snapshot(
                    signal_colors=signal_colors,
                    active_movements=active_movement_ids,
                    pedestrian_state=safety_state.pedestrian_state,
                    emergency_state=safety_state.emergency_state,
                )

                emer_mv_str = registry.get_by_index(safety_state.emergency_movement).id if safety_state.emergency_movement is not None else None
                metric_doc = {
                    "experiment_id": exp_id,
                    "simulation_time": metrics_snap.simulation_time,
                    "queue_lengths": metrics_snap.queue_lengths,
                    "mean_waiting_time": metrics_snap.mean_waiting_time,
                    "max_waiting_time": metrics_snap.max_waiting_time,
                    "throughput": metrics_snap.throughput,
                    "active_movements": metrics_snap.active_movements,
                    "signal_colors": metrics_snap.signal_colors,
                    "pedestrian_state": metrics_snap.pedestrian_state,
                    "emergency_state": metrics_snap.emergency_state,
                    "emergency_movement": emer_mv_str,
                    "emergency_approach": safety_state.emergency_target_approach,
                    "pedestrian_wait_time": metrics_snap.pedestrian_wait_time,
                    "emergency_delay": metrics_snap.emergency_delay,
                }
                repo.save_metric(metric_doc)
                repo.update_experiment_status(exp_id, "running", simulation_time=sim_t)

                # 6. Broadcast over WebSocket
                telemetry_payload = {
                    "type": "telemetry",
                    "experiment_id": exp_id,
                    "metrics": metric_doc,
                    "safety": {
                        "phase_type": safety_state.current_phase_type.value,
                        "time_in_phase": round(safety_state.time_in_phase, 1),
                        "fallback_engaged": safety_state.fallback_engaged,
                        "rejection_reason": safety_state.rejection_reason,
                    },
                    "emergency": {
                        "state": safety_state.emergency_state.value,
                        "movement": emer_mv_str,
                        "approach": safety_state.emergency_target_approach,
                    },
                }
                self._broadcast(run, telemetry_payload)

                # Sleep to emulate real-time or paced simulation
                time.sleep(0.08)

            final_status = "cancelled" if run.stop_requested.is_set() else "completed"
            repo.update_experiment_status(exp_id, final_status, completed=True)
            self._broadcast(run, {"type": "status", "status": final_status})
            logger.info("Experiment %s concluded with status '%s'.", exp_id, final_status)

        except Exception as ex:
            logger.exception("Simulation loop crashed for %s: %s", exp_id, ex)
            repo.update_experiment_status(exp_id, "failed", completed=True)
            self._broadcast(run, {"type": "status", "status": "failed", "error": str(ex)})


run_manager = RunManager()

