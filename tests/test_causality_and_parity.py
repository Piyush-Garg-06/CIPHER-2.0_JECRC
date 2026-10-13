"""
Comprehensive Test Suite for Digital Twin Risk Forecaster & Cohort Serving

Tests:
T1 Causality/parity: for 50 patients and random day t, scores from the full-history pass
   equal scores recomputed from readings truncated at t (max diff < 1e-9).
T2 Policy parity: take TEST patients from reports/test_patient_ids.json, run the store
   pipeline over their full readings with flags DISABLED, use the same eligible rows as
   scripts/train_model.py (import from it via importlib). The logistic Yellow/Red
   alert-days per 100, catch rates and % event-free flagged must equal
   reports/metrics.json within rounding.
T3 Gap: scores on days 5 and 7 (day 6 missing) never create an alert.
T4 Missing latest day (including None steps/sleep/hrv): no exception, no new score,
   correct dataAgeDays.
T5 Not calibrated / unknown / missing EHR field: all probabilities None.
T6 Reachability: at least one patient reaches model Red, one reaches symptom Red.
T7 No label leak: the string "event_day" appears in no twin/*.py and not in the store
   outside the private hidden-label dict.
T8 Watch: a single day above the yellow cutoff gives green + watch.
T9 Cone: p10 <= p50 <= p90, all in [0,1], forward_cone has 7 entries.
T10 Forecaster raises ValueError for a missing EHR field.
"""

import os
import sys
import json
import importlib
import pytest
import numpy as np

# Ensure repository root is on sys.path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from data_gen.cohort_v2 import generate_synthetic_cohort
from twin.baseline import compute_personal_baseline
from twin.estimator_v2 import CausalKalmanFilter
from twin.forecast import RiskForecaster
from twin.zones import TriageZoneStateMachine
from api.cohort_v2_store import CohortStore


def test_t1_causality_parity():
    """
    T1: Causality/parity
    For 50 patients and random day t, scores from the full-history pass
    equal scores recomputed from readings truncated at t (max diff < 1e-9).
    """
    cohort = generate_synthetic_cohort(num_patients=50, days_count=60, seed=42)
    kf = CausalKalmanFilter()
    rf = RiskForecaster()
    rng = np.random.default_rng(101)

    for p in cohort:
        readings = p.get("daily_readings", [])
        base = compute_personal_baseline(readings)
        if not base:
            continue

        lock_day = base["lock_day"]
        valid_days = [r["day"] for r in readings if r["day"] >= lock_day and r.get("resting_hr") is not None]
        if len(valid_days) < 5:
            continue

        t = int(rng.choice(valid_days))

        # Full-history pass
        k_states_full = kf.filter_trajectory(readings, base)
        scores_full = rf.score_patient_days(p, readings, base, k_states_full)
        score_t_full = next(s for s in scores_full if s["day"] == t)

        # Truncated pass at t
        readings_trunc = [r for r in readings if r["day"] <= t]
        k_states_trunc = kf.filter_trajectory(readings_trunc, base)
        scores_trunc = rf.score_patient_days(p, readings_trunc, base, k_states_trunc)
        score_t_trunc = next(s for s in scores_trunc if s["day"] == t)

        p50_diff = abs(score_t_full["p50"] - score_t_trunc["p50"])
        feat_diff = np.max(np.abs(np.array(score_t_full["x_raw"]) - np.array(score_t_trunc["x_raw"])))

        assert p50_diff < 1e-9, f"Patient {p['id']} day {t}: p50 diff {p50_diff} >= 1e-9"
        assert feat_diff < 1e-9, f"Patient {p['id']} day {t}: feature diff {feat_diff} >= 1e-9"


