"""
baseline_predictor.py
Predictive traffic queue baseline model for GREEN-WAVE.
Implements the predictive traffic model specified in README Section 9:
  - Tracks rolling queue counts and arrival rates per movement.
  - Predicts near-future queue lengths and arrivals at 30s and 60s horizons.
  - Feeds predicted values into movement priority weights.
"""

from collections import deque
from dataclasses import dataclass, field
from typing import Dict, List, Optional
import numpy as np


@dataclass
class PredictionSnapshot:
    horizon_seconds: float
    predicted_queues: Dict[str, float]
    predicted_arrivals: Dict[str, float]


class BaselinePredictor:
    """
    Exponential Moving Average (EMA) and arrival-rate trend queue predictor.
    Maintains a rolling window of recent queue observations and estimates future demand.
    """

    def __init__(
        self,
        window_size: int = 30,
        ema_alpha: float = 0.3,
        primary_horizon: float = 30.0,
        secondary_horizon: float = 60.0,
    ):
        self.window_size = window_size
        self.ema_alpha = ema_alpha
        self.primary_horizon = primary_horizon
        self.secondary_horizon = secondary_horizon

        # Movement ID -> deque of (timestamp, queue_length)
        self._history: Dict[str, deque] = {}
        # Movement ID -> smoothed arrival rate (vehicles/sec)
        self._ema_queues: Dict[str, float] = {}
        self._arrival_rates: Dict[str, float] = {}

    def update(self, simulation_time: float, current_queues: Dict[str, float]) -> None:
        """Records a new observation of queue lengths across all movements."""
        for m_id, q in current_queues.items():
            if m_id not in self._history:
                self._history[m_id] = deque(maxlen=self.window_size)
                self._ema_queues[m_id] = float(q)
                self._arrival_rates[m_id] = 0.0

            hist = self._history[m_id]
            hist.append((simulation_time, float(q)))

            # Update EMA queue
            old_ema = self._ema_queues[m_id]
            new_ema = self.ema_alpha * float(q) + (1.0 - self.ema_alpha) * old_ema
            self._ema_queues[m_id] = new_ema

            # Compute trend / arrival rate from rolling window
            if len(hist) >= 2:
                t_old, q_old = hist[0]
                dt = max(simulation_time - t_old, 1.0)
                dq = max(0.0, float(q) - q_old)
                self._arrival_rates[m_id] = dq / dt

    def predict(self, horizon: Optional[float] = None) -> Dict[str, float]:
        """
        Predicts queue lengths at specified horizon (default 30 seconds).
        Returns Dict[movement_id, predicted_queue].
        """
        h = horizon or self.primary_horizon
        predictions: Dict[str, float] = {}

        for m_id, current_ema in self._ema_queues.items():
            rate = self._arrival_rates.get(m_id, 0.0)
            # Projected queue = smoothed current queue + expected arrivals over horizon
            projected = current_ema + rate * h
            predictions[m_id] = round(max(0.0, projected), 2)

        return predictions

    def get_full_predictions(self) -> Dict[str, PredictionSnapshot]:
        """Returns predictions for both 30s and 60s forecast horizons."""
        return {
            "30s": PredictionSnapshot(
                horizon_seconds=30.0,
                predicted_queues=self.predict(30.0),
                predicted_arrivals={m: round(self._arrival_rates.get(m, 0.0) * 30.0, 2) for m in self._ema_queues},
            ),
            "60s": PredictionSnapshot(
                horizon_seconds=60.0,
                predicted_queues=self.predict(60.0),
                predicted_arrivals={m: round(self._arrival_rates.get(m, 0.0) * 60.0, 2) for m in self._ema_queues},
            ),
        }

