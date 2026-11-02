"""
movement_model.py
Authoritative Movement Registry and Priority Weight Calculation for GREEN-WAVE.
Implements the 12-movement 4-way intersection model specified in Section 4 & 5.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
import numpy as np


@dataclass(frozen=True)
class Movement:
    """Represents a single directed vehicle movement at the intersection."""
    index: int                  # 0 to 11
    id: str                     # "M0" to "M11"
    name: str                   # "N-S", "N-E", etc.
    approach: str               # "North", "South", "East", "West"
    exit_direction: str         # "South", "East", "West", "North"
    movement_type: str          # "through", "left", "right"
    description: str


# Authoritative 12-movement registry as defined in README Section 4
DEFAULT_MOVEMENTS: List[Movement] = [
    Movement(0, "M0", "N-S", "North", "South", "through", "North approach to south exit (Through)"),
    Movement(1, "M1", "N-E", "North", "East",  "left",    "North approach to east exit (Left turn)"),
    Movement(2, "M2", "N-W", "North", "West",  "right",   "North approach to west exit (Right turn)"),
    Movement(3, "M3", "S-N", "South", "North", "through", "South approach to north exit (Through)"),
    Movement(4, "M4", "S-E", "South", "East",  "right",   "South approach to east exit (Right turn)"),
    Movement(5, "M5", "S-W", "South", "West",  "left",    "South approach to west exit (Left turn)"),
    Movement(6, "M6", "E-W", "East",  "West",  "through", "East approach to west exit (Through)"),
    Movement(7, "M7", "E-N", "East",  "North", "right",   "East approach to north exit (Right turn)"),
    Movement(8, "M8", "E-S", "East",  "South", "left",    "East approach to south exit (Left turn)"),
    Movement(9, "M9", "W-E", "West",  "East",  "through", "West approach to east exit (Through)"),
    Movement(10, "M10", "W-N", "West", "North", "left",   "West approach to north exit (Left turn)"),
    Movement(11, "M11", "W-S", "West", "South", "right",  "West approach to south exit (Right turn)"),
]


class MovementRegistry:
    """Registry providing indexed and keyed access to movements."""
    
    def __init__(self, movements: Optional[List[Movement]] = None):
        self._movements = movements or DEFAULT_MOVEMENTS
        self._by_id: Dict[str, Movement] = {m.id: m for m in self._movements}
        self._by_index: Dict[int, Movement] = {m.index: m for m in self._movements}
        self.num_movements = len(self._movements)

    def get_by_id(self, m_id: str) -> Movement:
        if m_id not in self._by_id:
            raise KeyError(f"Movement '{m_id}' not found in registry.")
        return self._by_id[m_id]

    def get_by_index(self, idx: int) -> Movement:
        if idx not in self._by_index:
            raise IndexError(f"Movement index {idx} out of range [0, {self.num_movements - 1}].")
        return self._by_index[idx]

    @property
    def movements(self) -> List[Movement]:
        return list(self._movements)

    @property
    def ids(self) -> List[str]:
        return [m.id for m in self._movements]


@dataclass
class TrafficState:
    """
    Traffic state snapshot at a decision point.
    Q: Current queue lengths per movement
    Q_pred: Predicted queue lengths (near-future 30-60s)
    W: Waiting time / starvation measure per movement
    """
    queue_lengths: Dict[str, float] = field(default_factory=dict)
    predicted_queues: Dict[str, float] = field(default_factory=dict)
    waiting_times: Dict[str, float] = field(default_factory=dict)


def calculate_weights(
    traffic_state: TrafficState,
    registry: Optional[MovementRegistry] = None,
    alpha: float = 1.0,
    beta: float = 0.5,
    gamma: float = 0.5,
    min_weight: float = 0.1,
) -> np.ndarray:
    """
    Calculates normalized non-negative priority weights:
    w_i = alpha * Q_i + beta * Q_hat_i + gamma * W_i
    
    Returns:
        np.ndarray of shape (num_movements,) with non-negative weights w_i.
    """
    reg = registry or MovementRegistry()
    n = reg.num_movements
    weights = np.zeros(n, dtype=float)

    for i, m in enumerate(reg.movements):
        q = traffic_state.queue_lengths.get(m.id, 0.0)
        q_pred = traffic_state.predicted_queues.get(m.id, 0.0)
        w_time = traffic_state.waiting_times.get(m.id, 0.0)

        # Combined raw weight
        raw_w = alpha * q + beta * q_pred + gamma * w_time
        # Ensure strictly positive minimum weight so empty queues still have valid optimization baseline
        weights[i] = max(raw_w, min_weight)

    return weights

