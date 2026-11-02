"""
qaoa_circuit.py
Qiskit Parameterized and Numerical QAOA Quantum Circuit for GREEN-WAVE.
Implements the exact QAOA circuit architecture specified in README Section 5:
  1. Initial state: Hadamard on all qubits (creates |+>^n)
  2. For each layer l = 1..p:
     - Cost Unitary U_C(gamma_l):
         * RZ(2 * gamma_l * h_i) on each qubit i
         * CX(i, j) -> RZ(2 * gamma_l * J_ij, j) -> CX(i, j) for each edge (i, j) in E
     - Mixer Unitary U_M(beta_l):
         * RX(2 * beta_l) on each qubit i
  3. Measurement of all qubits.
"""

from typing import List, Optional, Tuple, Union
import numpy as np
from qiskit import ClassicalRegister, QuantumCircuit, QuantumRegister
from qiskit.circuit import ParameterVector

from .ising import IsingHamiltonian


def decode_bitstring(raw_bitstring: str, num_qubits: int) -> np.ndarray:
    """
    Decodes a Qiskit measurement bitstring into an ordered array of bits [x_0, x_1, ..., x_{n-1}].
    
    Qiskit uses little-endian ordering:
        raw_bitstring = c_{n-1} c_{n-2} ... c_1 c_0
        where the rightmost character is qubit 0 and the leftmost is qubit n-1.
    """
    s = raw_bitstring.strip()
    if len(s) != num_qubits:
        raise ValueError(f"Bitstring length {len(s)} does not match num_qubits {num_qubits}")
    
    # Reverse string so index i maps to qubit i
    reversed_bits = s[::-1]
    return np.array([int(b) for b in reversed_bits], dtype=int)


def encode_bitstring(bits: np.ndarray) -> str:
    """Converts an ordered bit array [x_0, x_1, ..., x_{n-1}] into Qiskit's little-endian bitstring."""
    b_list = [str(int(b)) for b in bits]
    return "".join(reversed(b_list))


class QAOAQuantumCircuit:
    """
    Constructs parameterized and bound QAOA quantum circuits for GREEN-WAVE.
    """

    def __init__(self, ising: IsingHamiltonian, p: int = 1):
        self.ising = ising
        self.num_qubits = ising.num_qubits
        self.p = p
        self.edges = ising.conflict_graph.get_edges()

    def build_parameterized_circuit(self, measure: bool = True) -> Tuple[QuantumCircuit, ParameterVector, ParameterVector]:
        """
        Builds a symbolic Qiskit QuantumCircuit with ParameterVectors for gamma and beta.
        
        Returns:
            (circuit, gamma_params, beta_params)
        """
        qr = QuantumRegister(self.num_qubits, name="q")
        cr = ClassicalRegister(self.num_qubits, name="c") if measure else None
        qc = QuantumCircuit(qr, cr) if measure else QuantumCircuit(qr)

        gammas = ParameterVector("gamma", self.p)
        betas = ParameterVector("beta", self.p)

        # 1. State preparation: Hadamard on every qubit
        for i in range(self.num_qubits):
            qc.h(qr[i])

        # 2. QAOA layers
        for layer in range(self.p):
            gamma = gammas[layer]
            beta = betas[layer]

            # Cost Unitary: U_C(gamma)
            # Single-qubit terms: R_Z(2 * gamma * h_i)
            for i in range(self.num_qubits):
                h_i = self.ising.h_coeffs[i]
                if abs(h_i) > 1e-9:
                    qc.rz(2.0 * gamma * h_i, qr[i])

            # Two-qubit conflict terms: e^{-i * gamma * J_ij * Z_i * Z_j}
            # Implemented as CX(i, j) -> RZ(2 * gamma * J_ij, j) -> CX(i, j)
            for u, v in self.edges:
                J_uv = self.ising.J_coeffs[(u, v)]
                qc.cx(qr[u], qr[v])
                qc.rz(2.0 * gamma * J_uv, qr[v])
                qc.cx(qr[u], qr[v])

            # Mixer Unitary: U_M(beta)
            # R_X(2 * beta) on every qubit
            for i in range(self.num_qubits):
                qc.rx(2.0 * beta, qr[i])

        # 3. Measurement
        if measure:
            qc.barrier()
            for i in range(self.num_qubits):
                qc.measure(qr[i], cr[i])

        return qc, gammas, betas

    def build_bound_circuit(
        self,
        gammas: Union[List[float], np.ndarray],
        betas: Union[List[float], np.ndarray],
        measure: bool = True,
    ) -> QuantumCircuit:
        """
        Builds a concrete QuantumCircuit with numerical angles bound for gamma and beta.
        """
        if len(gammas) != self.p or len(betas) != self.p:
            raise ValueError(f"Angle lists must have length p={self.p}. Got {len(gammas)}, {len(betas)}")

        qr = QuantumRegister(self.num_qubits, name="q")
        cr = ClassicalRegister(self.num_qubits, name="c") if measure else None
        qc = QuantumCircuit(qr, cr) if measure else QuantumCircuit(qr)

        # 1. State preparation
        for i in range(self.num_qubits):
            qc.h(qr[i])

        # 2. QAOA layers
        for layer in range(self.p):
            gamma = float(gammas[layer])
            beta = float(betas[layer])

            # Cost unitary single-qubit rotations
            for i in range(self.num_qubits):
                h_i = self.ising.h_coeffs[i]
                if abs(h_i) > 1e-9:
                    qc.rz(2.0 * gamma * h_i, qr[i])

            # Cost unitary two-qubit ZZ interactions
            for u, v in self.edges:
                J_uv = self.ising.J_coeffs[(u, v)]
                qc.cx(qr[u], qr[v])
                qc.rz(2.0 * gamma * J_uv, qr[v])
                qc.cx(qr[u], qr[v])

            # Mixer unitary
            for i in range(self.num_qubits):
                qc.rx(2.0 * beta, qr[i])

        # 3. Measurement
        if measure:
            qc.barrier()
            for i in range(self.num_qubits):
                qc.measure(qr[i], cr[i])

        return qc
