"""
phase_model.py
Signal phase, interval, and pedestrian/emergency state models for GREEN-WAVE.
Implements the safety state machine specified in README Section 8.
"""

from enum import Enum
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set


class SignalColor(str, Enum):
    GREEN = "green"
    YELLOW = "yellow"
    RED = "red"


class PedestrianState(str, Enum):
    IDLE = "idle"
    WAITING = "waiting"
    WALK = "walk"
    CLEARANCE = "clearance"


class EmergencyState(str, Enum):
    NONE = "none"
    APPROACHING = "approaching"
    PREEMPTING = "preempting"
    ACTIVE = "active"
    RECOVERING = "recovering"


class PhaseType(str, Enum):
    IDLE = "idle"
    VEHICLE_GREEN = "vehicle_green"
    VEHICLE_YELLOW = "vehicle_yellow"
    ALL_RED = "all_red"
    PEDESTRIAN_WALK = "pedestrian_walk"
    PEDESTRIAN_CLEARANCE = "pedestrian_clearance"
    EMERGENCY_GREEN = "emergency_green"


@dataclass
class PhaseTimingConfig:
    """Configurable timing parameters in seconds."""
    min_green_time: float = 6.0
    max_green_time: float = 40.0
    yellow_time: float = 4.0       # 4.0s yellow warning clearance
    all_red_time: float = 3.5      # 3.5s all-red intersection clearance delay between phases
    emergency_yellow_time: float = 1.5  # Accelerated 1.5s yellow transition for EV preemption
    emergency_all_red_time: float = 1.0 # Rapid 1.0s all-red clearance for EV preemption
    ped_walk_time: float = 7.0
    ped_clearance_time: float = 8.0
    time_step: float = 1.0


@dataclass
class IntersectionSafetyState:
    """Snapshot of current safety controller state."""
    current_phase_type: PhaseType = PhaseType.ALL_RED
    active_movements: Set[int] = field(default_factory=set)
    time_in_phase: float = 0.0
    yellow_for_movements: Set[int] = field(default_factory=set)
    pedestrian_state: PedestrianState = PedestrianState.IDLE
    pedestrian_approach: Optional[str] = None
    pedestrian_timer: float = 0.0
    emergency_state: EmergencyState = EmergencyState.NONE
    emergency_movement: Optional[int] = None
    emergency_target_approach: Optional[str] = None
    queued_next_movements: Optional[Set[int]] = None
    fallback_engaged: bool = False
    rejection_reason: Optional[str] = None

