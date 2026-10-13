"""
Cohort V2 Synthetic Data Generation Engine with Ground-Truth Outcome Labels

Simulates post-MI recovery cohorts with longitudinal wearable telemetry,
electronic health records (EHR), multi-sensor noise, and realistic outcome labels.

CRITICAL USAGE NOTE / WARNING:
The top-level key 'event_day' represents the hidden ground-truth outcome label
(urgent readmission day, or None if unadmitted within the observation window).
Only training label builders, offline benchmark scripts, and validation evaluators
may read 'event_day'. Production inference routines, digital twin state estimators,
causal Kalman filters, and live API endpoints MUST NOT read or leak 'event_day'.
"""

import numpy as np
from typing import Dict, Any, List, Optional

NAMES_FIRST = [
    "Rahul", "Amit", "Anita", "Priya", "Vikram", "Sunita", 
    "Rajesh", "Meera", "Karan", "Pooja", "Arjun", "Neha"
]
NAMES_LAST = [
    "Sharma", "Verma", "Desai", "Patel", "Mehta", "Reddy", 
    "Gupta", "Nair", "Kapoor", "Singh", "Joshi", "Rao"
]

def generate_synthetic_cohort(
    num_patients: int = 600,
    days_count: int = 60,
    seed: Optional[int] = 42
) -> List[Dict[str, Any]]:
    """
    Generate synthetic post-MI cohort with realistic hidden outcomes.

    Parameters:
        num_patients: Number of patient trajectories to generate (default 600).
        days_count: Maximum observation days per patient (default 60).
        seed: Random seed for reproducible generation (default 42).

    Returns:
        List of patient dictionaries conforming to the schema expected by
        the digital twin engine and API store.
    """
    rng = np.random.default_rng(seed)
    cohort: List[Dict[str, Any]] = []

    for i in range(num_patients):
        pid = f"PT-{8000 + i}"
        first_name = rng.choice(NAMES_FIRST)
        last_name = rng.choice(NAMES_LAST)
        age = int(rng.integers(42, 80))
        gender = "Male" if rng.random() > 0.42 else "Female"

        # Clinical attributes
        index_event = rng.choice(["STEMI (Anterior)", "NSTEMI", "Unstable Angina", "STEMI (Inferior)"])
        revasc = rng.choice(["PCI with DES", "CABG x3", "Medical Management"])
        lvef = int(np.clip(rng.normal(48, 10), 25, 65))
        has_htn = bool(rng.random() < 0.62)
        has_dm = bool(rng.random() < 0.38)
        egfr = int(np.clip(rng.normal(78, 18), 28, 115))
        ldl = int(np.clip(rng.normal(108, 26), 55, 190))

        # EHR fields
        family_history_cad = bool(rng.random() < 0.40)
        smoker = bool(rng.random() < 0.28)
        if has_dm:
            hba1c = round(float(np.clip(rng.normal(7.8, 1.1), 6.5, 11.5)), 1)
        else:
            hba1c = round(float(np.clip(rng.normal(5.5, 0.35), 4.8, 6.4)), 1)

        base_bmi = rng.normal(26.5, 3.8) + (1.6 if has_dm else 0.0) + (1.0 if has_htn else 0.0)
        bmi = round(float(np.clip(base_bmi, 18.5, 42.0)), 1)

        # 3. Hidden "frailty" value computed from clinical factors + noise
        age_contrib = (age - 60.0) / 15.0
        lvef_contrib = (50.0 - lvef) / 12.0
        dm_contrib = 0.70 if has_dm else 0.0
        hba1c_contrib = (hba1c - 6.0) / 1.5
        egfr_contrib = (85.0 - egfr) / 25.0
        fam_contrib = 0.35 if family_history_cad else 0.0
        smoker_contrib = 0.55 if smoker else 0.0
        frailty_noise = float(rng.normal(0.0, 0.30))

        frailty_latent = (
            0.28 * age_contrib
            + 0.38 * lvef_contrib
            + 0.30 * dm_contrib
            + 0.22 * hba1c_contrib
            + 0.32 * egfr_contrib
            + 0.18 * fam_contrib
            + 0.25 * smoker_contrib
            + frailty_noise
        )
        frailty = float(1.0 / (1.0 + np.exp(-frailty_latent)))

        # Baseline medication adherence propensity
        base_adh = float(np.clip(rng.beta(16, 2) - 0.12 * frailty, 0.65, 0.98))
        missed_med_rate = 1.0 - base_adh

        # 4. Hidden outcome generation: event probability from frailty, missed meds, decompensation
        beta0 = -1.55
        decompensation_liability = beta0 + 2.4 * (frailty - 0.5) + 3.0 * (missed_med_rate - 0.12)
        p_event = float(1.0 / (1.0 + np.exp(-decompensation_liability)))
        has_event = bool(rng.random() < p_event)

        event_day: Optional[int] = None
        event_trajectory = "none"
        decline_lead = 0
        has_red_flag_alert = False

        if has_event:
            # 5. Realistic event phenotypes: ~70% gradual decline, ~30% sudden
            is_gradual = bool(rng.random() < 0.70)
            if is_gradual:
                event_trajectory = "gradual"
                max_lead = min(10, max(3, days_count - 5))
                decline_lead = int(rng.integers(3, max_lead + 1))
                min_event_day = min(max(decline_lead + 4, 8), days_count)
                event_day = int(rng.integers(min_event_day, days_count + 1))
            else:
                event_trajectory = "sudden"
                min_event_day = min(6, days_count)
                event_day = int(rng.integers(min_event_day, days_count + 1))

            # Red flags for ~30% of events
            if rng.random() < 0.30:
                has_red_flag_alert = True
        else:
            # ~10% of non-event patients experience a decoy decline that recovers
            if rng.random() < 0.10 and days_count >= 15:
                event_trajectory = "decoy"

        # 6. Stop generating readings after event_day (no data after the event)
        n_days = event_day if has_event else days_count

        # A2: Red flag days for event patients (only on days event_day-2 and event_day-1, never on event_day)
        event_red_flag_days = set()
        if has_event and has_red_flag_alert and event_day is not None:
            event_red_flag_days.add(event_day - 1)
            if rng.random() < 0.5 and (event_day - 2 >= 1):
                event_red_flag_days.add(event_day - 2)

        # A3: Red flags for non-event patients (false alarms): ~8% of non-event patients, ~16% for decoys
        non_event_red_flag_days = set()
        if not has_event:
            rf_chance = 0.16 if event_trajectory == "decoy" else 0.08
            if rng.random() < rf_chance:
                num_rf_days = int(rng.choice([1, 2], p=[0.65, 0.35]))
                if num_rf_days == 1:
                    non_event_red_flag_days.add(int(rng.integers(4, days_count + 1)))
                else:
                    d1 = int(rng.integers(4, max(5, days_count - 2)))
                    d2 = int(rng.integers(d1 + 2, days_count + 1))
                    non_event_red_flag_days.update([d1, d2])

        # Decoy episode configuration if applicable
        if event_trajectory == "decoy":
            decoy_len = int(rng.integers(5, min(10, max(6, days_count // 3))))
            decoy_start = int(rng.integers(10, max(11, days_count - decoy_len - 4)))
        else:
            decoy_len = 0
            decoy_start = 9999

        # Base vitals calibrated to patient frailty & cardiovascular profile
        base_resting_hr = int(rng.integers(58, 78) + int(4 * frailty))
        base_hrv = int(rng.integers(42, 68) - int(6 * frailty))
        base_steps = int(rng.integers(4800, 9200) - int(800 * frailty))
        base_sleep = round(float(rng.uniform(6.2, 8.3) - 0.4 * frailty), 1)
        base_spo2 = int(rng.integers(96, 100))
        base_bp_sys = int(rng.integers(132, 148) if has_htn else rng.integers(114, 126))
        base_bp_dia = int(rng.integers(82, 92) if has_htn else rng.integers(72, 80))

        readings: List[Dict[str, Any]] = []

        for d in range(1, n_days + 1):
            # Missing sensor days (5-10% rate).
            # Guard the first 3 days (baseline lock), the final day, and designated red flag days.
            is_missing = False
            if d > 3 and d < n_days:
                is_missing = bool(rng.random() < 0.075)

            if d in event_red_flag_days or d in non_event_red_flag_days:
                is_missing = False

            if is_missing:
                # Set resting_hr, hrv, steps, sleep_hours to None together
                med = bool(rng.random() < base_adh)
                readings.append({
                    "day": d,
                    "resting_hr": None,
                    "hrv": None,
                    "steps": None,
                    "sleep_hours": None,
                    "med_adherence": med,
                    "rehab_attended": False,
                    "spo2": None,
                    "bp_sys": None,
                    "bp_dia": None,
                    "red_flag": None
                })
                continue

            # Physiological shifts based on trajectory state
            hr_shift = 0.0
            hrv_shift = 0.0
            steps_mult = 1.0
            sleep_shift = 0.0
            spo2_shift = 0.0
            bp_sys_shift = 0.0
            bp_dia_shift = 0.0

            if event_trajectory == "gradual" and event_day is not None and d >= (event_day - decline_lead):
                # Gradual autonomic deterioration leading into event_day
                lead_progress = (d - (event_day - decline_lead) + 1) / (decline_lead + 1)
                hr_shift = 14.0 * lead_progress
                hrv_shift = -22.0 * lead_progress
                steps_mult = max(0.35, 1.0 - 0.55 * lead_progress)
                sleep_shift = -2.0 * lead_progress
                spo2_shift = -4.0 * lead_progress
                bp_sys_shift = 12.0 * lead_progress if has_htn else 8.0 * lead_progress
                bp_dia_shift = 6.0 * lead_progress
            elif event_trajectory == "sudden" and event_day is not None and d == event_day:
                # Acute shock on event day with minimal/no prior drift
                hr_shift = 18.0
                hrv_shift = -25.0
                steps_mult = 0.30
                sleep_shift = -2.5
                spo2_shift = -5.0
                bp_sys_shift = 20.0
                bp_dia_shift = 10.0
            elif event_trajectory == "decoy" and (decoy_start <= d <= decoy_start + decoy_len):
                # Transient decline that peaks and fully recovers
                mid = decoy_len / 2.0
                dist_from_mid = abs((d - decoy_start) - mid)
                decoy_intensity = max(0.0, 1.0 - dist_from_mid / (mid + 0.1))
                hr_shift = 10.0 * decoy_intensity
                hrv_shift = -16.0 * decoy_intensity
                steps_mult = max(0.5, 1.0 - 0.40 * decoy_intensity)
                sleep_shift = -1.5 * decoy_intensity
                spo2_shift = -2.0 * decoy_intensity
                bp_sys_shift = 8.0 * decoy_intensity
                bp_dia_shift = 4.0 * decoy_intensity

            # A1: Fever-like outlier days (~1.2% chance per day) for ALL patients outside decline, decoy, event day
            is_in_gradual_decline = (has_event and event_trajectory == "gradual" and event_day is not None and (event_day - decline_lead <= d <= event_day))
            is_event_day = (has_event and event_day is not None and d == event_day)
            is_in_decoy = (not has_event and event_trajectory == "decoy" and (decoy_start <= d <= decoy_start + decoy_len))

            if not (is_in_gradual_decline or is_event_day or is_in_decoy):
                if rng.random() < 0.012:
                    hr_shift += 20.0
                    hrv_shift -= 18.0
                    steps_mult *= 0.25
                    sleep_shift += 2.0

            # Red flag symptoms:
            # A2: For event patients on event_day-2 or event_day-1 (never event_day)
            # A3: For non-event patients on isolated designated false-alarm days
            red_flag = None
            if d in event_red_flag_days or d in non_event_red_flag_days:
                red_flag = rng.choice(["chest_pain", "syncope", "acute_dyspnea"])

            # Adherence & Rehab attendance
            p_adhere = base_adh
            if hr_shift > 5.0:
                p_adhere = max(0.4, p_adhere - 0.25)
            med = bool(rng.random() < p_adhere)
            rehab = bool(d % 3 == 0 and steps_mult > 0.6)

            # Apply Gaussian sensor noise and physical limits
            hr_val = int(np.clip(base_resting_hr + hr_shift + rng.normal(0, 1.8), 45, 140))
            hrv_val = int(np.clip(base_hrv + hrv_shift + rng.normal(0, 2.5), 12, 110))
            steps_val = int(np.clip(base_steps * steps_mult + rng.normal(0, 400), 500, 20000))
            sleep_val = round(float(np.clip(base_sleep + sleep_shift + rng.normal(0, 0.35), 3.0, 12.0)), 1)
            spo2_val = int(np.clip(base_spo2 + spo2_shift + rng.integers(-1, 2), 85, 100))
            bp_s_val = int(np.clip(base_bp_sys + bp_sys_shift + rng.normal(0, 3.5), 90, 200))
            bp_d_val = int(np.clip(base_bp_dia + bp_dia_shift + rng.normal(0, 2.5), 55, 120))

            readings.append({
                "day": d,
                "resting_hr": hr_val,
                "hrv": hrv_val,
                "steps": steps_val,
                "sleep_hours": sleep_val,
                "med_adherence": med,
                "rehab_attended": rehab,
                "spo2": spo2_val,
                "bp_sys": bp_s_val,
                "bp_dia": bp_d_val,
                "red_flag": red_flag
            })

        patient = {
            "id": pid,
            "name": f"{first_name} {last_name}",
            "age": age,
            "gender": gender,
            "index_event": index_event,
            "revascularization": revasc,
            "lvef": lvef,
            "hypertension": has_htn,
            "diabetes": has_dm,
            "egfr": egfr,
            "ldl": ldl,
            "hba1c": hba1c,
            "family_history_cad": family_history_cad,
            "smoker": smoker,
            "bmi": bmi,
            "daily_readings": readings,
            "event_day": event_day
        }
        cohort.append(patient)

    return cohort

if __name__ == "__main__":
    num_pts = 600
    cohort_data = generate_synthetic_cohort(num_patients=num_pts, days_count=60, seed=42)

    total_patient_days = sum(len(p["daily_readings"]) for p in cohort_data)
    missing_days = sum(
        1 for p in cohort_data for r in p["daily_readings"] if r["resting_hr"] is None
    )
    events = sum(1 for p in cohort_data if p["event_day"] is not None)

    event_pct = (events / num_pts) * 100.0
    missing_rate = (missing_days / total_patient_days) * 100.0
    event_rate_per_patient_day = events / total_patient_days

    print(f"Number of patients: {num_pts}")
    print(f"% with event: {event_pct:.1f}%")
    print(f"Average missing-day rate: {missing_rate:.2f}%")
    print(f"Event rate per patient-day: {event_rate_per_patient_day:.5f}")
