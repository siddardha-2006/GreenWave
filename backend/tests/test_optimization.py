"""
Unit tests for GREEN-WAVE Quantum Circuit & Optimization Modules.
Verifies all mathematical invariants specified in README Sections 5, 6, 19, and 20.
"""

import unittest
import numpy as np
import os
import sys

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.optimization import (
    MovementRegistry,
    DEFAULT_MOVEMENTS,
    TrafficState,
    calculate_weights,
    ConflictGraph,
    create_default_conflict_graph,
    QUBOFormulation,
    IsingHamiltonian,
    FeasibilityValidator,
    QAOAQuantumCircuit,
    decode_bitstring,
    ExactMWISSolver,
    GreedyMWISSolver,
    SimulatedAnnealingSolver,
    QAOASolver,
)


class TestOptimizationModules(unittest.TestCase):

    def test_movement_registry(self):
        """Verifies that the movement registry contains all 12 movements M0-M11."""
        reg = MovementRegistry()
        self.assertEqual(reg.num_movements, 12)
        self.assertEqual(reg.ids, [f"M{i}" for i in range(12)])
        m0 = reg.get_by_id("M0")
        self.assertEqual(m0.approach, "North")
        self.assertEqual(m0.exit_direction, "South")
        self.assertEqual(m0.movement_type, "through")

    def test_conflict_graph_invariants(self):
        """Verifies symmetry, absence of self-loops, and valid degrees in conflict graph."""
        cg = create_default_conflict_graph()
        self.assertEqual(cg.num_nodes, 12)
        self.assertEqual(cg.num_edges, 28)

        # No self-loops
        for i in range(12):
            self.assertFalse(cg.has_conflict(i, i))

        # Symmetry
        for u in range(12):
            for v in range(12):
                if u != v:
                    self.assertEqual(cg.has_conflict(u, v), cg.has_conflict(v, u))

        # Known compatible pairs (Parallel throughs)
        self.assertFalse(cg.has_conflict(0, 3))  # N-S through and S-N through
        self.assertFalse(cg.has_conflict(6, 9))  # E-W through and W-E through

        # Known conflict pairs (Cross-street throughs)
        self.assertTrue(cg.has_conflict(0, 6))   # N-S vs E-W
        self.assertTrue(cg.has_conflict(0, 9))   # N-S vs W-E
        self.assertTrue(cg.has_conflict(3, 6))   # S-N vs E-W

    def test_qubo_and_ising_energy_equivalence(self):
        """
        Verifies that E_QUBO(x) == H_C(Z) + C for all bitstrings on a small instance,
        and across random bitstrings on the 12-movement instance.
        """
        # 1. 4-node test instance (all 2^4 = 16 states)
        small_cg = ConflictGraph(num_nodes=4)
        small_cg.add_conflict(0, 1)
        small_cg.add_conflict(1, 2)
        small_cg.add_conflict(2, 3)
        small_weights = np.array([2.5, 4.0, 1.0, 3.5])

        small_qubo = QUBOFormulation(small_weights, small_cg, penalty_factor=2.0)
        small_ising = IsingHamiltonian(small_qubo)

        for idx in range(16):
            bits = np.array([(idx >> j) & 1 for j in range(4)], dtype=int)
            self.assertTrue(small_ising.verify_energy_equivalence(bits))

        # 2. 12-node intersection instance (random sample of states)
        cg = create_default_conflict_graph()
        weights = np.array([10.0, 2.0, 1.5, 12.0, 1.5, 1.0, 5.0, 1.0, 1.0, 6.0, 2.0, 1.0])
        qubo = QUBOFormulation(weights, cg)
        ising = IsingHamiltonian(qubo)

        rng = np.random.default_rng(12345)
        for _ in range(50):
            random_bits = rng.integers(0, 2, size=12)
            self.assertTrue(ising.verify_energy_equivalence(random_bits))

    def test_bitstring_decoding_endianness(self):
        """Verifies Qiskit little-endian bitstring decoding maps to correct qubit index."""
        # In Qiskit, bitstring "000000000001" has qubit 0 = 1, all others 0.
        s = "000000000001"
        decoded = decode_bitstring(s, 12)
        self.assertEqual(decoded[0], 1)
        self.assertEqual(np.sum(decoded[1:]), 0)

        # Bitstring "100000000000" has qubit 11 = 1, all others 0.
        s2 = "100000000000"
        decoded2 = decode_bitstring(s2, 12)
        self.assertEqual(decoded2[11], 1)
        self.assertEqual(np.sum(decoded2[:11]), 0)

    def test_feasibility_validator_and_fallback(self):
        """Verifies that conflicting movement sets are rejected and safe fallback is provided."""
        cg = create_default_conflict_graph()
        validator = FeasibilityValidator(cg)
        weights = np.array([10.0, 2.0, 1.5, 12.0, 1.5, 1.0, 5.0, 1.0, 1.0, 6.0, 2.0, 1.0])

        # Feasible set: N-S through + right turns
        feasible_bits = np.array([1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])
        self.assertTrue(validator.is_feasible(feasible_bits))
        self.assertEqual(len(validator.find_violations(feasible_bits)), 0)

        # Infeasible set: M0 (N-S) and M6 (E-W)
        infeasible_bits = np.array([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0])
        self.assertFalse(validator.is_feasible(infeasible_bits))
        violations = validator.find_violations(infeasible_bits)
        self.assertTrue((0, 6) in violations or (6, 0) in violations)

        # Deterministic fallback
        fallback = validator.get_safe_fallback(weights)
        self.assertTrue(validator.is_feasible(fallback))
        self.assertEqual(fallback[3], 1)  # Movement M3 has highest weight (12.0)

    def test_exact_and_greedy_solvers(self):
        """Verifies that Exact solver enumerates 4096 states and yields feasible optimum."""
        cg = create_default_conflict_graph()
        weights = np.array([10.0, 2.0, 1.5, 12.0, 1.5, 1.0, 5.0, 1.0, 1.0, 6.0, 2.0, 1.0])
        qubo = QUBOFormulation(weights, cg)

        exact = ExactMWISSolver(qubo, cg).solve()
        self.assertTrue(exact.is_feasible)
        self.assertEqual(exact.num_evaluated, 4096)
        self.assertGreater(exact.optimal_reward, 0)

        greedy = GreedyMWISSolver(qubo, cg).solve()
        self.assertTrue(greedy.is_feasible)
        self.assertLessEqual(greedy.reward, exact.optimal_reward)

    def test_qaoa_quantum_circuit_construction_and_aer_run(self):
        """Verifies parameterized circuit generation and Aer simulator execution."""
        cg = create_default_conflict_graph()
        weights = np.array([8.0, 1.0, 1.0, 9.0, 1.0, 0.5, 3.0, 0.5, 0.5, 4.0, 1.0, 0.5])
        qubo = QUBOFormulation(weights, cg)
        ising = IsingHamiltonian(qubo)

        circuit_builder = QAOAQuantumCircuit(ising, p=1)
        qc, gammas, betas = circuit_builder.build_parameterized_circuit(measure=True)
        self.assertEqual(qc.num_qubits, 12)
        self.assertEqual(len(gammas), 1)
        self.assertEqual(len(betas), 1)

        # Run QAOA solver with Aer
        solver = QAOASolver(qubo, cg, p=1, shots=512, maxiter=5, seed=42)
        result = solver.solve(exact_optimum_reward=qubo.evaluate_reward(np.array([1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0])))
        self.assertTrue(result.feasible)
        self.assertGreater(result.objective_reward, 0)
        self.assertGreaterEqual(result.valid_sample_rate, 0.0)


if __name__ == "__main__":
    unittest.main()

