"""
exact_solver.py
Exact MWIS Solver via Bitstring Enumeration for GREEN-WAVE.
Enumerates all 2^n states (4096 for n=12) to determine the mathematically
optimal maximum-weight independent set, serving as the ground-truth benchmark.
"""

import time
from dataclasses import dataclass
from typing import List, Optional
import numpy as np

from .conflict_graph import ConflictGraph
from .feasibility import FeasibilityValidator
from .qubo import QUBOFormulation


@dataclass
class ExactSolution:
    bitstring: np.ndarray
    active_movements: List[int]
    optimal_reward: float
    qubo_energy: float
    is_feasible: bool
    num_evaluated: int
    runtime_ms: float


class ExactMWISSolver:
    """
    Computes the exact optimum for the MWIS problem.
    """

    def __init__(self, qubo: QUBOFormulation, conflict_graph: ConflictGraph):
        self.qubo = qubo
        self.conflict_graph = conflict_graph
        self.validator = FeasibilityValidator(conflict_graph)
        self.num_nodes = conflict_graph.num_nodes

    def solve(self) -> ExactSolution:
        start_time = time.perf_counter()
        n = self.num_nodes
        total_states = 1 << n  # 2^n

        best_reward = -1.0
        best_bits = np.zeros(n, dtype=int)
        best_energy = float("inf")

        # Iterate over all 2^n combinations
        for idx in range(total_states):
            # Extract bits
            bits = np.array([(idx >> j) & 1 for j in range(n)], dtype=int)
            
            # Feasibility check
            if self.validator.is_feasible(bits):
                reward = self.qubo.evaluate_reward(bits)
                if reward > best_reward:
                    best_reward = reward
                    best_bits = bits.copy()
                    best_energy = self.qubo.evaluate_energy(bits)

        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        active = [i for i, b in enumerate(best_bits) if b == 1]

        return ExactSolution(
            bitstring=best_bits,
            active_movements=active,
            optimal_reward=best_reward,
            qubo_energy=best_energy,
            is_feasible=True,
            num_evaluated=total_states,
            runtime_ms=runtime_ms,
        )

