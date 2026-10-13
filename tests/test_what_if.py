"""
Tests for What-If Endpoint and Twin State Additions per PART D6, D7, D8:
W1 override equal to current value -> scenarioP50 == baselineP50 (tol 1e-9).
W2 direction matches model.json weights.
W3 out-of-range, unknown key, or empty overrides -> 422.
W4 unknown patient 404; uncalibrated, stale -> 409.
W5 no forbidden words ("recommend", "should", "treatment", "advice") outside constant note.
W6 cache and store unchanged after call.
W7 scoreHistory and recentReadings shapes, with nulls for missing days.
"""

import os
import json
import copy
import pytest
from fastapi.testclient import TestClient

from api.main import app
from api.cohort_v2_store import CohortStore


@pytest.fixture
def fresh_store(monkeypatch):
    store = CohortStore()
    monkeypatch.setattr("api.main.cohort_store", store)
    monkeypatch.setattr("api.routes_v2.cohort_store", store)
    return store


@pytest.fixture
def client():
    return TestClient(app)


def test_w1_override_equal_to_current_value(client, fresh_store):
    """W1: override equal to the current value -> scenarioP50 == baselineP50 (tol 1e-9)."""
    raw_info = fresh_store._raw_feature_cache["PT-8092"]
    x_raw = raw_info["x_raw"]
    feat_names = fresh_store.forecaster.feature_names

    # Check sleepHours (feature: sleep_hours_3d_mean)
    sleep_idx = feat_names.index("sleep_hours_3d_mean")
    curr_sleep = float(x_raw[sleep_idx])

    res = client.post("/api/v2/patients/PT-8092/what-if", json={
        "overrides": {"sleepHours": curr_sleep}
    })
    assert res.status_code == 200, res.text
    data = res.json()

    assert abs(data["scenarioP50"] - data["baselineP50"]) < 1e-9
    assert abs(data["deltaLogOdds"]) < 1e-9
    assert data["appliedOverrides"] == {"sleepHours": curr_sleep}

    # Check stepsRatio (feature: steps_ratio_3d_mean)
    steps_idx = feat_names.index("steps_ratio_3d_mean")
    curr_steps = float(x_raw[steps_idx])

    res2 = client.post("/api/v2/patients/PT-8092/what-if", json={
        "overrides": {"stepsRatio": curr_steps}
    })
    assert res2.status_code == 200, res2.text
    data2 = res2.json()

    assert abs(data2["scenarioP50"] - data2["baselineP50"]) < 1e-9
    assert abs(data2["deltaLogOdds"]) < 1e-9


def test_w2_direction_matches_model_weights(client, fresh_store):
    """W2: for each key, moving the feature in the direction that its model weight says
    raises risk gives scenarioP50 > baselineP50 and the opposite gives lower (derive sign
    from model.json weights, not hard-coded; skip if clipped at +-4 on both sides)."""
    model_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "twin", "model.json")
    with open(model_path, "r", encoding="utf-8") as f:
        model = json.load(f)

    platt_a = model["platt_a"]
    feature_names = model["feature_names"]
    weights = model["weights"]

    key_map = {
        "stepsRatio": ("steps_ratio_3d_mean", 0.2, 1.8),
        "sleepHours": ("sleep_hours_3d_mean", 4.0, 10.0),
        "hrAboveBaseline": ("hr_above_baseline_3d_mean", -10.0, 20.0),
        "recoveryIndex": ("d_t", -4.0, 2.0),
        "missedMeds7d": ("missed_meds_last_7d", 0, 5),
        "rehabSessions7d": ("rehab_attended_last_7d", 0, 5)
    }

    raw_info = fresh_store._raw_feature_cache["PT-8092"]
    x_raw = raw_info["x_raw"]

    for override_key, (feat_name, val_low, val_high) in key_map.items():
        idx = feature_names.index(feat_name)
        eff_weight = platt_a * weights[idx]

        # Determine which value should raise vs lower risk based on derived effective weight
        if eff_weight > 0:
            val_risk_up = val_high
            val_risk_down = val_low
        else:
            val_risk_up = val_low
            val_risk_down = val_high

        # Test risk-up override
        res_up = client.post("/api/v2/patients/PT-8092/what-if", json={
            "overrides": {override_key: val_risk_up}
        })
        assert res_up.status_code == 200, f"{override_key} risk-up failed: {res_up.text}"
        data_up = res_up.json()

        # Test risk-down override
        res_down = client.post("/api/v2/patients/PT-8092/what-if", json={
            "overrides": {override_key: val_risk_down}
        })
        assert res_down.status_code == 200, f"{override_key} risk-down failed: {res_down.text}"
        data_down = res_down.json()

        # Moving in risk-increasing direction must yield higher risk than risk-decreasing direction
        assert data_up["scenarioP50"] > data_down["scenarioP50"], (
            f"Direction violation for {override_key} (weight {eff_weight}): "
            f"scenarioP50 up ({data_up['scenarioP50']}) <= scenarioP50 down ({data_down['scenarioP50']})"
        )
        assert data_up["deltaLogOdds"] > data_down["deltaLogOdds"]