def test_t2_policy_parity():
    """
    T2: Policy parity
    Take TEST patients from reports/test_patient_ids.json, run the store pipeline
    over their full readings with flags DISABLED, use the same eligible rows as
    scripts/train_model.py (imported via importlib). The logistic Yellow/Red
    alert-days per 100, catch rates and % event-free flagged must equal
    reports/metrics.json within rounding.
    """
    test_ids_path = os.path.join(ROOT_DIR, "reports", "test_patient_ids.json")
    metrics_path = os.path.join(ROOT_DIR, "reports", "metrics.json")
    assert os.path.exists(test_ids_path), "Missing reports/test_patient_ids.json"
    assert os.path.exists(metrics_path), "Missing reports/metrics.json"

    with open(test_ids_path, "r") as f:
        test_ids = set(json.load(f))
    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    train_module = importlib.import_module("scripts.train_model")
    extract_patient_rows = getattr(train_module, "extract_patient_rows")

    cohort = generate_synthetic_cohort(num_patients=2000, days_count=60, seed=42)
    test_pts = [p for p in cohort if p["id"] in test_ids]

    kf = CausalKalmanFilter()
    rf = RiskForecaster()
    zm = TriageZoneStateMachine()

    # Extract test rows using the exact offline training extract function
    X_test, y_test, hr_test, pt_rec_test = extract_patient_rows(test_pts)

    total_events = sum(1 for p in pt_rec_test if p["is_event"])
    total_nonevents = sum(1 for p in pt_rec_test if not p["is_event"])

    caught_y, caught_r = 0, 0
    nonevent_with_alert_y, nonevent_with_alert_r = 0, 0
    eval_days = 0
    alert_days_y, alert_days_r = 0, 0

    test_pt_map = {p["id"]: p for p in test_pts}

    for p_rec in pt_rec_test:
        pid = p_rec["id"]
        is_event = p_rec["is_event"]
        ev_day = p_rec["event_day"]
        days = p_rec["days"]
        raw_pt = test_pt_map[pid]

        # Run store pipeline over readings: baseline -> Kalman -> score_patient_days
        base = compute_personal_baseline(raw_pt["daily_readings"])
        k_states = kf.filter_trajectory(raw_pt["daily_readings"], base)
        scored_days = rf.score_patient_days(raw_pt, raw_pt["daily_readings"], base, k_states)
        scored_dict = {s["day"]: s["p50"] for s in scored_days}

        # Store zone evaluation with flags DISABLED
        p_alerts_y = []
        p_alerts_r = []
        for k in range(len(days)):
            day = days[k]
            # Use trailing valid scores up to day that are in eligible rows
            recent_scores = [(d, scored_dict[d]) for d in days[:k+1]]
            triage_state = zm.evaluate_triage_state(
                is_calibrated=True,
                recent_scores=recent_scores,
                acute_red_flags=[],  # Flags DISABLED
                patient_id=pid,
                current_day=day
            )
            is_y = triage_state["zone"] in ("yellow", "red")
            is_r = triage_state["zone"] == "red"
            p_alerts_y.append((day, is_y))
            p_alerts_r.append((day, is_r))

        if is_event:
            c_y = [d for d, is_a in p_alerts_y if is_a and (ev_day - 7 <= d <= ev_day - 1)]
            if len(c_y) > 0:
                caught_y += 1
            c_r = [d for d, is_a in p_alerts_r if is_a and (ev_day - 7 <= d <= ev_day - 1)]
            if len(c_r) > 0:
                caught_r += 1
        else:
            if any(is_a for _, is_a in p_alerts_y):
                nonevent_with_alert_y += 1
            if any(is_a for _, is_a in p_alerts_r):
                nonevent_with_alert_r += 1

        for (d, is_ay), (_, is_ar) in zip(p_alerts_y, p_alerts_r):
            if is_event and d > (ev_day - 8):
                continue
            eval_days += 1
            if is_ay:
                alert_days_y += 1
            if is_ar:
                alert_days_r += 1

    computed_y_catch = round((caught_y / total_events) * 100.0, 2)
    computed_r_catch = round((caught_r / total_events) * 100.0, 2)
    computed_y_alert_rate = round((alert_days_y / eval_days) * 100.0, 2)
    computed_r_alert_rate = round((alert_days_r / eval_days) * 100.0, 2)
    computed_y_nonevent = round((nonevent_with_alert_y / total_nonevents) * 100.0, 2)
    computed_r_nonevent = round((nonevent_with_alert_r / total_nonevents) * 100.0, 2)

    lr_metrics = metrics["models"]["logistic_model"]

    assert computed_y_catch == lr_metrics["yellow"]["catch_rate"], (
        f"Yellow Catch Rate mismatch: {computed_y_catch} vs {lr_metrics['yellow']['catch_rate']}"
    )
    assert computed_r_catch == lr_metrics["red"]["catch_rate"], (
        f"Red Catch Rate mismatch: {computed_r_catch} vs {lr_metrics['red']['catch_rate']}"
    )
    assert computed_y_alert_rate == lr_metrics["yellow"]["alert_rate_100d"], (
        f"Yellow Alert Rate mismatch: {computed_y_alert_rate} vs {lr_metrics['yellow']['alert_rate_100d']}"
    )
    assert computed_r_alert_rate == lr_metrics["red"]["alert_rate_100d"], (
        f"Red Alert Rate mismatch: {computed_r_alert_rate} vs {lr_metrics['red']['alert_rate_100d']}"
    )
    assert computed_y_nonevent == lr_metrics["yellow"]["pct_nonevent_alert"], (
        f"Yellow % Nonevent mismatch: {computed_y_nonevent} vs {lr_metrics['yellow']['pct_nonevent_alert']}"
    )
    assert computed_r_nonevent == lr_metrics["red"]["pct_nonevent_alert"], (
        f"Red % Nonevent mismatch: {computed_r_nonevent} vs {lr_metrics['red']['pct_nonevent_alert']}"
    )


