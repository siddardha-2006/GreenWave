"""
simulator.py
Simulation Engine and Intersection Dynamics for GREEN-WAVE.
Provides a realistic discrete-event intersection simulator with TraCI interface readiness.
Simulates Poisson vehicle arrivals, queue discharge under green intervals,
pedestrian calls, emergency vehicle approaches, and comprehensive metric collection.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set
import numpy as np

from ..optimization.movement_model import MovementRegistry, TrafficState
from ..safety.phase_model import EmergencyState, PedestrianState, SignalColor
from .scenarios import ScenarioConfig, AVAILABLE_SCENARIOS


@dataclass
class SimulationMetricsSnapshot:
    simulation_time: float
    queue_lengths: Dict[str, float]
    mean_waiting_time: float
    max_waiting_time: float
    throughput: int
    active_movements: List[str]
    signal_colors: Dict[str, str]
    pedestrian_state: str
    pedestrian_wait_time: float
    emergency_state: str
    emergency_delay: float


class IntersectionSimulator:
    """
    Simulates a 4-way intersection traffic environment.
    """

    def __init__(
        self,
        scenario: ScenarioConfig,
        registry: MovementRegistry,
        saturation_flow_rate: float = 0.55,  # vehicles discharged per second of green
        seed: int = 42,
    ):
        self.scenario = scenario
        self.registry = registry
        self.saturation_flow_rate = saturation_flow_rate
        self.rng = np.random.default_rng(seed)

        # Simulation state
        self.current_time = 0.0
        self.total_throughput = 0

        # Movement tracking: Movement ID -> list of arrival times for queued vehicles
        self._queues: Dict[str, List[float]] = {m.id: [] for m in registry.movements}
        # Emergency vehicle tracking
        self.emergency_arrival_time: Optional[float] = None
        self.emergency_cleared_time: Optional[float] = None
        self.pedestrian_request_time: Optional[float] = None

        # Surge multiplier
        self._surge_multiplier = 1.0
        self._surge_end_time = 0.0

    def step(
        self,
        signal_colors: Dict[str, SignalColor],
        pedestrian_state: PedestrianState,
        emergency_state: EmergencyState,
        dt: float = 1.0,
    ) -> None:
        """Advances simulation by time step dt."""
        self.current_time += dt

        # 1. Check for scheduled events (surges, etc.)
        for event in self.scenario.scheduled_events:
            event_time = event["time"]
            if abs(self.current_time - event_time) < (dt / 2.0):
                if event["type"] == "surge":
                    self._surge_multiplier = event.get("multiplier", 2.0)
                    self._surge_end_time = self.current_time + event.get("duration", 60.0)

        if self.current_time > self._surge_end_time:
            self._surge_multiplier = 1.0

        # 2. Simulate vehicle arrivals
        for m in self.registry.movements:
            base_rate = self.scenario.arrival_rates.get(m.id, 0.05)
            effective_rate = base_rate * self._surge_multiplier
            # Poisson arrival count in time dt
            arrivals = self.rng.poisson(effective_rate * dt)
            for _ in range(arrivals):
                self._queues[m.id].append(self.current_time)

        # 3. Simulate queue discharge for green signals
        for m in self.registry.movements:
            color = signal_colors.get(m.id, SignalColor.RED)
            if color == SignalColor.GREEN and len(self._queues[m.id]) > 0:
                # Discharge probability or integer discharge count
                discharges = self.rng.binomial(len(self._queues[m.id]), min(self.saturation_flow_rate * dt, 1.0))
                discharges = max(1 if self.rng.random() < (self.saturation_flow_rate * dt) else 0, discharges)
                discharged_count = min(discharges, len(self._queues[m.id]))
                if discharged_count > 0:
                    del self._queues[m.id][:discharged_count]
                    self.total_throughput += discharged_count

        # 4. Emergency vehicle tracking
        if emergency_state == EmergencyState.APPROACHING and self.emergency_arrival_time is None:
            self.emergency_arrival_time = self.current_time
        elif emergency_state in (EmergencyState.ACTIVE, EmergencyState.RECOVERING) and self.emergency_arrival_time is not None:
            if self.emergency_cleared_time is None:
                self.emergency_cleared_time = self.current_time

    def get_traffic_state(self) -> TrafficState:
        """Returns TrafficState snapshot containing current queues and waiting times."""
        q_lengths: Dict[str, float] = {}
        w_times: Dict[str, float] = {}

        for m_id, queue in self._queues.items():
            q_lengths[m_id] = float(len(queue))
            if len(queue) > 0:
                # Wait time of the longest waiting vehicle in queue
                w_times[m_id] = round(self.current_time - queue[0], 1)
            else:
                w_times[m_id] = 0.0

        return TrafficState(
            queue_lengths=q_lengths,
            predicted_queues={},  # Populated by predictor
            waiting_times=w_times,
        )

    def get_metrics_snapshot(
        self,
        signal_colors: Dict[str, SignalColor],
        active_movements: List[str],
        pedestrian_state: PedestrianState,
        emergency_state: EmergencyState,
    ) -> SimulationMetricsSnapshot:
        """Computes comprehensive performance metrics snapshot."""
        all_waits: List[float] = []
        q_map: Dict[str, float] = {}

        for m_id, q in self._queues.items():
            q_map[m_id] = float(len(q))
            for arrival_t in q:
                all_waits.append(self.current_time - arrival_t)

        mean_wait = float(np.mean(all_waits)) if all_waits else 0.0
        max_wait = float(np.max(all_waits)) if all_waits else 0.0

        # Emergency delay
        emer_delay = 0.0
        if self.emergency_arrival_time is not None:
            end_t = self.emergency_cleared_time or self.current_time
            emer_delay = round(end_t - self.emergency_arrival_time, 1)

        # Pedestrian wait
        ped_wait = 0.0
        if pedestrian_state == PedestrianState.WAITING and self.pedestrian_request_time is not None:
            ped_wait = round(self.current_time - self.pedestrian_request_time, 1)

        return SimulationMetricsSnapshot(
            simulation_time=round(self.current_time, 1),
            queue_lengths=q_map,
            mean_waiting_time=round(mean_wait, 2),
            max_waiting_time=round(max_wait, 2),
            throughput=self.total_throughput,
            active_movements=active_movements,
            signal_colors={k: v.value for k, v in signal_colors.items()},
            pedestrian_state=pedestrian_state.value,
            pedestrian_wait_time=ped_wait,
            emergency_state=emergency_state.value,
            emergency_delay=emer_delay,
        )

