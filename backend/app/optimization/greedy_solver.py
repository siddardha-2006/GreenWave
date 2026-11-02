"""
greedy_solver.py
Deterministic Greedy MWIS Solver for GREEN-WAVE.
Implements the reference heuristic from README Section 7:
  1. Sort movements by descending priority weight.
  2. Select highest-weight candidate.
  3. Discard all its conflicting neighbors in the conflict graph.
  4. Repeat until candidate pool is exhausted.
"""

import time
from dataclasses import dataclass
from typing import List
import numpy as np

from .conflict_graph import ConflictGraph
from .feasibility import FeasibilityValidator
from .qubo import QUBOFormulation


@dataclass
class GreedySolution:
    bitstring: np.ndarray
    active_movements: List[int]
    reward: float
    qubo_energy: float
    is_feasible: bool
    runtime_ms: float


class GreedyMWISSolver:
    """
    Greedy heuristic solver for MWIS.
    """

    def __init__(self, qubo: QUBOFormulation, conflict_graph: ConflictGraph):
        self.qubo = qubo
        self.conflict_graph = conflict_graph
        self.validator = FeasibilityValidator(conflict_graph)
        self.num_nodes = conflict_graph.num_nodes

    def solve(self) -> GreedySolution:
        start_time = time.perf_counter()
        n = self.num_nodes
        weights = self.qubo.weights

        # Deterministic sort: primary key is -weight, secondary key is movement index
        sorted_candidates = sorted(range(n), key=lambda i: (-weights[i], i))

        selected: List[int] = []
        excluded: set = set()

        for cand in sorted_candidates:
            if cand in excluded:
                continue
            selected.append(cand)
            # Exclude all conflicting neighbors
            for neighbor in self.conflict_graph.conflicts_with(cand):
                excluded.add(neighbor)

        bitstring = np.zeros(n, dtype=int)
        for idx in selected:
            bitstring[idx] = 1

        reward = self.qubo.evaluate_reward(bitstring)
        energy = self.qubo.evaluate_energy(bitstring)
        is_feasible = self.validator.is_feasible(bitstring)
        runtime_ms = (time.perf_counter() - start_time) * 1000.0

        return GreedySolution(
            bitstring=bitstring,
            active_movements=sorted(selected),
            reward=reward,
            qubo_energy=energy,
            is_feasible=is_feasible,
            runtime_ms=runtime_ms,
        )

