"""
Tests for API Hardening per PART B:
A1 Ingest changes cached state of existing patient within the same request.
A2 Unknown patient 404; duplicate or earlier day 409; out-of-range or partial sensor set 422.
A3 Gap inserts missing entries and no alert is created across the gap.
A4 Ingested chest_pain flag gives redSource "symptom" in the same response.
A5 Ingested reading with only required fields does not crash features.py.
A6 Explain identity: baseLogit + sum(logitContribution) == calibratedLogit (tol < 1e-9).
A7 Model-card keys, and 503 when reports are missing.
A8 Default CORS has no wildcard with credentials.
A9 Two flags within 72 h form one episode with deduplicated True.
"""

import os
import json
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from api.main import app
from api.cohort_v2_store import CohortStore, cohort_store
from twin.forecast import RiskForecaster
from twin.zones import TriageZoneStateMachine


@pytest.fixture
def fresh_store(monkeypatch):
    store = CohortStore()
    monkeypatch.setattr("api.main.cohort_store", store)
    monkeypatch.setattr("api.routes_v2.cohort_store", store)
    return store


@pytest.fixture
def client():
    return TestClient(app)


def test_a1_ingest_changes_cached_state_within_same_request(client, fresh_store):
    """A1: ingest changes the cached state of an existing patient within the same request."""
    # Ensure PT-8092 exists
    assert "PT-8092" in fresh_store.patient_map
    curr_readings = fresh_store.patient_map["PT-8092"]["daily_readings"]
    last_day = curr_readings[-1]["day"]
    next_day = last_day + 1

    payload = {
        "patient_id": "PT-8092",
        "day": next_day,
        "resting_hr": 85.0,
        "hrv": 35.0,
        "steps": 4000,
        "sleep_hours": 6.0,
        "med_adherence": True,
        "rehab_attended": False,
        "spo2": 96,
        "bp_sys": 135,
        "bp_dia": 85,
        "red_flag": None
    }

    response = client.post("/api/ingest/wearable", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "ingested"
    assert data["patient_id"] == "PT-8092"
    assert data["day"] == next_day
    assert "triageZone" in data
    assert "p50" in data
    assert data["scoreDay"] == next_day

    # Check that cache was updated synchronously
    twin = fresh_store.compute_twin("PT-8092")
    assert twin["scoreDay"] == next_day
    assert twin["p50"] == data["p50"]


def test_a2_validation_and_errors(client):
    """A2: unknown patient 404; duplicate or earlier day 409; out-of-range or partial sensor set 422."""
    # Unknown patient -> 404
    resp_404 = client.post("/api/ingest/wearable", json={
        "patient_id": "PT-DOES-NOT-EXIST",
        "day": 10,
        "resting_hr": 70.0,
        "hrv": 45.0,
        "steps": 5000,
        "sleep_hours": 7.0
    })
    assert resp_404.status_code == 404

    # Duplicate or earlier day -> 409
    resp_409 = client.post("/api/ingest/wearable", json={
        "patient_id": "PT-8092",
        "day": 5,  # PT-8092 already has day 5
        "resting_hr": 70.0,
        "hrv": 45.0,
        "steps": 5000,
        "sleep_hours": 7.0
    })
    assert resp_409.status_code == 409

    # Out of range hr -> 422
    resp_hr = client.post("/api/ingest/wearable", json={
        "patient_id": "PT-8092",
        "day": 100,
        "resting_hr": 250.0,  # > 220
        "hrv": 45.0,
        "steps": 5000,
        "sleep_hours": 7.0
    })
    assert resp_hr.status_code == 422

    # Out of range spo2 -> 422
    resp_spo2 = client.post("/api/ingest/wearable", json={
        "patient_id": "PT-8092",
        "day": 100,
        "resting_hr": 70.0,
        "hrv": 45.0,
        "steps": 5000,
        "sleep_hours": 7.0,
        "spo2": 40  # < 50
    })
    assert resp_spo2.status_code == 422

    # Partial sensor set (steps None but resting_hr present) -> 422
    resp_partial = client.post("/api/ingest/wearable", json={
        "patient_id": "PT-8092",
        "day": 100,
        "resting_hr": 70.0,
        "hrv": 45.0,
        "steps": None,
        "sleep_hours": 7.0
    })
    assert resp_partial.status_code == 422

    # Disallowed extra field event_day -> 422
    resp_event = client.post("/api/ingest/wearable", json={
        "patient_id": "PT-8092",
        "day": 100,
        "resting_hr": 70.0,
        "hrv": 45.0,
        "steps": 5000,
        "sleep_hours": 7.0,
        "event_day": 15
    })
    assert resp_event.status_code == 422


def test_a3_gap_inserts_missing_entries_no_alert(client, fresh_store):
    """A3: a gap inserts missing entries and no alert is created across the gap (zone green),
    plus a control test with the same high readings on adjacent days that DOES alert."""
    pid = "PT-GAP-TEST"
    fresh_store.patient_map[pid] = {
        "id": pid,
        "name": "Gap Patient",
        "age": 55,
        "gender": "Male",
        "lvef": 45.0,
        "diabetes": True,
        "hba1c": 6.8,
        "egfr": 75.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": [
            {"day": d, "resting_hr": 70.0, "hrv": 50.0, "steps": 5000, "sleep_hours": 7.0, "med_adherence": True, "rehab_attended": False, "spo2": 98, "bp_sys": 120, "bp_dia": 80, "red_flag": None}
            for d in range(1, 6)
        ]
    }
    fresh_store.refresh(pid)
    jump_d = 8  # skips day 6 and 7

    payload = {
        "patient_id": pid,
        "day": jump_d,
        "resting_hr": 95.0,
        "hrv": 20.0,
        "steps": 2000,
        "sleep_hours": 5.0,
        "med_adherence": True
    }
    res = client.post("/api/ingest/wearable", json=payload)
    assert res.status_code == 200

    readings = fresh_store.patient_map[pid]["daily_readings"]
    day_map = {r["day"]: r for r in readings}

    # Verify skipped days were inserted
    assert 6 in day_map
    assert 7 in day_map
    assert day_map[6]["resting_hr"] is None
    assert day_map[7]["resting_hr"] is None

    # Across a gap, hysteresis rule requires 2 consecutive days: must remain green
    twin = fresh_store.compute_twin(pid)
    assert twin["triageZone"] == "green", f"Expected green after gap, got {twin['triageZone']}"

    # Control test: same high readings on adjacent days (day 6 and day 7) DOES alert (yellow or red)
    pid_ctrl = "PT-CTRL-TEST"
    fresh_store.patient_map[pid_ctrl] = {
        "id": pid_ctrl,
        "name": "Control Patient",
        "age": 55,
        "gender": "Male",
        "lvef": 45.0,
        "diabetes": True,
        "hba1c": 6.8,
        "egfr": 75.0,
        "family_history_cad": False,
        "smoker": False,
        "daily_readings": [
            {"day": d, "resting_hr": 70.0, "hrv": 50.0, "steps": 5000, "sleep_hours": 7.0, "med_adherence": True, "rehab_attended": False, "spo2": 98, "bp_sys": 120, "bp_dia": 80, "red_flag": None}
            for d in range(1, 6)
        ]
    }
    fresh_store.refresh(pid_ctrl)

    # Ingest high reading on day 6
    res_ctrl1 = client.post("/api/ingest/wearable", json={
        "patient_id": pid_ctrl,
        "day": 6,
        "resting_hr": 95.0,
        "hrv": 20.0,
        "steps": 2000,
        "sleep_hours": 5.0,
        "med_adherence": True
    })
    assert res_ctrl1.status_code == 200

    # Ingest high reading on adjacent day 7
    res_ctrl2 = client.post("/api/ingest/wearable", json={
        "patient_id": pid_ctrl,
        "day": 7,
        "resting_hr": 95.0,
        "hrv": 20.0,
        "steps": 2000,
        "sleep_hours": 5.0,
        "med_adherence": True
    })
    assert res_ctrl2.status_code == 200

    twin_ctrl = fresh_store.compute_twin(pid_ctrl)
    assert twin_ctrl["triageZone"] in ("yellow", "red"), f"Expected alert on adjacent days, got {twin_ctrl['triageZone']}"


