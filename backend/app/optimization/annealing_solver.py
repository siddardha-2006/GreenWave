"""
annealing_solver.py
Classical Simulated Annealing Solver for GREEN-WAVE.
Optimizes over the exact QUBO energy landscape with geometric cooling,
Metropolis acceptance, and feasibility validation.
"""

import math
import time
from dataclasses import dataclass
from typing import List, Optional
import numpy as np

from .conflict_graph import ConflictGraph
from .feasibility import FeasibilityValidator
from .qubo import QUBOFormulation


@dataclass
class AnnealingSolution:
    bitstring: np.ndarray
    active_movements: List[int]
    reward: float
    qubo_energy: float
    is_feasible: bool
    fallback_used: bool
    sweeps: int
    runtime_ms: float


class SimulatedAnnealingSolver:
    """
    Simulated Annealing baseline for MWIS QUBO.
    """

    def __init__(
        self,
        qubo: QUBOFormulation,
        conflict_graph: ConflictGraph,
        initial_temp: float = 10.0,
        cooling_rate: float = 0.95,
        sweeps_per_temp: int = 20,
        num_temp_steps: int = 100,
        seed: Optional[int] = 42,
    ):
        self.qubo = qubo
        self.conflict_graph = conflict_graph
        self.validator = FeasibilityValidator(conflict_graph)
        self.num_nodes = conflict_graph.num_nodes
        self.initial_temp = initial_temp
        self.cooling_rate = cooling_rate
        self.sweeps_per_temp = sweeps_per_temp
        self.num_temp_steps = num_temp_steps
        self.seed = seed

    def solve(self) -> AnnealingSolution:
        start_time = time.perf_counter()
        rng = np.random.default_rng(self.seed)
        n = self.num_nodes

        # Start from all zeros (empty set, always feasible with E=0)
        current_state = np.zeros(n, dtype=int)
        current_energy = self.qubo.evaluate_energy(current_state)

        best_state = current_state.copy()
        best_energy = current_energy

        temp = self.initial_temp
        total_evaluations = 0

        for _ in range(self.num_temp_steps):
            for _ in range(self.sweeps_per_temp):
                total_evaluations += 1
                # Single-bit flip proposal
                flip_idx = rng.integers(0, n)
                candidate_state = current_state.copy()
                candidate_state[flip_idx] = 1 - candidate_state[flip_idx]

                candidate_energy = self.qubo.evaluate_energy(candidate_state)
                delta_e = candidate_energy - current_energy

                # Metropolis acceptance criterion
                if delta_e < 0 or rng.random() < math.exp(-delta_e / max(temp, 1e-8)):
                    current_state = candidate_state
                    current_energy = candidate_energy

                    if current_energy < best_energy:
                        best_energy = current_energy
                        best_state = current_state.copy()

            temp *= self.cooling_rate

        # Validation
        is_feasible = self.validator.is_feasible(best_state)
        fallback_used = False
        final_state = best_state

        if not is_feasible:
            final_state = self.validator.get_safe_fallback(self.qubo.weights)
            fallback_used = True
            is_feasible = True

        reward = self.qubo.evaluate_reward(final_state)
        final_energy = self.qubo.evaluate_energy(final_state)
        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        active = [i for i, b in enumerate(final_state) if b == 1]

        return AnnealingSolution(
            bitstring=final_state,
            active_movements=active,
            reward=reward,
            qubo_energy=final_energy,
            is_feasible=is_feasible,
            fallback_used=fallback_used,
            sweeps=total_evaluations,
            runtime_ms=runtime_ms,
        )

