import numpy as np
from typing import Dict, Any, Optional, List, Tuple

def compute_personal_baseline(
    daily_readings: List[Dict[str, Any]], 
    min_readings: int = 3,
    max_baseline_day: int = 14
) -> Optional[Dict[str, Any]]:
    """
    Stage 1: Personal Baseline Calibration Guard
    Locks patient-specific baseline vitals (HR_0, HRV_0, steps_0, sleep_0)
    using the first 3 valid resting HR readings within days 0..14.
    Computes individual Normal Band: [HR_0 - 1.96*sigma, HR_0 + 1.96*sigma] with floor sigma >= 2.0.
    """
    valid_hr = []
    valid_hrv = []
    valid_steps = []
    valid_sleep = []
    lock_day = None

    for entry in daily_readings:
        day = entry.get("day", 0)
        if day > max_baseline_day:
            break
        
        hr = entry.get("resting_hr")
        if hr is not None and not np.isnan(hr) and hr > 0:
            valid_hr.append(float(hr))
            valid_hrv.append(float(entry.get("hrv", 50.0)))
            valid_steps.append(float(entry.get("steps", 5000.0)))
            valid_sleep.append(float(entry.get("sleep_hours", 7.0)))

            if len(valid_hr) == min_readings:
                lock_day = day
                break

    if len(valid_hr) < min_readings:
        return None  # Uncalibrated guard: withhold predictions

    hr_0 = float(np.mean(valid_hr))
    hrv_0 = float(np.mean(valid_hrv))
    steps_0 = float(np.mean(valid_steps))
    sleep_0 = float(np.mean(valid_sleep))

    sigma_hr = max(float(np.std(valid_hr)), 2.0)
    normal_band_lower = float(hr_0 - 1.96 * sigma_hr)
    normal_band_upper = float(hr_0 + 1.96 * sigma_hr)

    return {
        "is_calibrated": True,
        "lock_day": lock_day,
        "hr_0": round(hr_0, 2),
        "hrv_0": round(hrv_0, 2),
        "steps_0": round(steps_0, 1),
        "sleep_0": round(sleep_0, 2),
        "sigma_hr": round(sigma_hr, 2),
        "normal_band": {
            "lower": round(normal_band_lower, 2),
            "upper": round(normal_band_upper, 2)
        }
    }
