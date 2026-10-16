import numpy as np
from typing import Dict, Any, List, Optional, Tuple

class CausalKalmanFilter:
    """
    Stage 2: Causal State-Space Estimator (2-State Kalman Filter)
    Estimates latent physiological recovery deviation d_t and uncertainty sd_t.
    Handles multi-sensor telemetry fusion (HR, HRV, Steps, Sleep) and missing packets.
    """
    def __init__(self, rho: float = 0.875, sigma_w_sq: float = 0.0945):
        self.rho = rho
        # Transition Matrix A: [ [rho, 0], [1.0, 0] ]
        self.A = np.array([[self.rho, 0.0], [1.0, 0.0]], dtype=float)
        # Process Noise Covariance Q
        self.Q = np.array([[sigma_w_sq, 0.0], [0.0, 0.0]], dtype=float)
        # Observation Matrix C: maps [d_t, d_{t-1}] to [HR diff, HRV diff, Steps norm, Sleep diff]
        self.C = np.array([
            [0.0, -3.5],
            [0.0, +5.0],
            [0.0, +0.15],
            [0.0, +0.06]
        ], dtype=float)
        # Observation Noise Covariance R
        self.R = np.diag([1.5**2, 2.0**2, 0.04**2, 0.02**2]).astype(float)

    def filter_trajectory(
        self, 
        daily_readings: List[Dict[str, Any]], 
        baseline: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Runs Kalman filtering up to day t without future leakage.
        """
        x = np.array([0.0, 0.0], dtype=float)
        P = np.eye(2, dtype=float) * 0.5
        
        hr_0 = baseline["hr_0"]
        hrv_0 = baseline["hrv_0"]
        steps_0 = max(baseline["steps_0"], 100.0)
        sleep_0 = baseline["sleep_0"]

        history = []
        d_history = []

        for entry in daily_readings:
            day = entry.get("day", 0)
            
            # Prediction Step
            x_pred = self.A @ x
            P_pred = self.A @ P @ self.A.T + self.Q

            hr = entry.get("resting_hr")
            # Missing sensor check
            if hr is None or np.isnan(hr):
                x = x_pred
                P = P_pred
                sd_t = float(np.sqrt(P[0, 0]))
                d_history.append(float(x[0]))
                history.append({
                    "day": day,
                    "d_t": round(float(x[0]), 4),
                    "sd_t": round(sd_t, 4),
                    "is_missing": True,
                    "drift_rate": self._compute_drift(d_history)
                })
                continue

            # Multi-sensor observation vector
            hrv = entry.get("hrv", hrv_0)
            steps = entry.get("steps", steps_0)
            sleep = entry.get("sleep_hours", sleep_0)

            y = np.array([
                hr - hr_0,
                hrv - hrv_0,
                (steps - steps_0) / steps_0,
                sleep - sleep_0
            ], dtype=float)

            # Measurement Update Step
            S = self.C @ P_pred @ self.C.T + self.R
            K = P_pred @ self.C.T @ np.linalg.inv(S)
            y_pred = self.C @ x_pred
            x = x_pred + K @ (y - y_pred)
            P = (np.eye(2) - K @ self.C) @ P_pred

            sd_t = float(np.sqrt(P[0, 0]))
            d_t = float(x[0])
            d_history.append(d_t)

            history.append({
                "day": day,
                "d_t": round(d_t, 4),
                "sd_t": round(sd_t, 4),
                "is_missing": False,
                "drift_rate": self._compute_drift(d_history)
            })

        return history

    def _compute_drift(self, d_history: List[float]) -> float:
        if len(d_history) < 3:
            return 0.0
        return round((d_history[-1] - d_history[-3]) / 2.0, 4)
