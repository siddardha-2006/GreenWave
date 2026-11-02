"""
qaoa_solver.py
Hybrid Quantum-Classical QAOA Solver for GREEN-WAVE using Qiskit Aer.
Implements the hybrid optimization loop:
  1. Parameterized QAOA circuit with depth p.
  2. Classical optimizer (COBYLA) tuning (gamma, beta) to minimize expectation energy.
  3. Final measurement sampling on AerSimulator with shots (default 2048).
  4. Bitstring decoding with Qiskit endianness correction.
  5. Independent feasibility validation and candidate ranking.
  6. Safe classical fallback if no feasible solution is sampled.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
import numpy as np
from scipy.optimize import minimize

from qiskit import QuantumCircuit
from qiskit.quantum_info import Statevector
from qiskit_aer import AerSimulator

from .conflict_graph import ConflictGraph
from .feasibility import FeasibilityValidator
from .ising import IsingHamiltonian
from .qaoa_circuit import QAOAQuantumCircuit, decode_bitstring
from .qubo import QUBOFormulation


@dataclass
class SolverResult:
    """Standard solver output schema as specified in README Section 13."""
    solver: str
    bitstring: np.ndarray
    active_movements: List[int]
    objective_reward: float
    qubo_energy: float
    feasible: bool
    valid_sample_rate: float
    runtime_ms: float
    fallback_used: bool
    optimal_gamma: List[float] = field(default_factory=list)
    optimal_beta: List[float] = field(default_factory=list)
    p: int = 1
    shots: int = 2048
    approximation_ratio: Optional[float] = None
    sampled_counts: Dict[str, int] = field(default_factory=dict)


class QAOASolver:
    """
    Executes QAOA on Qiskit Aer simulator for the traffic movement MWIS problem.
    """

    def __init__(
        self,
        qubo: QUBOFormulation,
        conflict_graph: ConflictGraph,
        p: int = 1,
        shots: int = 2048,
        maxiter: int = 50,
        optimizer_name: str = "COBYLA",
        seed: Optional[int] = 42,
    ):
        self.qubo = qubo
        self.conflict_graph = conflict_graph
        self.ising = IsingHamiltonian(qubo)
        self.validator = FeasibilityValidator(conflict_graph)
        self.num_qubits = conflict_graph.num_nodes
        self.p = p
        self.shots = shots
        self.maxiter = maxiter
        self.optimizer_name = optimizer_name
        self.seed = seed
        self.simulator = AerSimulator(seed_simulator=seed)
        self.circuit_builder = QAOAQuantumCircuit(self.ising, p=p)

    def _statevector_objective(self, params: np.ndarray) -> float:
        """
        Computes the expected energy <psi(params) | H_C | psi(params)> using statevector simulation.
        Exact and differentiable-quality evaluation without finite shot noise.
        """
        gammas = params[:self.p]
        betas = params[self.p:]

        qc = self.circuit_builder.build_bound_circuit(gammas, betas, measure=False)
        sv = Statevector.from_instruction(qc)
        probs = sv.probabilities()

        # Compute expected Ising energy
        n = self.num_qubits
        total_energy = 0.0
        for idx, prob in enumerate(probs):
            if prob < 1e-12:
                continue
            # idx to bits [x_0, x_1, ...]
            # Note: Statevector basis |b_{n-1}...b_0> has bit i at (idx >> i) & 1
            x = np.array([(idx >> i) & 1 for i in range(n)], dtype=int)
            z = 1.0 - 2.0 * x
            energy = self.ising.evaluate_energy(z) + self.ising.constant_offset
            total_energy += prob * energy

        return float(total_energy)

    def solve(self, exact_optimum_reward: Optional[float] = None) -> SolverResult:
        """
        Executes the QAOA optimization, measurement sampling, and feasibility filtering.
        """
        start_time = time.perf_counter()
        rng = np.random.default_rng(self.seed)

        # Initial parameter guess: gamma in [0, pi], beta in [0, pi/2]
        init_gammas = rng.uniform(0.1, np.pi / 2, size=self.p)
        init_betas = rng.uniform(0.1, np.pi / 4, size=self.p)
        init_params = np.concatenate([init_gammas, init_betas])

        # Classical optimization of (gamma, beta)
        opt_res = minimize(
            self._statevector_objective,
            init_params,
            method=self.optimizer_name,
            options={"maxiter": self.maxiter, "rhobeg": 0.2},
        )

        opt_gammas = opt_res.x[:self.p].tolist()
        opt_betas = opt_res.x[self.p:].tolist()

        # Build circuit with optimal parameters and measurement gates
        final_qc = self.circuit_builder.build_bound_circuit(opt_gammas, opt_betas, measure=True)

        # Execute sampling on Aer simulator
        job = self.simulator.run(final_qc, shots=self.shots)
        result = job.result()
        counts = result.get_counts()

        # Analyze measurement samples
        feasible_samples = []
        total_valid_shots = 0

        for raw_bitstring, count in counts.items():
            bits = decode_bitstring(raw_bitstring, self.num_qubits)
            is_valid = self.validator.is_feasible(bits)
            
            if is_valid:
                total_valid_shots += count
                reward = self.qubo.evaluate_reward(bits)
                energy = self.qubo.evaluate_energy(bits)
                feasible_samples.append({
                    "bits": bits,
                    "reward": reward,
                    "energy": energy,
                    "count": count,
                })

        valid_sample_rate = total_valid_shots / float(self.shots)

        fallback_used = False
        if feasible_samples:
            # Select feasible bitstring that maximizes original MWIS reward
            best_sample = max(feasible_samples, key=lambda s: s["reward"])
            selected_bits = best_sample["bits"]
            selected_reward = best_sample["reward"]
            selected_energy = best_sample["energy"]
            is_feasible = True
        else:
            # Fallback policy as required by README Section 5 & 8
            selected_bits = self.validator.get_safe_fallback(self.qubo.weights)
            selected_reward = self.qubo.evaluate_reward(selected_bits)
            selected_energy = self.qubo.evaluate_energy(selected_bits)
            fallback_used = True
            is_feasible = True

        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        active_movements = [i for i, b in enumerate(selected_bits) if b == 1]

        approx_ratio = None
        if exact_optimum_reward is not None and exact_optimum_reward > 0:
            approx_ratio = selected_reward / exact_optimum_reward

        return SolverResult(
            solver=f"qaoa-p{self.p}",
            bitstring=selected_bits,
            active_movements=active_movements,
            objective_reward=selected_reward,
            qubo_energy=selected_energy,
            feasible=is_feasible,
            valid_sample_rate=valid_sample_rate,
            runtime_ms=runtime_ms,
            fallback_used=fallback_used,
            optimal_gamma=opt_gammas,
            optimal_beta=opt_betas,
            p=self.p,
            shots=self.shots,
            approximation_ratio=approx_ratio,
            sampled_counts=counts,
        )

