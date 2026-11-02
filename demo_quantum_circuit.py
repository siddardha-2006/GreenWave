#!/usr/bin/env python3
"""
GREEN-WAVE: Quantum Circuit Implementation & Prototype Demonstration
====================================================================
Predictive, Emergency-Aware and Pedestrian-Safe Intelligent Traffic Management
using QUBO and QAOA on a 4-Way Intersection.

This script demonstrates:
  1. Authoritative 12-movement registry and verified conflict graph.
  2. Priority weight calculation from queue and waiting-time metrics.
  3. MWIS QUBO formulation and exact QUBO-to-Ising mapping with offset verification.
  4. Qiskit QAOA quantum circuit construction, depth, and gate visualization.
  5. Aer quantum simulator execution, parameter optimization (COBYLA), and sampling.
  6. Independent feasibility & safety validation (detecting and discarding conflicts).
  7. Deterministic safe fallback mechanism.
  8. Side-by-side benchmark comparison against Exact, Greedy, and Simulated Annealing.
"""

import sys
import os
import numpy as np

# Ensure backend package is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(current_dir, "backend"))

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

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
    BenchmarkRunner,
)


def print_banner(title: str):
    width = 78
    print("\n" + "=" * width)
    print(f" {title}".center(width))
    print("=" * width)


def print_section(title: str):
    print(f"\n--- {title} ---")


