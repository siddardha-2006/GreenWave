"""
experiment.py
Pydantic Schemas for API contracts and database documents.
Implements the contracts from README Section 13 & 14.
"""

from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class QAOAConfigSchema(BaseModel):
    p: int = Field(default=1, ge=1, le=5)
    shots: int = Field(default=2048, ge=100, le=10000)
    optimizer: str = Field(default="COBYLA")


class ExperimentCreateSchema(BaseModel):
    name: str
    scenario_id: str = "balanced_peak"
    seed: int = 42
    controller: str = "qaoa"  # "qaoa", "exact", "greedy", "simulated_annealing"
    qaoa: Optional[QAOAConfigSchema] = None
    config_version: str = "v1"


class ExperimentResponseSchema(BaseModel):
    id: str
    name: str
    scenario_id: str
    seed: int
    status: str  # "queued", "running", "stopping", "completed", "failed", "cancelled"
    controller: str
    qaoa: Optional[QAOAConfigSchema] = None
    config_version: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    current_simulation_time: float = 0.0


class SimulationMetricsSchema(BaseModel):
    experiment_id: str
    simulation_time: float
    queue_lengths: Dict[str, float]
    mean_waiting_time: float
    max_waiting_time: float
    throughput: int
    active_movements: List[str]
    signal_colors: Dict[str, str]
    pedestrian_state: str
    emergency_state: str
    pedestrian_wait_time: float = 0.0
    emergency_delay: float = 0.0


class SolverResultSchema(BaseModel):
    experiment_id: str
    simulation_time: float
    solver: str
    objective_reward: float
    qubo_energy: float
    bitstring: str
    active_movements: List[str]
    feasible: bool
    valid_sample_rate: float
    runtime_ms: float
    fallback_used: bool
    approximation_ratio: Optional[float] = None


class ScenarioInfoSchema(BaseModel):
    id: str
    name: str
    description: str
    duration_seconds: float

