"""
Stage 3 Calibrated Risk Forecaster for Digital Twin Runtime Serving

Loads trained model weights and Platt scaling calibration from twin/model.json.
Uses shared 15-feature causal pipeline defined in twin.features to score patient trajectories
and generates forward projection uncertainty cones.
"""

import os
import json
from typing import Dict, Any, List, Optional
import numpy as np

from twin.features import FEATURE_NAMES, build_feature_rows, standardize_and_clip, score_logistic

REQUIRED_EHR_FIELDS = [
    "age",
    "lvef",
    "diabetes",
    "hba1c",
    "egfr",
    "family_history_cad",
    "smoker"
]

class RiskForecaster:
    """
    Stage 3: Calibrated 7-Day Readmission Risk Forecaster.
    Pure-NumPy serving implementation backed by twin/model.json.
    """

    def __init__(self, model_path: Optional[str] = None):
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), "model.json")
        with open(model_path, "r") as f:
            self.model = json.load(f)

        if self.model.get("feature_names") != FEATURE_NAMES:
            raise ValueError(
                f"Model feature names do not match expected FEATURE_NAMES: "
                f"{self.model.get('feature_names')} != {FEATURE_NAMES}"
            )

        self.feature_names = self.model["feature_names"]
        self.mean = np.array(self.model["mean"], dtype=float)
        self.std = np.array(self.model["std"], dtype=float)
        self.weights = np.array(self.model["weights"], dtype=float)
        self.intercept = float(self.model["intercept"])
        self.platt_a = float(self.model["platt_a"])
        self.platt_b = float(self.model["platt_b"])
        self.clip = float(self.model.get("clip", 4.0))
        self.version = self.model.get("version", "2.0.0")
        self.trained_on = self.model.get("trained_on", "synthetic")

        self.dt_idx = self.feature_names.index("d_t")

    def score_patient_days(
        self,
        patient_static: Dict[str, Any],
        readings: List[Dict[str, Any]],
        baseline: Dict[str, Any],
        kalman_states: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Scores patient trajectory across all valid telemetry days.
        Requires all specified EHR fields; missing EHR fields raise ValueError.
        Returns a list of {"day": t, "p50": float, "x_raw": list} for valid days only.
        """
        for field in REQUIRED_EHR_FIELDS:
            if field not in patient_static or patient_static[field] is None:
                raise ValueError(f"Missing required EHR field: '{field}'")

        patient_dict = dict(patient_static)
        patient_dict["daily_readings"] = readings

        feature_rows = build_feature_rows(patient_dict, baseline, kalman_states)
        scored_days = []
        for row in feature_rows:
            p50 = float(score_logistic(row["x"], self.model))
            scored_days.append({
                "day": row["day"],
                "p50": p50,
                "x_raw": row["x"]
            })
        return scored_days

    def risk_cone(
        self,
        x_raw: List[float],
        d_t: float,
        sd_t: float,
        drift_rate: float,
        horizon_days: int = 7
    ) -> Dict[str, Any]:
        """
        Computes calibrated P10, P50, P90 risk probability and forward 7-day projection cone.

        Note: forward_cone is a scenario projection assuming the current drift trend continues.
        This is NOT the probability of readmission on day k. It projects what the 7-day readmission
        risk probability would be scored as k days ahead under ongoing trajectory drift.
        """
        x_std = standardize_and_clip(x_raw, self.mean, self.std, self.clip)
        raw_logit = float(np.dot(x_std, self.weights) + self.intercept)
        calib_logit = float(self.platt_a * raw_logit + self.platt_b)
        p50 = float(1.0 / (1.0 + np.exp(-calib_logit)))

        # Band: logit-space half-width z * |w_dt / std_dt| * |platt_a| * sd_t with z = 1.2816 (true P10/P90)
        z = 1.2816
        w_over_std = abs(self.weights[self.dt_idx] / self.std[self.dt_idx])
        half_width = z * w_over_std * abs(self.platt_a) * sd_t

        logit_p10 = calib_logit - half_width
        logit_p90 = calib_logit + half_width
        p10 = float(1.0 / (1.0 + np.exp(-logit_p10)))
        p90 = float(1.0 / (1.0 + np.exp(-logit_p90)))

        forward_cone = []
        for k in range(1, horizon_days + 1):
            x_k = list(x_raw)
            x_k[self.dt_idx] = d_t + k * drift_rate

            x_k_std = standardize_and_clip(x_k, self.mean, self.std, self.clip)
            raw_logit_k = float(np.dot(x_k_std, self.weights) + self.intercept)
            calib_logit_k = float(self.platt_a * raw_logit_k + self.platt_b)
            p50_k = float(1.0 / (1.0 + np.exp(-calib_logit_k)))

            sd_k = sd_t * np.sqrt(1.0 + 0.15 * k)
            half_width_k = z * w_over_std * abs(self.platt_a) * sd_k
            logit_p10_k = calib_logit_k - half_width_k
            logit_p90_k = calib_logit_k + half_width_k
            p10_k = float(1.0 / (1.0 + np.exp(-logit_p10_k)))
            p90_k = float(1.0 / (1.0 + np.exp(-logit_p90_k)))

            forward_cone.append({
                "day_ahead": k,
                "p10": round(p10_k, 4),
                "p50": round(p50_k, 4),
                "p90": round(p90_k, 4),
                "scenario": "current trend continues"
            })

        return {
            "p10": round(p10, 4),
            "p50": round(p50, 4),
            "p90": round(p90, 4),
            "risk_percentage": round(p50 * 100.0, 1),
            "bandBasis": "kalman_filter_uncertainty_only",
            "bandsValidated": False,
            "forward_cone": forward_cone
        }

    def explain(self, x_raw: List[float]) -> Dict[str, Any]:
        """
        Computes feature contributions in log-odds units per PART B5:
        baseLogit = platt_a * intercept + platt_b
        logitContribution = platt_a * weight * zScore (after clipping)
        Identity: baseLogit + sum(logitContribution) == calibrated logit
        """
        x_std = standardize_and_clip(x_raw, self.mean, self.std, self.clip)
        raw_logit = float(np.dot(x_std, self.weights) + self.intercept)
        calibrated_logit = float(self.platt_a * raw_logit + self.platt_b)
        base_logit = float(self.platt_a * self.intercept + self.platt_b)

        contributions = []
        for i, fname in enumerate(self.feature_names):
            raw_val = float(x_raw[i])
            z_score = float(x_std[i])
            logit_contrib = float(self.platt_a * self.weights[i] * z_score)
            contributions.append({
                "feature": fname,
                "rawValue": round(raw_val, 4),
                "zScore": round(z_score, 4),
                "logitContribution": round(logit_contrib, 6)
            })

        # Keep unrounded logit contributions for exact identity verification
        for i, c in enumerate(contributions):
            z = float(x_std[i])
            c["_rawLogitContribution"] = float(self.platt_a * self.weights[i] * z)

        contributions.sort(key=lambda c: abs(c["_rawLogitContribution"]), reverse=True)

        # Remove internal raw field from output items while preserving exact math
        clean_contributions = []
        for c in contributions:
            clean_contributions.append({
                "feature": c["feature"],
                "rawValue": c["rawValue"],
                "zScore": c["zScore"],
                "logitContribution": c["_rawLogitContribution"]
            })

        return {
            "features": clean_contributions,
            "contributions": clean_contributions,
            "drivers": clean_contributions[:6],
            "baseLogit": base_logit,
            "calibratedLogit": calibrated_logit
        }

    # Alias for backward compatibility
    predict_risk_cone = risk_cone
