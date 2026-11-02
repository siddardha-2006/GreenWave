"""
GREEN-WAVE Optimization Package
Provides QUBO and QAOA implementations for traffic signal movement selection,
alongside classical exact, greedy, and simulated annealing baselines.
"""

from .movement_model import Movement, MovementRegistry, DEFAULT_MOVEMENTS, TrafficState, calculate_weights
from .conflict_graph import ConflictGraph, create_default_conflict_graph
from .qubo import QUBOFormulation
from .ising import IsingHamiltonian
from .feasibility import FeasibilityValidator
from .qaoa_circuit import QAOAQuantumCircuit, decode_bitstring
from .exact_solver import ExactMWISSolver
from .greedy_solver import GreedyMWISSolver
from .annealing_solver import SimulatedAnnealingSolver
from .qaoa_solver import QAOASolver, SolverResult
from .benchmark import BenchmarkRunner

__all__ = [
    "Movement",
    "MovementRegistry",
    "TrafficState",
    "calculate_weights",
    "ConflictGraph",
    "create_default_conflict_graph",
    "QUBOFormulation",
    "IsingHamiltonian",
    "FeasibilityValidator",
    "QAOAQuantumCircuit",
    "decode_bitstring",
    "ExactMWISSolver",
    "GreedyMWISSolver",
    "SimulatedAnnealingSolver",
    "QAOASolver",
    "SolverResult",
    "BenchmarkRunner",
]