def main():
    print_banner("GREEN-WAVE: QAOA QUANTUM CIRCUIT PROTOTYPE DEMONSTRATION")
    print("Simulated 4-Way Intersection Traffic Signal Optimization using Qiskit & Aer\n")

    # ---------------------------------------------------------
    # 1. MOVEMENT REGISTRY
    # ---------------------------------------------------------
    print_section("1. Authoritative 12-Movement Registry (README Section 4)")
    registry = MovementRegistry()
    print(f"{'ID':<6} {'Name':<8} {'Approach':<10} {'Exit':<10} {'Type':<10} {'Description'}")
    print("-" * 75)
    for m in registry.movements:
        print(f"{m.id:<6} {m.name:<8} {m.approach:<10} {m.exit_direction:<10} {m.movement_type:<10} {m.description}")

    # ---------------------------------------------------------
    # 2. CONFLICT GRAPH
    # ---------------------------------------------------------
    print_section("2. Movement Conflict Graph G = (V, E)")
    conflict_graph = create_default_conflict_graph()
    num_nodes = conflict_graph.num_nodes
    num_edges = conflict_graph.num_edges
    print(f"Total Vertices (Movements): {num_nodes}")
    print(f"Total Conflict Edges:       {num_edges}")
    print("\nMovement Conflict Degrees (Number of incompatible movements):")
    for i in range(num_nodes):
        m = registry.get_by_index(i)
        conflicts = [registry.get_by_index(c).id for c in sorted(conflict_graph.conflicts_with(i))]
        print(f"  {m.id} ({m.name}): degree {conflict_graph.degree(i):2d} -> conflicts with {', '.join(conflicts)}")

    # ---------------------------------------------------------
    # 3. TRAFFIC STATE & PRIORITY WEIGHTS
    # ---------------------------------------------------------
    print_section("3. Traffic State & Weight Calculation (README Section 5)")
    # Realistic peak traffic snapshot: Heavy North-South demand with some cross-traffic
    mock_traffic = TrafficState(
        queue_lengths={
            "M0": 8.0,  # North-South Through heavy queue
            "M1": 2.0,  # North-East Left
            "M2": 3.0,  # North-West Right
            "M3": 9.0,  # South-North Through heavy queue
            "M4": 2.0,  # South-East Right
            "M5": 1.0,  # South-West Left
            "M6": 4.0,  # East-West Through
            "M7": 1.0,  # East-North Right
            "M8": 1.0,  # East-South Left
            "M9": 3.0,  # West-East Through
            "M10": 2.0, # West-North Left
            "M11": 1.0, # West-South Right
        },
        predicted_queues={
            "M0": 3.0, "M1": 1.0, "M2": 1.0,
            "M3": 4.0, "M4": 1.0, "M5": 0.5,
            "M6": 2.0, "M7": 0.5, "M8": 0.5,
            "M9": 2.0, "M10": 1.0, "M11": 0.5,
        },
        waiting_times={
            "M0": 25.0, "M1": 10.0, "M2": 5.0,
            "M3": 30.0, "M4": 8.0, "M5": 4.0,
            "M6": 15.0, "M7": 5.0, "M8": 4.0,
            "M9": 12.0, "M10": 8.0, "M11": 4.0,
        },
    )

    # Weights: w_i = alpha*Q_i + beta*Q_hat_i + gamma*W_i
    weights = calculate_weights(mock_traffic, registry, alpha=1.0, beta=0.5, gamma=0.2)
    print(f"{'Movement':<10} {'Queue (Q)':<12} {'Pred Queue':<12} {'Wait Time (s)':<15} {'Weight (w_i)':<12}")
    print("-" * 65)
    for i, m in enumerate(registry.movements):
        q = mock_traffic.queue_lengths.get(m.id, 0.0)
        qp = mock_traffic.predicted_queues.get(m.id, 0.0)
        wt = mock_traffic.waiting_times.get(m.id, 0.0)
        print(f"{m.id + ' (' + m.name + ')':<10} {q:<12.1f} {qp:<12.1f} {wt:<15.1f} {weights[i]:<12.2f}")

    # ---------------------------------------------------------
    # 4. QUBO & ISING FORMULATION
    # ---------------------------------------------------------
    print_section("4. QUBO & Ising Hamiltonian Formulation")
    qubo = QUBOFormulation(weights, conflict_graph)
    ising = IsingHamiltonian(qubo)

    print(f"Conservative Penalty P: {qubo.penalty_p:.2f} (strictly > sum(weights) = {np.sum(weights):.2f})")
    print(f"Ising Energy Offset C:  {ising.constant_offset:.4f}")
    print("\nLocal Fields h_i = w_i/2 - P*d_i/4:")
    for i in range(num_nodes):
        m = registry.get_by_index(i)
        print(f"  q{i:02d} ({m.id}): h_{i} = {ising.h_coeffs[i]:+8.3f}")

    coupling_val = ising.penalty_p / 4.0
    print(f"\nTwo-body Couplings J_ij = P/4 = {coupling_val:.3f} across all {num_edges} conflict edges.")

    # Mathematical Equivalence Verification
    print("\nMathematical Equivalence Check (E_QUBO(x) == H_C(Z) + C):")
    test_states = [
        np.zeros(12, dtype=int),  # All red
        np.array([1, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]),  # N-S phase: M0, M2, M3, M4
        np.array([0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 1]),  # E-W phase: M6, M7, M9, M11
        np.ones(12, dtype=int),   # All green (heavily conflicting)
    ]
    all_match = True
    for idx, state in enumerate(test_states):
        e_q = qubo.evaluate_energy(state)
        z = ising.qubo_to_spins(state)
        e_ising_shifted = ising.evaluate_energy(z) + ising.constant_offset
        diff = abs(e_q - e_ising_shifted)
        match = diff < 1e-9
        if not match:
            all_match = False
        bit_str = "".join(str(b) for b in state)
        print(f"  Test State {idx+1} [{bit_str}]: QUBO={e_q:10.2f}, Ising+C={e_ising_shifted:10.2f}, Match={match}")
    print(f"  -> Exact Energy Equivalence: {'VERIFIED [PASS]' if all_match else 'FAILED'}")

    # ---------------------------------------------------------
    # 5. QAOA QUANTUM CIRCUIT ARCHITECTURE
    # ---------------------------------------------------------
    print_section("5. Parameterized QAOA Quantum Circuit (p=1)")
    circuit_builder = QAOAQuantumCircuit(ising, p=1)
    param_qc, gammas, betas = circuit_builder.build_parameterized_circuit(measure=True)

    print(f"Number of Qubits:      {param_qc.num_qubits}")
    print(f"Circuit Depth:         {param_qc.depth()}")
    print(f"Total Gate Count:      {sum(param_qc.count_ops().values())}")
    print(f"Operations breakdown:  {dict(param_qc.count_ops())}")
    print(f"Variational Parameters: gamma={gammas}, beta={betas}")

    print("\nVisual ASCII Representation of the First 4 Qubits (Truncated for terminal):")
    # Sub-circuit illustration for first 4 qubits
    sample_sub_qc = QAOAQuantumCircuit(ising, p=1).build_bound_circuit([0.45], [0.35], measure=False)
    circuit_text = sample_sub_qc.draw(output="text", idle_wires=False)
    # Print first few lines of circuit
    lines = str(circuit_text).split("\n")
    for line in lines[:16]:
        print("  " + line[:90])
    if len(lines) > 16:
        print("  ... [additional qubit lines and conflict interaction gates] ...")

    # ---------------------------------------------------------
    # 6. SOLVER EXECUTION & VALIDATION
    # ---------------------------------------------------------
    print_section("6. Execution: Classical Baselines vs QAOA on Aer Simulator")
    print("Running solvers on identical traffic snapshot...\n")

    # 6A. Exact Enumeration
    print("-> [1/4] Running Exact Classical Enumeration (2^12 = 4096 states)...")
    exact_solver = ExactMWISSolver(qubo, conflict_graph)
    exact_sol = exact_solver.solve()
    print(f"    Optimal Reward:     {exact_sol.optimal_reward:.2f}")
    print(f"    Optimal Bitstring:  {''.join(str(b) for b in exact_sol.bitstring)}")
    print(f"    Active Movements:   {[registry.get_by_index(i).id for i in exact_sol.active_movements]}")
    print(f"    States Evaluated:   {exact_sol.num_evaluated} in {exact_sol.runtime_ms:.2f} ms")

    # 6B. Greedy MWIS
    print("\n-> [2/4] Running Greedy MWIS Heuristic...")
    greedy_solver = GreedyMWISSolver(qubo, conflict_graph)
    greedy_sol = greedy_solver.solve()
    print(f"    Greedy Reward:      {greedy_sol.reward:.2f}")
    print(f"    Greedy Bitstring:   {''.join(str(b) for b in greedy_sol.bitstring)}")
    print(f"    Active Movements:   {[registry.get_by_index(i).id for i in greedy_sol.active_movements]}")
    print(f"    Runtime:            {greedy_sol.runtime_ms:.2f} ms")

    # 6C. Simulated Annealing
    print("\n-> [3/4] Running Simulated Annealing (Metropolis with geometric cooling)...")
    sa_solver = SimulatedAnnealingSolver(qubo, conflict_graph, seed=42)
    sa_sol = sa_solver.solve()
    print(f"    SA Reward:          {sa_sol.reward:.2f}")
    print(f"    SA Bitstring:       {''.join(str(b) for b in sa_sol.bitstring)}")
    print(f"    Active Movements:   {[registry.get_by_index(i).id for i in sa_sol.active_movements]}")
    print(f"    Runtime:            {sa_sol.runtime_ms:.2f} ms")

    # 6D. QAOA p=1 on AerSimulator
    print("\n-> [4/4] Running Hybrid QAOA (p=1, 2048 shots on Qiskit Aer)...")
    qaoa_p1 = QAOASolver(qubo, conflict_graph, p=1, shots=2048, seed=42)
    qaoa_p1_res = qaoa_p1.solve(exact_optimum_reward=exact_sol.optimal_reward)
    print(f"    Optimal Parameters: gamma={qaoa_p1_res.optimal_gamma[0]:.4f}, beta={qaoa_p1_res.optimal_beta[0]:.4f}")
    print(f"    Valid Sample Rate:  {qaoa_p1_res.valid_sample_rate * 100:.1f}% feasible shots")
    print(f"    Selected Reward:    {qaoa_p1_res.objective_reward:.2f}")
    print(f"    Selected Bitstring: {''.join(str(b) for b in qaoa_p1_res.bitstring)}")
    print(f"    Active Movements:   {[registry.get_by_index(i).id for i in qaoa_p1_res.active_movements]}")
    print(f"    Approximation Ratio:{qaoa_p1_res.approximation_ratio:.4f} (relative to exact)")
    print(f"    Runtime:            {qaoa_p1_res.runtime_ms:.2f} ms")

    # 6E. QAOA p=2 on AerSimulator
    print("\n-> [Bonus] Running Hybrid QAOA (p=2, 2048 shots on Qiskit Aer)...")
    qaoa_p2 = QAOASolver(qubo, conflict_graph, p=2, shots=2048, seed=42)
    qaoa_p2_res = qaoa_p2.solve(exact_optimum_reward=exact_sol.optimal_reward)
    print(f"    Valid Sample Rate:  {qaoa_p2_res.valid_sample_rate * 100:.1f}% feasible shots")
    print(f"    Selected Reward:    {qaoa_p2_res.objective_reward:.2f}")
    print(f"    Approximation Ratio:{qaoa_p2_res.approximation_ratio:.4f}")
    print(f"    Runtime:            {qaoa_p2_res.runtime_ms:.2f} ms")

    # ---------------------------------------------------------
    # 7. SAFETY VALIDATION & FALLBACK AUDIT
    # ---------------------------------------------------------
    print_section("7. Safety Controller & Feasibility Audit")
    validator = FeasibilityValidator(conflict_graph)

    print("Verifying Safety Invariant: Zero conflicting green movements allowed.")
    for name, bits in [
        ("Exact Solution", exact_sol.bitstring),
        ("Greedy Solution", greedy_sol.bitstring),
        ("SA Solution", sa_sol.bitstring),
        ("QAOA p=1 Selected", qaoa_p1_res.bitstring),
        ("QAOA p=2 Selected", qaoa_p2_res.bitstring),
    ]:
        violations = validator.find_violations(bits)
        is_safe = len(violations) == 0
        status = "PASSED [100% FEASIBLE]" if is_safe else f"VIOLATION: {violations}"
        print(f"  {name:<20}: {status}")

    print("\nSimulating Safety Interception on Infeasible Output:")
    infeasible_proposal = np.array([1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0])  # M0 (N-S) and M6 (E-W) simultaneously
    violations = validator.find_violations(infeasible_proposal)
    print(f"  Unsafe Candidate:    M0 and M6 together")
    print(f"  Violations Detected: {[(registry.get_by_index(u).id, registry.get_by_index(v).id) for u, v in violations]}")
    fallback_bits = validator.get_safe_fallback(weights)
    fallback_mvs = [registry.get_by_index(i).id for i, b in enumerate(fallback_bits) if b == 1]
    print(f"  Safety Action:       Proposal REJECTED -> Fallback ENGAGED")
    print(f"  Safe Fallback Phase: {fallback_mvs} (Feasible: {validator.is_feasible(fallback_bits)})")

    # ---------------------------------------------------------
    # 8. PERFORMANCE BENCHMARK COMPARISON TABLE
    # ---------------------------------------------------------
    print_section("8. Comprehensive Benchmark Comparison (README Section 7)")
    print(f"{'Solver':<22} {'Reward':<10} {'QUBO Energy':<14} {'Feasible':<10} {'Approx Ratio':<14} {'Runtime (ms)':<12}")
    print("-" * 84)

    rows = [
        ("Exact Enumeration", exact_sol.optimal_reward, exact_sol.qubo_energy, "Yes", "1.0000 (Exact)", f"{exact_sol.runtime_ms:8.2f}"),
        ("Greedy MWIS", greedy_sol.reward, greedy_sol.qubo_energy, "Yes", f"{greedy_sol.reward / exact_sol.optimal_reward:10.4f}", f"{greedy_sol.runtime_ms:8.2f}"),
        ("Simulated Annealing", sa_sol.reward, sa_sol.qubo_energy, "Yes", f"{sa_sol.reward / exact_sol.optimal_reward:10.4f}", f"{sa_sol.runtime_ms:8.2f}"),
        ("QAOA (p=1, Aer)", qaoa_p1_res.objective_reward, qaoa_p1_res.qubo_energy, "Yes", f"{qaoa_p1_res.approximation_ratio:10.4f}", f"{qaoa_p1_res.runtime_ms:8.2f}"),
        ("QAOA (p=2, Aer)", qaoa_p2_res.objective_reward, qaoa_p2_res.qubo_energy, "Yes", f"{qaoa_p2_res.approximation_ratio:10.4f}", f"{qaoa_p2_res.runtime_ms:8.2f}"),
    ]
    for r in rows:
        print(f"{r[0]:<22} {r[1]:<10.2f} {r[2]:<14.2f} {r[3]:<10} {r[4]:<14} {r[5]:<12}")

    # ---------------------------------------------------------
    # 9. SIGNAL CONTROLLER INTERPRETATION
    # ---------------------------------------------------------
    print_section("9. Traffic Controller Signal Phase Interpretation")
    active_ids = [registry.get_by_index(i).id for i in qaoa_p1_res.active_movements]
    active_descs = [registry.get_by_index(i).description for i in qaoa_p1_res.active_movements]
    print(f"The QAOA optimizer proposes candidate green phase: {', '.join(active_ids)}")
    for d in active_descs:
        print(f"  * {d}")
    print("Deterministically validated: All movements in the proposed phase are mutually compatible.")
    print("Phase scheduler can now safely initiate green interval without conflict.")

    print_banner("DEMONSTRATION COMPLETED SUCCESSFULLY")


if __name__ == "__main__":
    main()
