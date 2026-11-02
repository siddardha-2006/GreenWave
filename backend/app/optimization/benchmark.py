"""
benchmark.py
Comparative Benchmark Runner for GREEN-WAVE Solvers.
Runs Exact MWIS, Greedy MWIS, Simulated Annealing, and QAOA on identical
traffic instances and generates side-by-side performance audits.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import numpy as np

from .conflict_graph import ConflictGraph
from .exact_solver import ExactMWISSolver
from .greedy_solver import GreedyMWISSolver
from .annealing_solver import SimulatedAnnealingSolver
from .qaoa_solver import QAOASolver, SolverResult
from .qubo import QUBOFormulation


@dataclass
class BenchmarkReport:
    exact_reward: float
    results: Dict[str, Dict[str, any]]


class BenchmarkRunner:
    """
    Executes all solvers on an identical QUBO/conflict graph instance.
    """

    def __init__(self, qubo: QUBOFormulation, conflict_graph: ConflictGraph, seed: int = 42):
        self.qubo = qubo
        self.conflict_graph = conflict_graph
        self.seed = seed

    def run_all(self, qaoa_p_values: Optional[List[int]] = None, qaoa_shots: int = 2048) -> BenchmarkReport:
        p_list = qaoa_p_values or [1, 2]
        report: Dict[str, Dict[str, any]] = {}

        # 1. Exact Enumeration (Ground Truth Optimum)
        exact_solver = ExactMWISSolver(self.qubo, self.conflict_graph)
        exact_res = exact_solver.solve()
        exact_reward = exact_res.optimal_reward

        report["exact"] = {
            "solver": "Exact Enumeration",
            "reward": exact_res.optimal_reward,
            "qubo_energy": exact_res.qubo_energy,
            "bitstring": "".join(str(b) for b in exact_res.bitstring),
            "active_movements": exact_res.active_movements,
            "feasible": exact_res.is_feasible,
            "approx_ratio": 1.0,
            "runtime_ms": exact_res.runtime_ms,
            "fallback_used": False,
        }

        # 2. Greedy MWIS
        greedy_solver = GreedyMWISSolver(self.qubo, self.conflict_graph)
        greedy_res = greedy_solver.solve()
        greedy_ratio = (greedy_res.reward / exact_reward) if exact_reward > 0 else 1.0

        report["greedy"] = {
            "solver": "Greedy MWIS",
            "reward": greedy_res.reward,
            "qubo_energy": greedy_res.qubo_energy,
            "bitstring": "".join(str(b) for b in greedy_res.bitstring),
            "active_movements": greedy_res.active_movements,
            "feasible": greedy_res.is_feasible,
            "approx_ratio": greedy_ratio,
            "runtime_ms": greedy_res.runtime_ms,
            "fallback_used": False,
        }

        # 3. Simulated Annealing
        sa_solver = SimulatedAnnealingSolver(self.qubo, self.conflict_graph, seed=self.seed)
        sa_res = sa_solver.solve()
        sa_ratio = (sa_res.reward / exact_reward) if exact_reward > 0 else 1.0

        report["simulated_annealing"] = {
            "solver": "Simulated Annealing",
            "reward": sa_res.reward,
            "qubo_energy": sa_res.qubo_energy,
            "bitstring": "".join(str(b) for b in sa_res.bitstring),
            "active_movements": sa_res.active_movements,
            "feasible": sa_res.is_feasible,
            "approx_ratio": sa_ratio,
            "runtime_ms": sa_res.runtime_ms,
            "fallback_used": sa_res.fallback_used,
        }

        # 4. QAOA for each p
        for p in p_list:
            qaoa_solver = QAOASolver(
                self.qubo,
                self.conflict_graph,
                p=p,
                shots=qaoa_shots,
                seed=self.seed,
            )
            qaoa_res = qaoa_solver.solve(exact_optimum_reward=exact_reward)

            report[f"qaoa_p{p}"] = {
                "solver": f"QAOA (p={p})",
                "reward": qaoa_res.objective_reward,
                "qubo_energy": qaoa_res.qubo_energy,
                "bitstring": "".join(str(b) for b in qaoa_res.bitstring),
                "active_movements": qaoa_res.active_movements,
                "feasible": qaoa_res.feasible,
                "valid_sample_rate": qaoa_res.valid_sample_rate,
                "approx_ratio": qaoa_res.approximation_ratio,
                "runtime_ms": qaoa_res.runtime_ms,
                "fallback_used": qaoa_res.fallback_used,
            }

        return BenchmarkReport(exact_reward=exact_reward, results=report)