def test_a4_chest_pain_red_source_symptom(client, fresh_store):
    """A4: an ingested chest_pain flag gives redSource 'symptom' in the same response."""
    pid = "PT-SYMP-TEST"
    fresh_store.patient_map[pid] = {
        "id": pid,
        "name": "Symptom Patient",
        "age": 60,
        "gender": "Female",
        "lvef": 50.0,
        "diabetes": False,
        "hba1c": 5.7,
        "egfr": 85.0,
        "family_history_cad": True,
        "smoker": False,
        "daily_readings": [
            {"day": d, "resting_hr": 70.0, "hrv": 50.0, "steps": 5000, "sleep_hours": 7.0, "med_adherence": True, "rehab_attended": False, "spo2": 98, "bp_sys": 120, "bp_dia": 80, "red_flag": None}
            for d in range(1, 6)
        ]
    }
    fresh_store.refresh(pid)

    payload = {
        "patient_id": pid,
        "day": 6,
        "resting_hr": 72.0,
        "hrv": 48.0,
        "steps": 4500,
        "sleep_hours": 7.0,
        "red_flag": "chest_pain"
    }
    res = client.post("/api/ingest/wearable", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["triageZone"] == "red"
    assert data["redSource"] in ("symptom", "both")


def test_a5_minimal_required_fields_does_not_crash_features(client, fresh_store):
    """A5: an ingested reading with only required fields does not crash features.py."""
    pid = "PT-MIN-TEST"
    fresh_store.patient_map[pid] = {
        "id": pid,
        "name": "Minimal Patient",
        "age": 58,
        "gender": "Male",
        "lvef": 48.0,
        "diabetes": False,
        "hba1c": 5.9,
        "egfr": 78.0,
        "family_history_cad": False,
        "smoker": True,
        "daily_readings": [
            {"day": d, "resting_hr": 72.0, "hrv": 45.0, "steps": 6000, "sleep_hours": 7.0, "med_adherence": True}
            for d in range(1, 5)
        ]
    }
    fresh_store.refresh(pid)

    # Ingest without spo2, bp_sys, bp_dia, rehab_attended, red_flag
    payload = {
        "patient_id": pid,
        "day": 5,
        "resting_hr": 74.0,
        "hrv": 44.0,
        "steps": 5800,
        "sleep_hours": 6.8
    }
    res = client.post("/api/ingest/wearable", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ingested"
    assert data["p50"] is not None


def test_a6_explain_identity():
    """A6: explain identity baseLogit + sum(logitContribution) == calibrated logit (tol < 1e-9);
    D2: ungrouped sum + baseLogit == calibrated logit; grouped sum equals the same total."""
    rf = RiskForecaster()
    # 15 features
    x_raw = [62.0, 48.0, 1.0, 7.2, 65.0, 1.0, 0.0, 0.45, 0.02, 3.2, 0.85, 6.5, 1.0, 1.0, 0.0]
    exp = rf.explain(x_raw)

    base_logit = exp["baseLogit"]
    contributions = exp["features"]
    calibrated_logit = exp["calibratedLogit"]

    assert len(contributions) == 15
    sum_contrib = sum(c["logitContribution"] for c in contributions)
    diff = abs(base_logit + sum_contrib - calibrated_logit)
    assert diff < 1e-9, f"Explain identity violated: diff {diff} >= 1e-9"

    # D2: Grouped sum equals the same total
    static_features = {"age", "lvef", "diabetes", "hba1c", "egfr", "family_history_cad", "smoker"}
    static_sum = sum(c["logitContribution"] for c in contributions if c["feature"] in static_features)
    grouped_contributions = [c for c in contributions if c["feature"] not in static_features]
    grouped_contributions.append({
        "feature": "baseline_clinical_profile",
        "logitContribution": static_sum
    })
    grouped_sum = sum(c["logitContribution"] for c in grouped_contributions)
    assert abs(grouped_sum - sum_contrib) < 1e-9, f"Grouped sum {grouped_sum} != ungrouped sum {sum_contrib}"
    assert abs(base_logit + grouped_sum - calibrated_logit) < 1e-9

    # Drivers is top 6 by absolute contribution
    drivers = exp["drivers"]
    assert len(drivers) == 6
    for i in range(len(drivers) - 1):
        assert abs(drivers[i]["logitContribution"]) >= abs(drivers[i+1]["logitContribution"])


def test_a7_model_card_keys_and_503(client):
    """A7: model-card keys, and 503 when the reports are missing."""
    res = client.get("/api/model-card")
    assert res.status_code == 200, res.text
    card = res.json()

    required_keys = [
        "modelVersion", "trainedOn", "horizonDays", "testPositiveRate",
        "rocAuc", "prAuc", "yellowCatchRate", "redCatchRate",
        "episodePrecision", "calibrationNote", "limitations", "syntheticOnly"
    ]
    for k in required_keys:
        assert k in card, f"Missing key in model-card: {k}"

    assert card["horizonDays"] == 7
    assert card["syntheticOnly"] is True
    assert isinstance(card["limitations"], list)
    assert len(card["limitations"]) > 0

    # 503 when load_model_card returns None
    with patch("api.main.load_model_card", return_value=None):
        res_503 = client.get("/api/model-card")
        assert res_503.status_code == 503


def test_a8_default_cors_has_no_wildcard_with_credentials(client):
    """A8: default CORS has no wildcard with credentials."""
    # Inspect CORS middleware attached to FastAPI app
    cors_mw = None
    for mw in app.user_middleware:
        if "CORSMiddleware" in str(mw.cls):
            cors_mw = mw
            break

    assert cors_mw is not None, "CORSMiddleware not found on app"
    allow_origins = cors_mw.kwargs.get("allow_origins", [])
    allow_credentials = cors_mw.kwargs.get("allow_credentials", False)

    # Must never be wildcard together with credentials
    if allow_credentials:
        assert "*" not in allow_origins, "Wildcard '*' origin cannot be combined with allow_credentials=True"
    # By default, allow_credentials should be False when default origins are used
    if "CORS_ORIGINS" not in os.environ:
        assert allow_credentials is False


def test_a9_episode_deduplication():
    """A9: two flags within 72 h form one episode with deduplicated True."""
    zm = TriageZoneStateMachine()

    # Two flags on day 4 and day 6 (gap 2 days <= 3 days = 72h)
    flags = [
        {"day": 4, "type": "chest_pain"},
        {"day": 6, "type": "syncope"}
    ]
    res_dedup = zm.evaluate_triage_state(
        is_calibrated=True,
        recent_scores=[(4, 0.02), (5, 0.02), (6, 0.02)],
        acute_red_flags=flags,
        patient_id="PT-DEDUP",
        current_day=6
    )

    assert res_dedup["zone"] == "red"
    ep = res_dedup["active_episode"]
    assert ep is not None
    assert ep["deduplicated"] is True, f"Expected deduplicated=True for 2 flags within 72h, got {ep}"
    assert "D4" in ep["id"], f"Expected episode id built from earliest day D4, got {ep['id']}"

    # Single flag has deduplicated False
    res_single = zm.evaluate_triage_state(
        is_calibrated=True,
        recent_scores=[(6, 0.02)],
        acute_red_flags=[{"day": 6, "type": "syncope"}],
        patient_id="PT-SINGLE",
        current_day=6
    )
    assert res_single["active_episode"]["deduplicated"] is False
