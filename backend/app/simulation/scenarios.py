"""
scenarios.py
Traffic demand and event scenario configurations for GREEN-WAVE.
Implements the minimum scenarios specified in README Section 10:
  1. Low traffic
  2. Balanced peak traffic
  3. One-direction-heavy traffic
  4. Sudden traffic surge
  5. Emergency vehicle approach
  6. Pedestrian crossing demand
  7. Mixed emergency + pedestrian demand
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class ScenarioConfig:
    id: str
    name: str
    description: str
    duration_seconds: float = 300.0
    # Base arrival rates (vehicles/second) per movement
    arrival_rates: Dict[str, float] = field(default_factory=dict)
    # Timed events: (timestamp, event_type, metadata)
    scheduled_events: List[Dict[str, any]] = field(default_factory=list)


AVAILABLE_SCENARIOS: Dict[str, ScenarioConfig] = {
    "balanced_peak": ScenarioConfig(
        id="balanced_peak",
        name="Balanced Peak Traffic",
        description="High symmetrical demand across North, South, East, and West approaches.",
        duration_seconds=300.0,
        arrival_rates={
            "M0": 0.25, "M1": 0.08, "M2": 0.05,  # North
            "M3": 0.25, "M4": 0.05, "M5": 0.08,  # South
            "M6": 0.22, "M7": 0.05, "M8": 0.07,  # East
            "M9": 0.22, "M10": 0.07, "M11": 0.05 # West
        },
        scheduled_events=[
            {"time": 60.0, "type": "pedestrian_request", "approach": "North"},
            {"time": 180.0, "type": "pedestrian_request", "approach": "East"},
        ]
    ),
    "one_direction_heavy": ScenarioConfig(
        id="one_direction_heavy",
        name="One-Direction-Heavy Corridor",
        description="Heavy commuter corridor along North-South with light cross-traffic.",
        duration_seconds=300.0,
        arrival_rates={
            "M0": 0.40, "M1": 0.12, "M2": 0.08,  # North heavy
            "M3": 0.38, "M4": 0.08, "M5": 0.10,  # South heavy
            "M6": 0.05, "M7": 0.02, "M8": 0.02,  # East light
            "M9": 0.06, "M10": 0.02, "M11": 0.02 # West light
        },
        scheduled_events=[
            {"time": 120.0, "type": "emergency_vehicle", "movement": "M0", "approach": "North"},
        ]
    ),
    "low_traffic": ScenarioConfig(
        id="low_traffic",
        name="Low Off-Peak Traffic",
        description="Sparse demand across all movements suitable for quick convergence checks.",
        duration_seconds=200.0,
        arrival_rates={m: 0.04 for m in [f"M{i}" for i in range(12)]},
        scheduled_events=[]
    ),
    "sudden_surge": ScenarioConfig(
        id="sudden_surge",
        name="Sudden Traffic Surge",
        description="Moderate initial demand followed by a sudden spike at t=60s.",
        duration_seconds=300.0,
        arrival_rates={
            "M0": 0.10, "M1": 0.03, "M2": 0.02,
            "M3": 0.10, "M4": 0.02, "M5": 0.03,
            "M6": 0.08, "M7": 0.02, "M8": 0.03,
            "M9": 0.08, "M10": 0.03, "M11": 0.02
        },
        scheduled_events=[
            {"time": 60.0, "type": "surge", "multiplier": 3.0, "duration": 90.0},
            {"time": 120.0, "type": "pedestrian_request", "approach": "West"},
        ]
    ),
    "emergency_approach": ScenarioConfig(
        id="emergency_approach",
        name="Emergency Vehicle Preemption",
        description="Ambulance or Fire Truck requires rapid preemption through the intersection.",
        duration_seconds=250.0,
        arrival_rates={
            "M0": 0.18, "M1": 0.06, "M2": 0.04,
            "M3": 0.18, "M4": 0.04, "M5": 0.06,
            "M6": 0.15, "M7": 0.04, "M8": 0.05,
            "M9": 0.15, "M10": 0.05, "M11": 0.04
        },
        scheduled_events=[
            {"time": 45.0, "type": "emergency_vehicle", "movement": "M3", "approach": "South"},
            {"time": 150.0, "type": "emergency_vehicle", "movement": "M6", "approach": "East"},
        ]
    ),
    "pedestrian_demand": ScenarioConfig(
        id="pedestrian_demand",
        name="High Pedestrian Demand",
        description="Frequent pedestrian crossing requests testing non-interruptible WALK/clearance safety.",
        duration_seconds=300.0,
        arrival_rates={m: 0.12 for m in [f"M{i}" for i in range(12)]},
        scheduled_events=[
            {"time": 30.0, "type": "pedestrian_request", "approach": "North"},
            {"time": 90.0, "type": "pedestrian_request", "approach": "South"},
            {"time": 160.0, "type": "pedestrian_request", "approach": "East"},
            {"time": 220.0, "type": "pedestrian_request", "approach": "West"},
        ]
    ),
    "mixed_emergency_pedestrian": ScenarioConfig(
        id="mixed_emergency_pedestrian",
        name="Mixed Emergency + Pedestrian Stress Test",
        description="Emergency vehicle arrives while a pedestrian crossing is active (critical safety test).",
        duration_seconds=300.0,
        arrival_rates={m: 0.15 for m in [f"M{i}" for i in range(12)]},
        scheduled_events=[
            {"time": 40.0, "type": "pedestrian_request", "approach": "North"},
            {"time": 44.0, "type": "emergency_vehicle", "movement": "M0", "approach": "North"},  # Emergency during ped walk
            {"time": 160.0, "type": "pedestrian_request", "approach": "East"},
            {"time": 165.0, "type": "emergency_vehicle", "movement": "M6", "approach": "East"},
        ]
    ),
}

