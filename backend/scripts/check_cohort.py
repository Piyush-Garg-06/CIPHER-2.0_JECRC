"""
Cohort V2 Validation Script

Checks:
1. Determinism across runs with the same seed
2. Required patient and daily reading fields present
3. Event rate between 20% and 25%
4. Missing telemetry rate between 5% and 10%
5. No telemetry generated after event_day
6. Red flag constraints (event patients only on event_day-2/event_day-1, never event_day)
7. Red-flag rate in non-event patients between 8% and 12%
8. Outlier day frequency similar between event and non-event groups
"""

import sys
import os

# Add root directory to python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_gen.cohort_v2 import generate_synthetic_cohort

def run_cohort_checks():
    print("==================================================")
    print("RUNNING COHORT V2 INTEGRITY CHECKS")
    print("==================================================")

    # 1. Determinism Check
    print("\n[Check 1/8] Verifying seeded determinism (seed=42)...")
    c1 = generate_synthetic_cohort(num_patients=100, days_count=30, seed=42)
    c2 = generate_synthetic_cohort(num_patients=100, days_count=30, seed=42)
    assert len(c1) == len(c2), "Cohort lengths mismatch!"
    for p1, p2 in zip(c1, c2):
        assert p1["id"] == p2["id"], f"ID mismatch: {p1['id']} != {p2['id']}"
        assert p1["event_day"] == p2["event_day"], f"event_day mismatch for {p1['id']}"
        assert len(p1["daily_readings"]) == len(p2["daily_readings"]), f"readings length mismatch for {p1['id']}"
        for r1, r2 in zip(p1["daily_readings"], p2["daily_readings"]):
            assert r1 == r2, f"Reading mismatch for patient {p1['id']} day {r1.get('day')}"
    print("  -> PASS: Seeded generation is strictly deterministic.")

    # Generate full default cohort
    print("\nGenerating full cohort (600 patients, 60 days, seed=42)...")
    cohort = generate_synthetic_cohort(num_patients=600, days_count=60, seed=42)
    num_patients = len(cohort)
    assert num_patients == 600, f"Expected 600 patients, got {num_patients}"

    # 2. Field Presence Check
    print("\n[Check 2/8] Verifying required fields...")
    required_patient_fields = {
        "id", "name", "age", "gender", "index_event", "revascularization",
        "lvef", "hypertension", "diabetes", "egfr", "ldl", "hba1c",
        "family_history_cad", "smoker", "bmi", "daily_readings", "event_day"
    }
    required_reading_fields = {
        "day", "resting_hr", "hrv", "steps", "sleep_hours",
        "med_adherence", "rehab_attended", "spo2", "bp_sys", "bp_dia", "red_flag"
    }

    for p in cohort:
        missing_p = required_patient_fields - set(p.keys())
        assert not missing_p, f"Patient {p['id']} missing fields: {missing_p}"
        for r in p["daily_readings"]:
            missing_r = required_reading_fields - set(r.keys())
            assert not missing_r, f"Patient {p['id']} day {r.get('day')} missing fields: {missing_r}"
    print("  -> PASS: All required patient EHR and daily telemetry fields present.")

    # 3. Event Rate Check
    print("\n[Check 3/8] Checking event rate (target: 20-25%)...")
    events = [p for p in cohort if p["event_day"] is not None]
    event_rate_pct = (len(events) / num_patients) * 100.0
    print(f"  -> Event rate: {len(events)}/{num_patients} ({event_rate_pct:.2f}%)")
    assert 20.0 <= event_rate_pct <= 25.0, f"Event rate {event_rate_pct:.2f}% outside 20-25% range!"
    print("  -> PASS: Event rate is within 20-25% target window.")

    # 4. Missing Rate Check
    print("\n[Check 4/8] Checking missing-day rate (target: 5-10%)...")
    total_patient_days = sum(len(p["daily_readings"]) for p in cohort)
    missing_days = sum(
        1 for p in cohort for r in p["daily_readings"] if r["resting_hr"] is None
    )
    missing_rate_pct = (missing_days / total_patient_days) * 100.0
    print(f"  -> Missing rate: {missing_days}/{total_patient_days} ({missing_rate_pct:.2f}%)")
    assert 5.0 <= missing_rate_pct <= 10.0, f"Missing rate {missing_rate_pct:.2f}% outside 5-10% range!"
    print("  -> PASS: Missing telemetry rate is within 5-10% target window.")

    # 5. Telemetry Truncation Check
    print("\n[Check 5/8] Verifying no readings after event_day...")
    for p in events:
        ev_day = p["event_day"]
        readings = p["daily_readings"]
        assert len(readings) == ev_day, f"Patient {p['id']} has {len(readings)} readings but event_day is {ev_day}"
        assert readings[-1]["day"] == ev_day, f"Last reading day {readings[-1]['day']} != event_day {ev_day}"
        for r in readings:
            assert r["day"] <= ev_day, f"Reading day {r['day']} > event_day {ev_day}"
    print("  -> PASS: Telemetry strictly halts on event_day.")

    # 6. Event Red Flag Check (A2)
    print("\n[Check 6/8] Checking event patient red flags (only on event_day-2/event_day-1, never event_day)...")
    event_rf_patients = 0
    for p in events:
        ev_day = p["event_day"]
        has_rf = False
        for r in p["daily_readings"]:
            day = r["day"]
            rf = r.get("red_flag")
            if rf is not None:
                has_rf = True
                assert day in (ev_day - 2, ev_day - 1), (
                    f"Patient {p['id']} has red flag on day {day}, but event_day is {ev_day}!"
                )
                assert day != ev_day, (
                    f"Patient {p['id']} has red flag on event_day itself {day}!"
                )
        if has_rf:
            event_rf_patients += 1
    event_rf_pct = (event_rf_patients / len(events)) * 100.0
    print(f"  -> Event patients with red flag: {event_rf_patients}/{len(events)} ({event_rf_pct:.1f}%)")
    assert 22.0 <= event_rf_pct <= 38.0, f"Event red flag rate {event_rf_pct:.1f}% expected ~30%"
    print("  -> PASS: Event red flags only appear on event_day-2 or event_day-1 (never event_day).")

    # 7. Non-Event Red Flag Check (A3)
    print("\n[Check 7/8] Checking non-event red flag false alarms (target: 8-12%)...")
    non_events = [p for p in cohort if p["event_day"] is None]
    non_event_rf_patients = 0
    for p in non_events:
        has_rf = any(r.get("red_flag") is not None for r in p["daily_readings"])
        if has_rf:
            non_event_rf_patients += 1
    non_event_rf_pct = (non_event_rf_patients / len(non_events)) * 100.0
    print(f"  -> Non-event patients with red flag: {non_event_rf_patients}/{len(non_events)} ({non_event_rf_pct:.1f}%)")
    assert 8.0 <= non_event_rf_pct <= 12.0, (
        f"Non-event red flag rate {non_event_rf_pct:.1f}% outside expected 8-12% window!"
    )
    print("  -> PASS: Non-event false alarm red flag rate is within 8-12%.")

    # 8. Outlier Days Comparison Check (A1)
    print("\n[Check 8/8] Checking fever-like outlier days in event vs non-event groups...")
    # Compute outlier-day rate PER ELIGIBLE DAY:
    # - Events: days <= event_day - 11 with a valid reading
    # - Non-events: all days with a valid reading
    # - Outlier day: resting HR >= own first-5-day mean + 16 and steps < 3000
    ev_outliers = 0
    ev_eligible_days = 0
    for p in events:
        f5 = [r["resting_hr"] for r in p["daily_readings"][:5] if r.get("resting_hr") is not None]
        if not f5:
            continue
        base_hr = sum(f5) / len(f5)
        for r in p["daily_readings"]:
            if r["day"] <= (p["event_day"] - 11) and r.get("resting_hr") is not None:
                ev_eligible_days += 1
                hr = r["resting_hr"]
                steps = r.get("steps")
                if hr >= base_hr + 16 and (steps is not None and steps < 3000):
                    ev_outliers += 1

    no_outliers = 0
    no_eligible_days = 0
    for p in non_events:
        f5 = [r["resting_hr"] for r in p["daily_readings"][:5] if r.get("resting_hr") is not None]
        if not f5:
            continue
        base_hr = sum(f5) / len(f5)
        for r in p["daily_readings"]:
            if r.get("resting_hr") is not None:
                no_eligible_days += 1
                hr = r["resting_hr"]
                steps = r.get("steps")
                if hr >= base_hr + 16 and (steps is not None and steps < 3000):
                    no_outliers += 1

    ev_rate = ev_outliers / max(ev_eligible_days, 1)
    no_rate = no_outliers / max(no_eligible_days, 1)
    ratio = ev_rate / max(no_rate, 1e-9)

    print(f"  -> Event outlier-day rate (days <= event_day - 11): {ev_outliers}/{ev_eligible_days} ({ev_rate:.6f})")
    print(f"  -> Non-event outlier-day rate (all valid days): {no_outliers}/{no_eligible_days} ({no_rate:.6f})")
    print(f"  -> Outlier-day rate ratio (event / non-event): {ratio:.4f}")
    assert 0.6 <= ratio <= 1.6, f"Outlier rate ratio {ratio:.4f} outside expected [0.6, 1.6] range!"
    print(f"  -> PASS: Outlier-day rate ratio ({ratio:.4f}) is within [0.6, 1.6] (expected ~1.3).")

    print("\n==================================================")
    print("ALL 8 CHECKS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_cohort_checks()
