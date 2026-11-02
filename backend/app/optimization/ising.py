"""
ising.py
Exact QUBO-to-Ising Hamiltonian conversion for GREEN-WAVE.
Implements the formulation from README Section 5:
    H_C = sum_i h_i * Z_i + sum_{(i,j) in E} J_ij * Z_i * Z_j
with:
    h_i = w_i / 2 - (P * d_i) / 4
    J_ij = P / 4
and constant offset:
    C = - sum_i (w_i / 2) + (P * |E|) / 4
such that E_QUBO(x) == E_Ising(Z) + C for all bitstrings x and spins Z = 1 - 2*x.
"""

from typing import Dict, List, Tuple
import numpy as np
from .qubo import QUBOFormulation


class IsingHamiltonian:
    """
    Represents the Ising Hamiltonian parameters H_C for QAOA execution.
    """

    def __init__(self, qubo: QUBOFormulation):
        self.qubo = qubo
        self.num_qubits = qubo.num_nodes
        self.weights = qubo.weights
        self.penalty_p = qubo.penalty_p
        self.conflict_graph = qubo.conflict_graph

        # Calculate h_i: h_i = w_i / 2 - (P * d_i) / 4
        self.h_coeffs = np.zeros(self.num_qubits, dtype=float)
        for i in range(self.num_qubits):
            d_i = self.conflict_graph.degree(i)
            self.h_coeffs[i] = (self.weights[i] / 2.0) - (self.penalty_p * d_i / 4.0)

        # Calculate J_ij: J_ij = P / 4 for each edge (u, v) in E
        self.J_coeffs: Dict[Tuple[int, int], float] = {}
        for u, v in self.conflict_graph.get_edges():
            self.J_coeffs[(u, v)] = self.penalty_p / 4.0

        # Calculate global energy constant offset C
        num_edges = self.conflict_graph.num_edges
        sum_w = float(np.sum(self.weights))
        self.constant_offset = -(sum_w / 2.0) + (self.penalty_p * num_edges / 4.0)

    def evaluate_energy(self, z_spins: np.ndarray) -> float:
        """
        Evaluates Ising energy H_C(Z) for spin vector Z in {+1, -1}^n.
        """
        z = np.asarray(z_spins, dtype=float)
        single_term = np.dot(self.h_coeffs, z)
        two_body_term = sum(J * z[u] * z[v] for (u, v), J in self.J_coeffs.items())
        return float(single_term + two_body_term)

    def qubo_to_spins(self, x_bits: np.ndarray) -> np.ndarray:
        """Converts binary bits x in {0, 1} to Pauli-Z eigenvalues Z in {+1, -1}: Z = 1 - 2*x."""
        return 1.0 - 2.0 * np.asarray(x_bits, dtype=float)

    def spins_to_qubo(self, z_spins: np.ndarray) -> np.ndarray:
        """Converts Pauli-Z eigenvalues Z in {+1, -1} to binary bits x in {0, 1}: x = (1 - Z) / 2."""
        return ((1.0 - np.asarray(z_spins, dtype=float)) / 2.0).astype(int)

    def verify_energy_equivalence(self, x_bits: np.ndarray, tol: float = 1e-9) -> bool:
        """
        Unit-test helper: verifies that E_QUBO(x) == H_C(Z) + C within floating tolerance.
        """
        e_qubo = self.qubo.evaluate_energy(x_bits)
        z = self.qubo_to_spins(x_bits)
        e_ising = self.evaluate_energy(z) + self.constant_offset
        return abs(e_qubo - e_ising) < tol