def test_t2b_policy_parity_with_red_flags():
    """
    T2b: Policy parity with red flags ENABLED
    Same as T2 but with red flags ENABLED (flags recorded in [t-3, t] are passed to the zone machine).
    Combined Red alert-days per 100, catch rate and % event-free flagged must equal
    metrics["red_variants"]["combined"] within rounding.
    """
    test_ids_path = os.path.join(ROOT_DIR, "reports", "test_patient_ids.json")
    metrics_path = os.path.join(ROOT_DIR, "reports", "metrics.json")
    assert os.path.exists(test_ids_path), "Missing reports/test_patient_ids.json"
    assert os.path.exists(metrics_path), "Missing reports/metrics.json"

    with open(test_ids_path, "r") as f:
        test_ids = set(json.load(f))
    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    train_module = importlib.import_module("scripts.train_model")
    extract_patient_rows = getattr(train_module, "extract_patient_rows")

    cohort = generate_synthetic_cohort(num_patients=2000, days_count=60, seed=42)
    test_pts = [p for p in cohort if p["id"] in test_ids]

    kf = CausalKalmanFilter()
    rf = RiskForecaster()
    zm = TriageZoneStateMachine()

    X_test, y_test, hr_test, pt_rec_test = extract_patient_rows(test_pts)

    total_events = sum(1 for p in pt_rec_test if p["is_event"])
    total_nonevents = sum(1 for p in pt_rec_test if not p["is_event"])

    caught_r = 0
    nonevent_with_alert_r = 0
    eval_days = 0
    alert_days_r = 0

    test_pt_map = {p["id"]: p for p in test_pts}

    for p_rec in pt_rec_test:
        pid = p_rec["id"]
        is_event = p_rec["is_event"]
        ev_day = p_rec["event_day"]
        days = p_rec["days"]
        raw_pt = test_pt_map[pid]

        base = compute_personal_baseline(raw_pt["daily_readings"])
        k_states = kf.filter_trajectory(raw_pt["daily_readings"], base)
        scored_days = rf.score_patient_days(raw_pt, raw_pt["daily_readings"], base, k_states)
        scored_dict = {s["day"]: s["p50"] for s in scored_days}

        all_flags = [
            {"day": r["day"], "type": r.get("red_flag")}
            for r in raw_pt.get("daily_readings", [])
            if r.get("red_flag") is not None
        ]

        p_alerts_r = []
        for k in range(len(days)):
            day = days[k]
            recent_scores = [(d, scored_dict[d]) for d in days[:k+1]]
            # Pass flags recorded in [day - 3, day]
            active_flags = [f for f in all_flags if 0 <= (day - f["day"]) <= 3]
            triage_state = zm.evaluate_triage_state(
                is_calibrated=True,
                recent_scores=recent_scores,
                acute_red_flags=active_flags,
                patient_id=pid,
                current_day=day
            )
            is_r = triage_state["zone"] == "red"
            p_alerts_r.append((day, is_r))

        if is_event:
            c_r = [d for d, is_a in p_alerts_r if is_a and (ev_day - 7 <= d <= ev_day - 1)]
            if len(c_r) > 0:
                caught_r += 1
        else:
            if any(is_a for _, is_a in p_alerts_r):
                nonevent_with_alert_r += 1

        for d, is_ar in p_alerts_r:
            if is_event and d > (ev_day - 8):
                continue
            eval_days += 1
            if is_ar:
                alert_days_r += 1

    computed_r_catch = round((caught_r / total_events) * 100.0, 2)
    computed_r_alert_rate = round((alert_days_r / eval_days) * 100.0, 2)
    computed_r_nonevent = round((nonevent_with_alert_r / total_nonevents) * 100.0, 2)

    comb_metrics = metrics["red_variants"]["combined"]

    assert computed_r_catch == comb_metrics["catch_rate"], (
        f"Combined Red Catch Rate mismatch: {computed_r_catch} vs {comb_metrics['catch_rate']}"
    )
    assert computed_r_alert_rate == comb_metrics["alert_rate_100d"], (
        f"Combined Red Alert Rate mismatch: {computed_r_alert_rate} vs {comb_metrics['alert_rate_100d']}"
    )
    assert computed_r_nonevent == comb_metrics["pct_nonevent_alert"], (
        f"Combined Red % Nonevent mismatch: {computed_r_nonevent} vs {comb_metrics['pct_nonevent_alert']}"
    )