def test_w3_invalid_requests(client, fresh_store):
    """W3: out-of-range or unknown key or empty overrides -> 422."""
    # Out of range stepsRatio (> 2.0 or < 0.0)
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"stepsRatio": 2.5}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"stepsRatio": -0.1}}).status_code == 422

    # Out of range sleepHours (> 14 or < 0)
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"sleepHours": 15.0}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"sleepHours": -1.0}}).status_code == 422

    # Out of range hrAboveBaseline (< -15 or > 30)
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"hrAboveBaseline": 35.0}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"hrAboveBaseline": -20.0}}).status_code == 422

    # Out of range recoveryIndex (< -6 or > 3)
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"recoveryIndex": 4.0}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"recoveryIndex": -7.0}}).status_code == 422

    # Out of range / non-integer missedMeds7d
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"missedMeds7d": 8}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"missedMeds7d": -1}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"missedMeds7d": 2.5}}).status_code == 422

    # Out of range / non-integer rehabSessions7d
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"rehabSessions7d": 9}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"rehabSessions7d": 1.5}}).status_code == 422

    # Unknown key -> 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"nonExistent": 1.0}}).status_code == 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"stepsRatio": 1.0, "badKey": 2}}).status_code == 422

    # Extra root key -> 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {"stepsRatio": 1.0}, "extra": 123}).status_code == 422

    # Empty overrides -> 422
    assert client.post("/api/v2/patients/PT-8092/what-if", json={"overrides": {}}).status_code == 422


def test_w4_error_status_codes(client, fresh_store):
    """W4: unknown patient 404; uncalibrated, stale -> 409."""
    # Unknown patient -> 404
    res_404 = client.post("/api/v2/patients/PT-DOES-NOT-EXIST/what-if", json={
        "overrides": {"stepsRatio": 1.0}
    })
    assert res_404.status_code == 404

    # Uncalibrated patient (fewer than 3 valid baseline readings) -> 409
    uncal_pid = "PT-UNCAL-WHATIF"
    fresh_store.patient_map[uncal_pid] = {
        "id": uncal_pid,
        "name": "Uncalibrated",
        "age": 60,
        "gender": "Male",
        "lvef": 45.0,
        "diabetes": False,
        "hba1c": 5.8,
        "egfr": 80.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": [
            {"day": 1, "resting_hr": 72.0, "hrv": 50.0, "steps": 5000, "sleep_hours": 7.0}
        ]
    }
    fresh_store.refresh(uncal_pid)

    res_uncal = client.post(f"/api/v2/patients/{uncal_pid}/what-if", json={
        "overrides": {"stepsRatio": 1.0}
    })
    assert res_uncal.status_code == 409
    assert "calibrated" in res_uncal.json()["detail"].lower()

    # Stale patient (dataAgeDays >= 3) -> 409
    stale_pid = "PT-STALE-WHATIF"
    readings = [
        {"day": d, "resting_hr": 70.0, "hrv": 50.0, "steps": 5000, "sleep_hours": 7.0, "med_adherence": True, "rehab_attended": False, "spo2": 98, "bp_sys": 120, "bp_dia": 80, "red_flag": None}
        for d in range(1, 6)
    ]
    # Add gap of 4 days: last reading is day 5, but we insert empty days up to day 9
    for d in range(6, 10):
        readings.append({"day": d, "resting_hr": None, "hrv": None, "steps": None, "sleep_hours": None, "med_adherence": False, "rehab_attended": False, "spo2": None, "bp_sys": None, "bp_dia": None, "red_flag": None})

    fresh_store.patient_map[stale_pid] = {
        "id": stale_pid,
        "name": "Stale Patient",
        "age": 60,
        "gender": "Male",
        "lvef": 45.0,
        "diabetes": False,
        "hba1c": 5.8,
        "egfr": 80.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": readings
    }
    fresh_store.refresh(stale_pid)

    twin = fresh_store.compute_twin(stale_pid)
    assert twin["staleData"] is True

    res_stale = client.post(f"/api/v2/patients/{stale_pid}/what-if", json={
        "overrides": {"stepsRatio": 1.0}
    })
    assert res_stale.status_code == 409
    assert "stale" in res_stale.json()["detail"].lower()


