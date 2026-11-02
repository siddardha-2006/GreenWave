"""
controller.py
Deterministic Safety and Phase Controller for GREEN-WAVE.
Implements the core principle from README Section 1 & 8:
  "The optimizer proposes candidate vehicle-movement sets.
   A separate deterministic safety controller validates and schedules
   every signal transition. QAOA must never directly bypass pedestrian
   clearance, yellow/all-red intervals, conflict rules, or emergency-safe transitions."
"""

from typing import Dict, List, Optional, Set, Tuple
import logging
import numpy as np

from ..optimization.conflict_graph import ConflictGraph
from ..optimization.feasibility import FeasibilityValidator
from ..optimization.movement_model import MovementRegistry
from .phase_model import (
    EmergencyState,
    IntersectionSafetyState,
    PedestrianState,
    PhaseTimingConfig,
    PhaseType,
    SignalColor,
)

logger = logging.getLogger("greenwave.safety")


class SafetyController:
    """
    Independent deterministic safety and phase controller.
    Maintains signal state machine, schedules transitions, and enforces all safety invariants.
    """

    def __init__(
        self,
        conflict_graph: ConflictGraph,
        registry: MovementRegistry,
        config: Optional[PhaseTimingConfig] = None,
    ):
        self.conflict_graph = conflict_graph
        self.registry = registry
        self.config = config or PhaseTimingConfig()
        self.validator = FeasibilityValidator(conflict_graph)
        self.state = IntersectionSafetyState()

        # Mapping of pedestrian crosswalk approaches to conflicting vehicle movements
        # E.g., crossing North leg conflicts with movements entering/exiting North (M0, M3, M7, M10)
        self._ped_conflicts: Dict[str, Set[int]] = {
            "North": {0, 1, 2, 3, 7, 10},
            "South": {0, 3, 4, 5, 8, 11},
            "East":  {1, 4, 6, 7, 8, 9},
            "West":  {2, 5, 6, 9, 10, 11},
        }

    def request_pedestrian_crossing(self, approach: str = "North") -> None:
        """Submits a pedestrian crossing request (push-button)."""
        if self.state.pedestrian_state == PedestrianState.IDLE:
            self.state.pedestrian_state = PedestrianState.WAITING
            self.state.pedestrian_approach = approach
            logger.info("Pedestrian crossing requested for %s approach.", approach)

    def request_emergency_preemption(self, movement_id_or_idx, approach: Optional[str] = None) -> None:
        """Submits an emergency vehicle preemption request."""
        if isinstance(movement_id_or_idx, str):
            idx = self.registry.get_by_id(movement_id_or_idx).index
        else:
            idx = int(movement_id_or_idx)

        self.state.emergency_state = EmergencyState.APPROACHING
        self.state.emergency_movement = idx
        self.state.emergency_target_approach = approach or self.registry.get_by_index(idx).approach
        logger.info("Emergency vehicle detected requesting movement %s (%s).", 
                    self.registry.get_by_index(idx).id, self.state.emergency_target_approach)

    def step(
        self,
        candidate_movements: Optional[Set[int]],
        weights: np.ndarray,
        dt: float = 1.0,
    ) -> IntersectionSafetyState:
        """
        Advances the safety controller by time delta dt.
        Validates candidate movement proposals and coordinates safe state transitions.
        """
        self.state.time_in_phase += dt
        self.state.fallback_engaged = False
        self.state.rejection_reason = None

        # Process pedestrian state transitions
        if self.state.pedestrian_state in (PedestrianState.WALK, PedestrianState.CLEARANCE):
            self.state.pedestrian_timer += dt

        # Current phase handling
        if self.state.current_phase_type == PhaseType.VEHICLE_GREEN:
            self._handle_vehicle_green(candidate_movements, weights)

        elif self.state.current_phase_type == PhaseType.VEHICLE_YELLOW:
            self._handle_vehicle_yellow()

        elif self.state.current_phase_type == PhaseType.ALL_RED:
            self._handle_all_red(candidate_movements, weights)

        elif self.state.current_phase_type == PhaseType.PEDESTRIAN_WALK:
            self._handle_pedestrian_walk()

        elif self.state.current_phase_type == PhaseType.PEDESTRIAN_CLEARANCE:
            self._handle_pedestrian_clearance(weights)

        elif self.state.current_phase_type == PhaseType.EMERGENCY_GREEN:
            self._handle_emergency_green(candidate_movements, weights)

        return self.state

    def _handle_vehicle_green(self, candidate_movements: Optional[Set[int]], weights: np.ndarray) -> None:
        # Check if emergency preemption is pending
        if self.state.emergency_state == EmergencyState.APPROACHING:
            # If emergency movement is already green, stay green and elevate to active
            if self.state.emergency_movement in self.state.active_movements:
                self.state.emergency_state = EmergencyState.ACTIVE
                self.state.current_phase_type = PhaseType.EMERGENCY_GREEN
                self.state.time_in_phase = 0.0
                return
            else:
                # Emergency requires different movement -> initiate safe yellow transition
                self._transition_to_yellow(next_target=self._get_emergency_compatible_set())
                return

        # Check if pedestrian crossing is waiting and max green or min green elapsed
        if (self.state.pedestrian_state == PedestrianState.WAITING 
            and self.state.time_in_phase >= self.config.min_green_time):
            # Transition to yellow to yield to pedestrian crossing
            self._transition_to_yellow(next_target=set())
            return

        # Check max green expiration
        if self.state.time_in_phase >= self.config.max_green_time:
            # Force transition to candidate or next phase
            valid_cand = self._validate_and_sanitize_candidate(candidate_movements, weights)
            if valid_cand != self.state.active_movements:
                self._transition_to_yellow(next_target=valid_cand)
                return

        # Optimizer candidate change request
        if self.state.time_in_phase >= self.config.min_green_time and candidate_movements is not None:
            valid_cand = self._validate_and_sanitize_candidate(candidate_movements, weights)
            if valid_cand and valid_cand != self.state.active_movements:
                self._transition_to_yellow(next_target=valid_cand)

    def _handle_vehicle_yellow(self) -> None:
        target_yellow = self.config.emergency_yellow_time if self.state.emergency_state == EmergencyState.APPROACHING else self.config.yellow_time
        if self.state.time_in_phase >= target_yellow:
            self.state.current_phase_type = PhaseType.ALL_RED
            self.state.active_movements = set()
            self.state.yellow_for_movements = set()
            self.state.time_in_phase = 0.0

    def _handle_all_red(self, candidate_movements: Optional[Set[int]], weights: np.ndarray) -> None:
        target_all_red = self.config.emergency_all_red_time if self.state.emergency_state == EmergencyState.APPROACHING else self.config.all_red_time
        if self.state.time_in_phase >= target_all_red:
            # Priority 1: Pending Emergency Vehicle
            if self.state.emergency_state == EmergencyState.APPROACHING:
                emer_set = self._get_emergency_compatible_set()
                self.state.current_phase_type = PhaseType.EMERGENCY_GREEN
                self.state.active_movements = emer_set
                self.state.emergency_state = EmergencyState.ACTIVE
                self.state.time_in_phase = 0.0
                logger.info("Emergency green phase active for movements: %s", emer_set)
                return

            # Priority 2: Pending Pedestrian Request
            if self.state.pedestrian_state == PedestrianState.WAITING:
                self.state.current_phase_type = PhaseType.PEDESTRIAN_WALK
                self.state.pedestrian_state = PedestrianState.WALK
                self.state.pedestrian_timer = 0.0
                self.state.time_in_phase = 0.0
                self.state.active_movements = self._get_pedestrian_compatible_movements(self.state.pedestrian_approach)
                logger.info("Pedestrian WALK interval started for %s approach.", self.state.pedestrian_approach)
                return

            # Priority 3: Queued or Candidate Vehicle Phase
            next_mvs = self.state.queued_next_movements
            if next_mvs is None or len(next_mvs) == 0:
                next_mvs = self._validate_and_sanitize_candidate(candidate_movements, weights)

            self.state.current_phase_type = PhaseType.VEHICLE_GREEN
            self.state.active_movements = next_mvs
            self.state.queued_next_movements = None
            self.state.time_in_phase = 0.0
            if self.state.emergency_state == EmergencyState.RECOVERING:
                self.state.emergency_state = EmergencyState.NONE

    def _handle_pedestrian_walk(self) -> None:
        # Non-interruptible pedestrian WALK
        if self.state.pedestrian_timer >= self.config.ped_walk_time:
            self.state.current_phase_type = PhaseType.PEDESTRIAN_CLEARANCE
            self.state.pedestrian_state = PedestrianState.CLEARANCE
            self.state.pedestrian_timer = 0.0
            self.state.time_in_phase = 0.0
            logger.info("Pedestrian CLEARANCE interval started.")

    def _handle_pedestrian_clearance(self, weights: np.ndarray) -> None:
        # Non-interruptible pedestrian Clearance interval
        if self.state.pedestrian_timer >= self.config.ped_clearance_time:
            self.state.pedestrian_state = PedestrianState.IDLE
            self.state.pedestrian_timer = 0.0
            self.state.pedestrian_approach = None
            logger.info("Pedestrian clearance complete. Releasing crossing.")
            # Transition safely via ALL_RED
            self.state.current_phase_type = PhaseType.ALL_RED
            self.state.active_movements = set()
            self.state.time_in_phase = 0.0

    def _handle_emergency_green(self, candidate_movements: Optional[Set[int]], weights: np.ndarray) -> None:
        # Emergency vehicle passes after configured interval (e.g. 15s)
        if self.state.time_in_phase >= 15.0:
            logger.info("Emergency vehicle cleared. Entering recovery phase.")
            self.state.emergency_state = EmergencyState.RECOVERING
            self.state.emergency_movement = None
            self.state.emergency_target_approach = None
            self._transition_to_yellow(next_target=self._validate_and_sanitize_candidate(candidate_movements, weights))

    def _transition_to_yellow(self, next_target: Set[int]) -> None:
        self.state.current_phase_type = PhaseType.VEHICLE_YELLOW
        self.state.yellow_for_movements = set(self.state.active_movements)
        self.state.queued_next_movements = next_target
        self.state.time_in_phase = 0.0

    def _validate_and_sanitize_candidate(self, candidate: Optional[Set[int]], weights: np.ndarray) -> Set[int]:
        """Independent validator: verifies candidate against conflict graph and current safety state."""
        if not candidate:
            self.state.fallback_engaged = True
            self.state.rejection_reason = "Empty candidate proposed."
            fallback_bits = self.validator.get_safe_fallback(weights)
            return {i for i, b in enumerate(fallback_bits) if b == 1}

        # Check for vehicle-vehicle conflicts
        violations = self.validator.find_violations(candidate)
        if violations:
            self.state.fallback_engaged = True
            self.state.rejection_reason = f"Candidate contained conflicts: {violations}"
            logger.warning("REJECTED candidate containing conflicts: %s. Engaging fallback.", violations)
            fallback_bits = self.validator.get_safe_fallback(weights)
            return {i for i, b in enumerate(fallback_bits) if b == 1}

        # Check for pedestrian conflicts if active
        if self.state.pedestrian_state in (PedestrianState.WALK, PedestrianState.CLEARANCE):
            conflicting_ped_mvs = self._ped_conflicts.get(self.state.pedestrian_approach or "North", set())
            ped_violations = candidate.intersection(conflicting_ped_mvs)
            if ped_violations:
                self.state.fallback_engaged = True
                self.state.rejection_reason = f"Candidate conflicts with active pedestrian crossing: {ped_violations}"
                safe_cand = candidate - ped_violations
                if safe_cand:
                    return safe_cand
                fallback_bits = self.validator.get_safe_fallback(weights)
                return {i for i, b in enumerate(fallback_bits) if b == 1}

        return set(candidate)

    def _get_emergency_compatible_set(self) -> Set[int]:
        """Returns safe set containing the emergency vehicle's movement and any compatible right turns."""
        if self.state.emergency_movement is None:
            return set()
        em = self.state.emergency_movement
        result = {em}
        # Add compatible right turns
        for m in (2, 4, 7, 11):
            if not self.conflict_graph.has_conflict(em, m):
                result.add(m)
        return result

    def _get_pedestrian_compatible_movements(self, approach: Optional[str]) -> Set[int]:
        """Returns vehicle movements that do not cross the active pedestrian walk."""
        conflicts = self._ped_conflicts.get(approach or "North", set())
        all_movements = set(range(12))
        non_conflicting = all_movements - conflicts
        # Find maximal independent set among non_conflicting
        # E.g. for North pedestrian, East-West parallel movements (M6, M9) are non-conflicting!
        safe_set = set()
        for m in non_conflicting:
            compatible = True
            for s in safe_set:
                if self.conflict_graph.has_conflict(m, s):
                    compatible = False
                    break
            if compatible:
                safe_set.add(m)
        return safe_set

    def get_signal_colors(self) -> Dict[str, SignalColor]:
        """Returns signal colors (Green, Yellow, Red) for all 12 movements."""
        colors: Dict[str, SignalColor] = {}
        for m in self.registry.movements:
            if m.index in self.state.yellow_for_movements:
                colors[m.id] = SignalColor.YELLOW
            elif m.index in self.state.active_movements:
                colors[m.id] = SignalColor.GREEN
            else:
                colors[m.id] = SignalColor.RED
        return colors