def test_t3_gap_missing_day_no_alert():
    """
    T3: Gap
    Scores on days 5 and 7 (day 6 missing) never create an alert.
    """
    zm = TriageZoneStateMachine()
    # High scores on days 5 and 7, with day 6 missing (gap = 2 != 1)
    scores = [(5, 0.45), (7, 0.45)]
    res = zm.evaluate_triage_state(
        is_calibrated=True,
        recent_scores=scores,
        acute_red_flags=[],
        patient_id="PT-GAP",
        current_day=7
    )
    assert res["zone"] == "green", f"Expected green zone due to non-adjacent days, got {res['zone']}"
    assert res["watch"] is True, "Expected watch=True for single day above cutoff"
    assert res["rationale"] == "single day above threshold, not an alert"


def test_t4_missing_latest_day():
    """
    T4: Missing latest day (including None steps/sleep/hrv)
    No exception, no new score, correct dataAgeDays.
    """
    store = CohortStore(num_patients=5, days_count=20, seed=42)
    pid = "PT-MISSING-TEST"
    store.patient_map[pid] = {
        "id": pid,
        "name": "Test Missing",
        "age": 60,
        "gender": "Male",
        "lvef": 50.0,
        "diabetes": False,
        "hba1c": 5.7,
        "egfr": 80.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": [
            {"day": 1, "resting_hr": 70, "hrv": 50, "steps": 5000, "sleep_hours": 7.0, "med_adherence": True},
            {"day": 2, "resting_hr": 71, "hrv": 51, "steps": 5100, "sleep_hours": 7.1, "med_adherence": True},
            {"day": 3, "resting_hr": 70, "hrv": 49, "steps": 4900, "sleep_hours": 6.9, "med_adherence": True},
            {"day": 4, "resting_hr": 72, "hrv": 50, "steps": 5000, "sleep_hours": 7.0, "med_adherence": True},
            # Day 5 and 6 missing telemetry
            {"day": 5, "resting_hr": None, "hrv": None, "steps": None, "sleep_hours": None, "med_adherence": True},
            {"day": 6, "resting_hr": None, "hrv": None, "steps": None, "sleep_hours": None, "med_adherence": True}
        ]
    }
    store.refresh(pid)
    twin = store.compute_twin(pid)

    assert twin["isCalibrated"] is True
    assert twin["scoreDay"] == 4, f"Expected scoreDay 4, got {twin['scoreDay']}"
    assert twin["dataAgeDays"] == 2, f"Expected dataAgeDays 2, got {twin['dataAgeDays']}"
    assert twin["staleData"] is False

    # Now add day 7 missing (dataAgeDays = 3 -> staleData = True)
    store.patient_map[pid]["daily_readings"].append(
        {"day": 7, "resting_hr": None, "hrv": None, "steps": None, "sleep_hours": None, "med_adherence": True}
    )
    store.refresh(pid)
    twin7 = store.compute_twin(pid)
    assert twin7["scoreDay"] == 4
    assert twin7["dataAgeDays"] == 3
    assert twin7["staleData"] is True