def test_w5_no_forbidden_words_in_response(client, fresh_store):
    """W5: the response never contains the words 'recommend', 'should', 'treatment' or 'advice'
    except inside the constant note."""
    res = client.post("/api/v2/patients/PT-8092/what-if", json={
        "overrides": {"stepsRatio": 1.0, "sleepHours": 7.5}
    })
    assert res.status_code == 200
    data = res.json()

    expected_note = (
        "Scenario only: the selected value is changed and everything else is held fixed. "
        "Real changes usually move several measures together. This is not a prediction and not advice. "
        "Zones also need 2 consecutive days above a cutoff."
    )
    assert data["note"] == expected_note

    # Check all fields except the constant note for forbidden words
    data_without_note = {k: v for k, v in data.items() if k != "note"}
    dumped = json.dumps(data_without_note).lower()

    for forbidden in ["recommend", "should", "treatment", "advice"]:
        assert forbidden not in dumped, f"Forbidden word '{forbidden}' found in what-if response: {data_without_note}"


def test_w6_cache_and_store_unchanged_after_call(client, fresh_store):
    """W6: cache and store unchanged after the what-if call."""
    twin_before = copy.deepcopy(fresh_store.compute_twin("PT-8092"))
    summaries_before = copy.deepcopy(fresh_store.get_all_patients())
    raw_before = copy.deepcopy(fresh_store._raw_feature_cache["PT-8092"])
    patient_before = copy.deepcopy(fresh_store.patient_map["PT-8092"])

    # Call what-if with substantial overrides
    res = client.post("/api/v2/patients/PT-8092/what-if", json={
        "overrides": {"stepsRatio": 0.2, "sleepHours": 4.0, "hrAboveBaseline": 15.0}
    })
    assert res.status_code == 200

    twin_after = fresh_store.compute_twin("PT-8092")
    summaries_after = fresh_store.get_all_patients()
    raw_after = fresh_store._raw_feature_cache["PT-8092"]
    patient_after = fresh_store.patient_map["PT-8092"]

    assert twin_after == twin_before
    assert summaries_after == summaries_before
    assert raw_after == raw_before
    assert patient_after == patient_before


def test_w7_score_history_and_recent_readings_shapes(client, fresh_store):
    """W7: scoreHistory and recentReadings shapes, with nulls for missing days."""
    twin = fresh_store.compute_twin("PT-8092")

    # scoreHistory shape
    score_history = twin.get("scoreHistory")
    assert isinstance(score_history, list)
    assert 1 <= len(score_history) <= 14
    for entry in score_history:
        assert "day" in entry and isinstance(entry["day"], int)
        assert "p50" in entry and isinstance(entry["p50"], (float, int))

    # recentReadings shape: last 7 calendar days
    recent = twin.get("recentReadings")
    assert isinstance(recent, list)
    assert len(recent) == 7
    expected_vitals_keys = {"day", "restingHR", "hrv", "steps", "sleepHours", "spo2", "bpSys", "bpDia"}
    for r in recent:
        assert set(r.keys()) == expected_vitals_keys

    # Missing day handling: create patient with day 8 missing
    pid_gap = "PT-READING-GAP"
    readings = [
        {"day": d, "resting_hr": 70.0, "hrv": 50.0, "steps": 5000, "sleep_hours": 7.0, "spo2": 98, "bp_sys": 120, "bp_dia": 80, "med_adherence": True, "rehab_attended": False, "red_flag": None}
        for d in range(1, 8)
    ]
    # Day 8 missing
    readings.append({
        "day": 8, "resting_hr": None, "hrv": None, "steps": None, "sleep_hours": None, "spo2": None, "bp_sys": None, "bp_dia": None, "med_adherence": False, "rehab_attended": False, "red_flag": None
    })
    # Day 9 present
    readings.append({
        "day": 9, "resting_hr": 72.0, "hrv": 48.0, "steps": 4800, "sleep_hours": 6.5, "spo2": 97, "bp_sys": 122, "bp_dia": 82, "med_adherence": True, "rehab_attended": False, "red_flag": None
    })

    fresh_store.patient_map[pid_gap] = {
        "id": pid_gap,
        "name": "Gap Patient",
        "age": 55,
        "gender": "Male",
        "lvef": 45.0,
        "diabetes": False,
        "hba1c": 5.8,
        "egfr": 80.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": readings
    }
    fresh_store.refresh(pid_gap)

    twin_gap = fresh_store.compute_twin(pid_gap)
    recent_gap = twin_gap["recentReadings"]
    assert len(recent_gap) == 7

    # Find day 8 entry
    day8_entry = next((r for r in recent_gap if r["day"] == 8), None)
    assert day8_entry is not None
    assert day8_entry["restingHR"] is None
    assert day8_entry["hrv"] is None
    assert day8_entry["steps"] is None
    assert day8_entry["sleepHours"] is None
    assert day8_entry["spo2"] is None
    assert day8_entry["bpSys"] is None
    assert day8_entry["bpDia"] is None

    # Find day 9 entry
    day9_entry = next((r for r in recent_gap if r["day"] == 9), None)
    assert day9_entry is not None
    assert day9_entry["restingHR"] == 72.0
    assert day9_entry["steps"] == 4800
