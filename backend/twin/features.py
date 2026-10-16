"""
Causal Feature Engineering and Scoring Module for Digital Twin Risk Forecaster

Provides a single shared feature code path for both offline training/evaluation
and online runtime serving.
"""

from typing import Dict, Any, List, Union, Optional
import numpy as np

FEATURE_NAMES = [
    "age",
    "lvef",
    "diabetes",
    "hba1c",
    "egfr",
    "family_history_cad",
    "smoker",
    "d_t",
    "drift_rate",
    "hr_above_baseline_3d_mean",
    "steps_ratio_3d_mean",
    "sleep_hours_3d_mean",
    "missed_meds_last_7d",
    "rehab_attended_last_7d",
    "red_flag_last_2d"
]

def build_feature_rows(
    patient: Dict[str, Any],
    baseline: Dict[str, Any],
    kalman_states: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Builds the 15 causal feature rows for a patient trajectory.
    Generates a row for every day t >= baseline lock_day that has a valid resting_hr reading.
    Contains no outcome labels, event_day filtering, or cohort truncation.
    """
    readings = patient.get("daily_readings", [])
    lock_day = baseline.get("lock_day", 1)

    age = float(patient.get("age", 60))
    lvef = float(patient.get("lvef", 50))
    dm = 1.0 if patient.get("diabetes", False) else 0.0
    hba1c = float(patient.get("hba1c", 6.0))
    egfr = float(patient.get("egfr", 80))
    fam = 1.0 if patient.get("family_history_cad", False) else 0.0
    smoker = 1.0 if patient.get("smoker", False) else 0.0

    hr_0 = float(baseline.get("hr_0", 72.0))
    steps_0 = max(float(baseline.get("steps_0", 5000.0)), 100.0)

    rows = []

    for k, r in enumerate(readings):
        t = r.get("day", 0)
        if t < lock_day or r.get("resting_hr") is None:
            continue

        ks = kalman_states[k]
        d_t = float(ks.get("d_t", 0.0))
        drift = float(ks.get("drift_rate", 0.0))

        # Rolling 3-day telemetry averages (strictly using valid days, no imputation)
        recent_3d = [
            r_prev for r_prev in readings[:k+1]
            if r_prev.get("day", 0) >= (t - 2) and r_prev.get("resting_hr") is not None
        ]
        hr_above_3d = float(np.mean([r_prev["resting_hr"] - hr_0 for r_prev in recent_3d]))
        steps_ratio_3d = float(np.mean([r_prev["steps"] / steps_0 for r_prev in recent_3d]))
        sleep_3d = float(np.mean([r_prev["sleep_hours"] for r_prev in recent_3d]))

        # Rolling 7-day adherence and cardiac rehab
        recent_7d = [
            r_prev for r_prev in readings[:k+1]
            if r_prev.get("day", 0) >= (t - 6)
        ]
        missed_7d = float(sum(1 for r_prev in recent_7d if not r_prev.get("med_adherence", True)))
        rehab_7d = float(sum(1 for r_prev in recent_7d if r_prev.get("rehab_attended", False)))

        # Rolling 2-day acute red flags
        recent_2d = [
            r_prev for r_prev in readings[:k+1]
            if r_prev.get("day", 0) >= (t - 1)
        ]
        rf_2d = 1.0 if any(r_prev.get("red_flag") is not None for r_prev in recent_2d) else 0.0

        row_x = [
            age, lvef, dm, hba1c, egfr, fam, smoker,
            d_t, drift,
            hr_above_3d, steps_ratio_3d, sleep_3d,
            missed_7d, rehab_7d,
            rf_2d
        ]

        rows.append({"day": t, "x": row_x})

    return rows

def standardize_and_clip(
    x: Union[List[float], np.ndarray],
    mean: Union[List[float], np.ndarray],
    std: Union[List[float], np.ndarray],
    clip: float = 4.0
) -> np.ndarray:
    """
    Standardizes feature vector(s) using mean and std, clipping resulting z-scores to [-clip, clip].
    """
    mean_arr = np.asarray(mean, dtype=float)
    std_arr = np.asarray(std, dtype=float)
    z = (np.asarray(x, dtype=float) - mean_arr) / std_arr
    return np.clip(z, -clip, clip)

def score_logistic(
    x_raw: Union[List[float], np.ndarray],
    model_dict: Dict[str, Any]
) -> Union[float, np.ndarray]:
    """
    Computes calibrated readmission risk probability from raw feature values:
    standardize -> clip -> dot(weights) + intercept -> Platt scaling -> sigmoid.
    Supports both 1D (single day) and 2D (batch) feature arrays.
    """
    mean = np.asarray(model_dict["mean"], dtype=float)
    std = np.asarray(model_dict["std"], dtype=float)
    clip_val = float(model_dict.get("clip", 4.0))
    weights = np.asarray(model_dict["weights"], dtype=float)
    intercept = float(model_dict["intercept"])
    platt_a = float(model_dict.get("platt_a", 1.0))
    platt_b = float(model_dict.get("platt_b", 0.0))

    x_arr = np.asarray(x_raw, dtype=float)
    x_std = standardize_and_clip(x_arr, mean, std, clip_val)

    if x_std.ndim == 1:
        raw_logit = float(np.dot(x_std, weights) + intercept)
        platt_logit = np.clip(platt_a * raw_logit + platt_b, -20.0, 20.0)
        return float(1.0 / (1.0 + np.exp(-platt_logit)))
    else:
        raw_logits = x_std @ weights + intercept
        platt_logits = np.clip(platt_a * raw_logits + platt_b, -20.0, 20.0)
        return 1.0 / (1.0 + np.exp(-platt_logits))
