"""
qubo.py
Maximum-Weight Independent Set (MWIS) QUBO formulation for GREEN-WAVE.
Implements the objective:
    E(x) = - sum_i w_i * x_i + P * sum_{(i,j) in E} x_i * x_j
where P > sum_i w_i guarantees that infeasible solutions are penalized.
"""

from typing import Optional, Tuple
import numpy as np
from .conflict_graph import ConflictGraph


class QUBOFormulation:
    """
    Constructs and evaluates the QUBO formulation for the MWIS problem on the conflict graph.
    """

    def __init__(
        self,
        weights: np.ndarray,
        conflict_graph: ConflictGraph,
        penalty_p: Optional[float] = None,
        penalty_factor: float = 1.5,
    ):
        self.weights = np.asarray(weights, dtype=float)
        self.conflict_graph = conflict_graph
        self.num_nodes = conflict_graph.num_nodes

        if len(self.weights) != self.num_nodes:
            raise ValueError(f"Weight vector length {len(self.weights)} != num_nodes {self.num_nodes}")

        # Conservative penalty P > sum_i w_i as specified in README Section 5
        sum_w = float(np.sum(self.weights))
        if penalty_p is not None:
            self.penalty_p = float(penalty_p)
        else:
            self.penalty_p = max(sum_w * penalty_factor, 1.0)

        # Build upper triangular QUBO matrix Q such that E(x) = x^T Q x
        self.Q = self._build_qubo_matrix()

    def _build_qubo_matrix(self) -> np.ndarray:
        n = self.num_nodes
        Q = np.zeros((n, n), dtype=float)

        # Diagonal terms: -w_i
        for i in range(n):
            Q[i, i] = -self.weights[i]

        # Off-diagonal conflict terms: P for each edge (u, v) in E with u < v
        for u, v in self.conflict_graph.get_edges():
            Q[u, v] = self.penalty_p

        return Q

    def evaluate_energy(self, x: np.ndarray) -> float:
        """
        Evaluates the QUBO energy E(x) for a binary bit vector x in {0, 1}^n.
        E(x) = - sum_i w_i * x_i + P * sum_{(i,j) in E} x_i * x_j
        """
        x_vec = np.asarray(x, dtype=float)
        # Direct calculation to ensure numerical precision
        linear_term = -np.dot(self.weights, x_vec)
        conflict_term = 0.0
        for u, v in self.conflict_graph.get_edges():
            conflict_term += self.penalty_p * (x_vec[u] * x_vec[v])
        return float(linear_term + conflict_term)

    def evaluate_reward(self, x: np.ndarray) -> float:
        """
        Original MWIS reward sum_i w_i * x_i.
        Note: The reward evaluates only the weight gained, independent of penalty.
        """
        x_vec = np.asarray(x, dtype=float)
        return float(np.dot(self.weights, x_vec))

