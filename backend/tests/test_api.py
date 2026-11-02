"""
test_api.py
Direct unit & integration tests for FastAPI REST API endpoints and simulation workflows.
"""

import unittest
import os
import sys

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.api.routes import (
    health_check,
    list_scenarios,
    create_experiment,
    list_experiments,
    get_experiment,
    get_config,
    get_quantum_circuit_info,
    simulate_quantum_circuit,
    QuantumSimulateRequest,
)
from app.schemas import ExperimentCreateSchema, QAOAConfigSchema


class TestFastAPIEndpoints(unittest.TestCase):

    def test_health_check(self):
        data = health_check()
        self.assertIn("status", data)
        self.assertIn("database", data)
        self.assertEqual(data["status"], "healthy")

    def test_list_scenarios(self):
        scenarios = list_scenarios()
        self.assertIsInstance(scenarios, list)
        self.assertGreaterEqual(len(scenarios), 5)
        scenario_ids = [s.id for s in scenarios]
        self.assertIn("balanced_peak", scenario_ids)
        self.assertIn("mixed_emergency_pedestrian", scenario_ids)

    def test_create_and_get_experiment(self):
        payload = ExperimentCreateSchema(
            name="direct-test-qaoa",
            scenario_id="balanced_peak",
            seed=42,
            controller="qaoa",
            qaoa=QAOAConfigSchema(p=1, shots=512, optimizer="COBYLA"),
        )
        created = create_experiment(payload)
        self.assertEqual(created.name, "direct-test-qaoa")
        self.assertEqual(created.status, "queued")
        self.assertIsNotNone(created.id)

        # Get experiment
        exp_id = created.id
        fetched = get_experiment(exp_id)
        self.assertEqual(fetched.id, exp_id)
        self.assertEqual(fetched.scenario_id, "balanced_peak")

    def test_get_config(self):
        cfg = get_config()
        self.assertIn("decision_interval", cfg)
        self.assertIn("default_qaoa_shots", cfg)
        self.assertGreater(cfg["decision_interval"], 0)

    def test_get_latest_state(self):
        payload = ExperimentCreateSchema(
            name="test-latest-state",
            scenario_id="balanced_peak",
            seed=42,
            controller="greedy",
        )
        created = create_experiment(payload)
        from app.api.routes import get_latest_state
        res = get_latest_state(created.id)
        self.assertIn("experiment", res)
        self.assertEqual(res["experiment"]["id"], created.id)


    def test_get_quantum_circuit_info(self):
        info = get_quantum_circuit_info(p=1, gamma=0.5, beta=0.3, scenario_id="balanced_peak")
        self.assertEqual(info["num_qubits"], 12)
        self.assertEqual(info["p"], 1)
        self.assertEqual(len(info["qubits"]), 12)
        self.assertEqual(len(info["conflict_edges"]), 28)
        self.assertGreater(info["depth"], 0)
        self.assertGreater(info["total_gates"], 0)
        self.assertEqual(info["gate_counts"].get("cx"), 56)  # 28 edges * 2 CX
        self.assertIn("OPENQASM", info["qasm"])
        self.assertTrue(len(info["ascii_diagram"]) > 50)
        self.assertIsNotNone(info["exact_optimum"])
        self.assertIn("reward", info["exact_optimum"])

    def test_simulate_quantum_circuit(self):
        payload = QuantumSimulateRequest(
            p=1,
            gammas=[0.5],
            betas=[0.3],
            shots=256,
            scenario_id="balanced_peak",
        )
        sim_res = simulate_quantum_circuit(payload)
        self.assertEqual(sim_res["shots"], 256)
        self.assertGreaterEqual(sim_res["feasible_shots"], 0)
        self.assertGreaterEqual(sim_res["valid_sample_rate"], 0.0)
        self.assertLessEqual(sim_res["valid_sample_rate"], 1.0)
        self.assertGreater(sim_res["runtime_ms"], 0.0)
        self.assertIn("top_samples", sim_res)
        self.assertTrue(len(sim_res["top_samples"]) > 0)


if __name__ == "__main__":
    unittest.main()