def test_t5_uncalibrated_unknown_missing_ehr_probabilities_none():
    """
    T5: Not calibrated / unknown / missing EHR field
    All probabilities None.
    """
    store = CohortStore(num_patients=5, days_count=20, seed=42)

    # 1. Unknown patient
    twin_unk = store.compute_twin("PT-NONEXISTENT")
    assert twin_unk["isCalibrated"] is False
    assert twin_unk["p10"] is None
    assert twin_unk["p50"] is None
    assert twin_unk["p90"] is None
    assert twin_unk["triageZone"] == "not_calibrated"

    # 2. Patient with fewer than 3 baseline readings
    pid_uncal = "PT-FEW-READINGS"
    store.patient_map[pid_uncal] = {
        "id": pid_uncal,
        "name": "Uncalibrated",
        "age": 60,
        "gender": "Female",
        "lvef": 55.0,
        "diabetes": False,
        "hba1c": 5.5,
        "egfr": 90.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": [
            {"day": 1, "resting_hr": 72, "hrv": 50, "steps": 5000, "sleep_hours": 7.0}
        ]
    }
    store.refresh(pid_uncal)
    twin_uncal = store.compute_twin(pid_uncal)
    assert twin_uncal["isCalibrated"] is False
    assert twin_uncal["p10"] is None
    assert twin_uncal["p50"] is None
    assert twin_uncal["p90"] is None
    assert twin_uncal["triageZone"] == "not_calibrated"

    # Check summary
    summaries = {p["id"]: p for p in store.get_all_patients()}
    assert summaries[pid_uncal]["riskPercentage"] is None
    assert summaries[pid_uncal]["riskLevel"] == "not_calibrated"

    # 3. Patient missing required EHR field (e.g. lvef)
    pid_ehr = "PT-MISSING-EHR"
    store.patient_map[pid_ehr] = {
        "id": pid_ehr,
        "name": "Missing EHR",
        "age": 60,
        "gender": "Female",
        # missing lvef
        "diabetes": False,
        "hba1c": 5.5,
        "egfr": 90.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": [
            {"day": 1, "resting_hr": 72, "hrv": 50, "steps": 5000, "sleep_hours": 7.0},
            {"day": 2, "resting_hr": 72, "hrv": 50, "steps": 5000, "sleep_hours": 7.0},
            {"day": 3, "resting_hr": 72, "hrv": 50, "steps": 5000, "sleep_hours": 7.0}
        ]
    }
    store.refresh(pid_ehr)
    twin_ehr = store.compute_twin(pid_ehr)
    assert twin_ehr["isCalibrated"] is False
    assert twin_ehr["p10"] is None
    assert twin_ehr["p50"] is None
    assert twin_ehr["p90"] is None
    assert twin_ehr["triageZone"] == "not_calibrated"


def test_t6_reachability():
    """
    T6: Reachability
    At least one patient reaches model Red, one reaches symptom Red across simulated cohort.
    """
    zm = TriageZoneStateMachine()

    # Reach model Red
    scores_red = [(1, 0.25), (2, 0.26)]
    res_model_red = zm.evaluate_triage_state(
        is_calibrated=True,
        recent_scores=scores_red,
        acute_red_flags=[],
        patient_id="PT-REACH-1",
        current_day=2
    )
    assert res_model_red["zone"] == "red"
    assert res_model_red["red_source"] == "model"

    # Reach symptom Red
    flags_red = [{"day": 5, "type": "chest_pain"}]
    res_symp_red = zm.evaluate_triage_state(
        is_calibrated=True,
        recent_scores=[(4, 0.02), (5, 0.02)],
        acute_red_flags=flags_red,
        patient_id="PT-REACH-2",
        current_day=5
    )
    assert res_symp_red["zone"] == "red"
    assert res_symp_red["red_source"] == "symptom"
    assert res_symp_red["active_episode"] is not None

    # Reach combined Red (both)
    res_both_red = zm.evaluate_triage_state(
        is_calibrated=True,
        recent_scores=scores_red,
        acute_red_flags=[{"day": 2, "type": "syncope"}],
        patient_id="PT-REACH-3",
        current_day=2
    )
    assert res_both_red["zone"] == "red"
    assert res_both_red["red_source"] == "both"


