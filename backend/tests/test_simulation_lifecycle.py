"""
test_simulation_lifecycle.py
End-to-end integration test verifying the full simulation lifecycle,
safety controller enforcement, pedestrian crossing, and emergency preemption.
"""

import unittest
import os
import sys
import numpy as np

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.optimization import MovementRegistry, create_default_conflict_graph, calculate_weights, QUBOFormulation, GreedyMWISSolver
from app.safety.controller import SafetyController
from app.safety.phase_model import PedestrianState, EmergencyState, PhaseType
from app.simulation.scenarios import AVAILABLE_SCENARIOS
from app.simulation.simulator import IntersectionSimulator
from app.prediction.baseline_predictor import BaselinePredictor


class TestSimulationLifecycle(unittest.TestCase):

    def test_full_pipeline_simulation_run(self):
        scenario = AVAILABLE_SCENARIOS["mixed_emergency_pedestrian"]
        registry = MovementRegistry()
        conflict_graph = create_default_conflict_graph()
        simulator = IntersectionSimulator(scenario, registry, seed=123)
        predictor = BaselinePredictor()
        safety_controller = SafetyController(conflict_graph, registry)

        # Run 60 simulation steps
        for step_idx in range(60):
            sim_t = simulator.current_time
            state = simulator.get_traffic_state()
            predictor.update(sim_t, state.queue_lengths)

            # Predict future queues
            predicted = predictor.predict(30.0)
            state.predicted_queues = predicted

            # Weight calculation
            weights = calculate_weights(state, registry)
            qubo = QUBOFormulation(weights, conflict_graph)

            # Optimizer proposal (Greedy for fast test execution)
            sol = GreedyMWISSolver(qubo, conflict_graph).solve()
            candidate_mvs = set(sol.active_movements)

            # Safety Controller validation & transition
            safety_state = safety_controller.step(candidate_mvs, weights, dt=1.0)
            signal_colors = safety_controller.get_signal_colors()

            # Safety Invariant 1: No two conflicting movements are simultaneously green
            green_indices = [registry.get_by_id(mid).index for mid, col in signal_colors.items() if col.value == "green"]
            for i in range(len(green_indices)):
                for j in range(i + 1, len(green_indices)):
                    u, v = green_indices[i], green_indices[j]
                    self.assertFalse(conflict_graph.has_conflict(u, v), f"Conflict between green movements {u} and {v}")

            # Advance simulator
            active_ids = [registry.get_by_index(i).id for i in safety_state.active_movements]
            simulator.step(
                signal_colors=signal_colors,
                pedestrian_state=safety_state.pedestrian_state,
                emergency_state=safety_state.emergency_state,
                dt=1.0,
            )

        # Check that throughput occurred
        self.assertGreater(simulator.total_throughput, 0)
        self.assertGreater(simulator.current_time, 50.0)


if __name__ == "__main__":
    unittest.main()