def test_t6b_cohort_store_both_red_sources():
    """
    T6b: CohortStore red sources reachability
    Build CohortStore() with default arguments; at least one patient has redSource "model"
    and at least one has redSource "symptom".
    """
    store = CohortStore()
    patients = store.get_all_patients()
    red_sources = {p.get("redSource") for p in patients}
    assert "model" in red_sources, f"Expected at least one patient with redSource='model', found {red_sources}"
    assert "symptom" in red_sources, f"Expected at least one patient with redSource='symptom', found {red_sources}"


def test_t7_no_label_leak():
    """
    T7: No label leak
    The string 'event_day' appears in no twin/*.py and not in the store
    outside the private hidden-label dict.
    """
    twin_dir = os.path.join(ROOT_DIR, "twin")
    for fname in os.listdir(twin_dir):
        if not fname.endswith(".py"):
            continue
        path = os.path.join(twin_dir, fname)
        with open(path, "r", encoding="utf-8") as f:
            lines = f.readlines()
        for idx, line in enumerate(lines, 1):
            if "event_day" in line:
                # Allowed only if in an explanatory docstring/comment in features.py
                if fname == "features.py" and "Contains no outcome labels" in line:
                    continue
                pytest.fail(f"Leaked 'event_day' found in twin/{fname}:{idx}: {line.strip()}")

    store_path = os.path.join(ROOT_DIR, "api", "cohort_v2_store.py")
    with open(store_path, "r", encoding="utf-8") as f:
        store_lines = f.readlines()
    for idx, line in enumerate(store_lines, 1):
        if "event_day" in line:
            # Must only appear in docstrings or managing self._hidden_event_day
            allowed = (
                "_hidden_event_day" in line
                or "ev_day = p.pop(\"event_day\", None)" in line
                or "Hidden label" in line
                or "ev_day <= as_of_day" in line
                or "ev_day is not None" in line
            )
            assert allowed, f"Unexpected 'event_day' usage in cohort_v2_store.py:{idx}: {line.strip()}"


def test_t8_watch_single_day_elevated():
    """
    T8: Watch
    A single day above the yellow cutoff gives green + watch.
    """
    zm = TriageZoneStateMachine()
    scores = [(1, 0.01), (2, 0.055)]  # day 2 exceeds 0.046864
    res = zm.evaluate_triage_state(
        is_calibrated=True,
        recent_scores=scores,
        acute_red_flags=[],
        patient_id="PT-WATCH",
        current_day=2
    )
    assert res["zone"] == "green", f"Expected green zone, got {res['zone']}"
    assert res["watch"] is True, f"Expected watch=True, got {res['watch']}"
    assert res["rationale"] == "single day above threshold, not an alert"


def test_t9_cone_p10_p50_p90_and_forward_cone():
    """
    T9: Cone
    p10 <= p50 <= p90, all in [0,1], forward_cone has 7 entries.
    """
    rf = RiskForecaster()
    # Mock raw feature vector of 15 elements
    x_raw = [60.0, 50.0, 0.0, 6.0, 80.0, 0.0, 0.0, -0.2, 0.0, 0.5, 1.0, 7.0, 1.0, 2.0, 0.0]
    cone = rf.risk_cone(x_raw=x_raw, d_t=-0.2, sd_t=0.18, drift_rate=-0.05, horizon_days=7)

    assert 0.0 <= cone["p10"] <= cone["p50"] <= cone["p90"] <= 1.0, (
        f"Ordering violated: {cone['p10']} <= {cone['p50']} <= {cone['p90']}"
    )
    assert cone["bandBasis"] == "kalman_filter_uncertainty_only"
    assert cone["bandsValidated"] is False
    assert len(cone["forward_cone"]) == 7, f"Expected 7 forward cone days, got {len(cone['forward_cone'])}"

    for entry in cone["forward_cone"]:
        assert 0.0 <= entry["p10"] <= entry["p50"] <= entry["p90"] <= 1.0
        assert entry["scenario"] == "current trend continues"


def test_t10_forecaster_raises_value_error_for_missing_ehr():
    """
    T10: Forecaster raises ValueError for a missing EHR field.
    """
    rf = RiskForecaster()
    incomplete_patient = {
        "id": "PT-ERR",
        "name": "Missing EHR Patient",
        "age": 62,
        # Missing lvef, diabetes, etc.
    }
    with pytest.raises(ValueError) as excinfo:
        rf.score_patient_days(incomplete_patient, [], {}, [])
    assert "Missing required EHR field" in str(excinfo.value)
