import os
import sqlite3
import pytest
from fastapi.testclient import TestClient

from api.db import Database
from api.cohort_v2_store import CohortStore
from api.models import WearablePacketInput
from api.simulator import WearableStreamSimulator
from api.main import app

@pytest.fixture
def test_db(tmp_path):
    db_file = str(tmp_path / "test_app.db")
    return Database(db_file)

def test_t1_persistence_round_trip(test_db):
    """
    T1: Ingest 3 packets, build a new CohortStore from the same DB,
    twin state, scoreHistory, and zone are identical.
    """
    store1 = CohortStore(num_patients=20, days_count=60, seed=42, db_instance=test_db)
    pid = "PT-8092"
    initial_last_day = store1.patient_map[pid]["daily_readings"][-1]["day"]
    assert initial_last_day == 14

    # Ingest 3 valid packets
    for d in (15, 16, 17):
        packet = {
            "day": d,
            "resting_hr": 78.0 + (d - 14) * 0.5,
            "hrv": max(50.0 - (d - 14) * 0.8, 35.0),
            "steps": 6000 - (d - 14) * 100,
            "sleep_hours": 6.5,
            "med_adherence": True,
            "rehab_attended": False,
            "spo2": 97,
            "bp_sys": 128,
            "bp_dia": 82,
            "red_flag": None
        }
        res = store1.ingest_reading(pid, packet, source="api")
        assert res["status"] == "ingested"

    twin1 = store1.compute_twin(pid)
    zone1 = twin1["triageZone"]
    score_history1 = twin1["scoreHistory"]
    p50_1 = twin1["p50"]
    score_day1 = twin1["scoreDay"]
    last_ingest_1 = twin1["lastIngestAt"]
    stream_source_1 = twin1["streamSource"]

    # Re-instantiate CohortStore pointing to same DB
    store2 = CohortStore(num_patients=20, days_count=60, seed=42, db_instance=test_db)
    twin2 = store2.compute_twin(pid)

    assert twin2["triageZone"] == zone1
    assert twin2["p50"] == p50_1
    assert twin2["scoreDay"] == score_day1
    assert twin2["scoreHistory"] == score_history1
    assert twin2["lastIngestAt"] == last_ingest_1
    assert twin2["streamSource"] == stream_source_1
    assert store2.patient_map[pid]["daily_readings"][-1]["day"] == 17

def test_t2_meta_mismatch(test_db):
    """
    T2: Meta mismatch (seed changed) -> persisted data refused, seed cohort served.
    """
    # Seed cohort with seed=42
    store1 = CohortStore(num_patients=20, days_count=60, seed=42, db_instance=test_db)
    pid = "PT-8092"
    store1.ingest_reading(pid, {
        "day": 15,
        "resting_hr": 80.0,
        "hrv": 45.0,
        "steps": 5000,
        "sleep_hours": 6.0,
        "med_adherence": True,
        "rehab_attended": False,
        "spo2": 96,
        "bp_sys": 130,
        "bp_dia": 85,
        "red_flag": None
    })
    assert store1.patient_map[pid]["daily_readings"][-1]["day"] == 15

    # Start store with seed=999 on the same DB -> mismatch
    store_mismatch = CohortStore(num_patients=20, days_count=60, seed=999, db_instance=test_db)
    # Persisted data refused, clean seed cohort served
    assert store_mismatch.patient_map[pid]["daily_readings"][-1]["day"] == 14

def test_t3_schema_and_static_check(test_db):
    """
    T3: Schema has no table/column name containing 'event'.
    Static check that api/simulator.py and api/db.py never reference event_day or _hidden_event_day.
    """
    with test_db.get_connection() as conn:
        tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
        for t in tables:
            assert "event" not in t.lower(), f"Table name '{t}' contains 'event'"
            for col in conn.execute(f"PRAGMA table_info({t})"):
                col_name = col[1]
                assert "event" not in col_name.lower(), f"Column name '{t}.{col_name}' contains 'event'"

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for rel_path in ("api/simulator.py", "api/db.py"):
        full_path = os.path.join(repo_root, rel_path)
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "event_day" not in content, f"Forbidden 'event_day' in {rel_path}"
        assert "_hidden_event_day" not in content, f"Forbidden '_hidden_event_day' in {rel_path}"

def test_t4_simulator_determinism(tmp_path):
    """
    T4: Simulator determinism: same seed and tick sequence -> identical packets.
    """
    db_path1 = str(tmp_path / "sim1.db")
    db_path2 = str(tmp_path / "sim2.db")
    db1 = Database(db_path1)
    db2 = Database(db_path2)

    store1 = CohortStore(num_patients=20, days_count=60, seed=42, db_instance=db1)
    store2 = CohortStore(num_patients=20, days_count=60, seed=42, db_instance=db2)

    sim1 = WearableStreamSimulator(store=store1, db_instance=db1)
    sim2 = WearableStreamSimulator(store=store2, db_instance=db2)

    for _ in range(4):
        res1 = sim1.tick()
        res2 = sim2.tick()
        assert len(res1) == len(res2)
        for r1, r2 in zip(res1, res2):
            assert r1["patient_id"] == r2["patient_id"]
            assert r1["day"] == r2["day"]
            assert r1["p50"] == r2["p50"]
            assert r1["triageZone"] == r2["triageZone"]

def test_t5_simulator_validation_and_lifecycle(tmp_path):
    """
    T5: Every simulated packet validates against WearablePacketInput; no day above days_count;
    no patient advances twice per tick; exhausted patients stop; restart resumes via sim_state.
    """
    db_path = str(tmp_path / "sim_lifecycle.db")
    db_inst = Database(db_path)
    store = CohortStore(num_patients=15, days_count=20, seed=42, db_instance=db_inst)
    sim = WearableStreamSimulator(store=store, db_instance=db_inst)

    for _ in range(10):
        res = sim.tick()
        seen_pids = set()
        for r in res:
            pid = r["patient_id"]
            day = r["day"]
            assert pid not in seen_pids, f"Patient {pid} advanced twice in a single tick"
            seen_pids.add(pid)
            assert day <= 20, f"Patient {pid} advanced past days_count {day} > 20"

    sim_state = db_inst.get_sim_state()
    for pid, next_d in sim_state.items():
        assert next_d <= 21

    # Restart test
    state_before = dict(sim_state)
    sim2 = WearableStreamSimulator(store=store, db_instance=db_inst)
    state_after = sim2.db.get_sim_state()
    assert state_before == state_after

def test_t6_alerts_transitions_and_endpoints(tmp_path, monkeypatch):
    """
    T6: Transition creates alert; a repeat of the same state creates none;
    transition to red creates a new one; PATCH marks read; unknown id 404; ?unread=true works.
    """
    db_file = str(tmp_path / "alerts.db")
    test_db = Database(db_file)
    monkeypatch.setattr("api.routes_v2.db", test_db)
    monkeypatch.setattr("api.db.db", test_db)
    store = CohortStore(num_patients=10, days_count=60, seed=42, db_instance=test_db)

    # Pick a patient currently in green
    green_pids = [
        pid for pid, p in store.patient_map.items()
        if store.compute_twin(pid).get("triageZone") == "green" and not store.compute_twin(pid).get("watch")
    ]
    assert len(green_pids) > 0
    pid = green_pids[0]

    last_d = store.patient_map[pid]["daily_readings"][-1]["day"]

    # 1. First elevated day: triggers watch alert (exactly one new alert for patient)
    initial_alerts = len(test_db.get_alerts())
    store.ingest_reading(pid, {
        "day": last_d + 1,
        "resting_hr": 85.0,
        "hrv": 40.0,
        "steps": 4000,
        "sleep_hours": 6.0,
        "med_adherence": True,
        "rehab_attended": False,
        "spo2": 97,
        "bp_sys": 125,
        "bp_dia": 80,
        "red_flag": None
    })
    alerts_after_1 = test_db.get_alerts()
    assert len(alerts_after_1) == initial_alerts + 1
    first_alert = alerts_after_1[0]
    first_alert_id = first_alert["id"]

    # 2. Second consecutive day: triggers transition to scored alert zone
    store.ingest_reading(pid, {
        "day": last_d + 2,
        "resting_hr": 85.0,
        "hrv": 40.0,
        "steps": 4000,
        "sleep_hours": 6.0,
        "med_adherence": True,
        "rehab_attended": False,
        "spo2": 97,
        "bp_sys": 125,
        "bp_dia": 80,
        "red_flag": None
    })
    alerts_after_2 = test_db.get_alerts()
    assert len(alerts_after_2) == initial_alerts + 2
    state_after_2 = store.compute_twin(pid)["triageZone"]

    # 3. Third day with same state: repeat of same state creates NONE
    store.ingest_reading(pid, {
        "day": last_d + 3,
        "resting_hr": 85.0,
        "hrv": 40.0,
        "steps": 4000,
        "sleep_hours": 6.0,
        "med_adherence": True,
        "rehab_attended": False,
        "spo2": 97,
        "bp_sys": 125,
        "bp_dia": 80,
        "red_flag": None
    })
    alerts_after_3 = test_db.get_alerts()
    assert len(alerts_after_3) == len(alerts_after_2), "Repeat of same state created a duplicate alert"

    # 4. Fourth day: acute red_flag symptom triggers new Red alert
    store.ingest_reading(pid, {
        "day": last_d + 4,
        "resting_hr": 85.0,
        "hrv": 40.0,
        "steps": 4000,
        "sleep_hours": 6.0,
        "med_adherence": True,
        "rehab_attended": False,
        "spo2": 97,
        "bp_sys": 125,
        "bp_dia": 80,
        "red_flag": "chest_pain"
    })
    alerts_after_4 = test_db.get_alerts()
    assert len(alerts_after_4) == len(alerts_after_3) + 1

    # Test API endpoints with TestClient
    client = TestClient(app)
    # GET /api/v2/alerts
    resp = client.get("/api/v2/alerts")
    assert resp.status_code == 200
    all_alerts = resp.json()
    assert len(all_alerts) > 0

    # PATCH /api/v2/alerts/{id}/read
    patch_resp = client.patch(f"/api/v2/alerts/{first_alert_id}/read")
    assert patch_resp.status_code == 200
    assert patch_resp.json()["read"] is True

    # Unknown id 404
    unknown_resp = client.patch("/api/v2/alerts/999999/read")
    assert unknown_resp.status_code == 404

    # ?unread=true filter works
    unread_resp = client.get("/api/v2/alerts?unread=true")
    assert unread_resp.status_code == 200
    unreads = unread_resp.json()
    for a in unreads:
        assert a["read"] is False

def test_t7_simulator_endpoints_security_and_disabled():
    """
    T7: SIM_ENABLED unset -> all /api/sim/* return 404; non-localhost client -> 403.
    """
    client = TestClient(app)

    # Case 1: SIM_ENABLED is unset
    os.environ.pop("SIM_ENABLED", None)
    for path in ("/api/sim/status", "/api/sim/pause", "/api/sim/resume", "/api/sim/reset"):
        r = client.get(path) if path == "/api/sim/status" else client.post(path)
        assert r.status_code == 404, f"{path} did not return 404 when SIM_ENABLED unset"

    # Case 2: SIM_ENABLED=1
    os.environ["SIM_ENABLED"] = "1"
    try:
        # Non-localhost client -> 403 (using X-Forwarded-For header)
        r_forbidden = client.get("/api/sim/status", headers={"X-Forwarded-For": "192.168.1.100"})
        assert r_forbidden.status_code == 403, f"Non-localhost client got {r_forbidden.status_code}, expected 403"

        # Localhost client -> 200
        r_ok = client.get("/api/sim/status")
        assert r_ok.status_code == 200
        status_data = r_ok.json()
        assert "running" in status_data
        assert "tickSeconds" in status_data
        assert "patientsActive" in status_data
        assert "patientsExhausted" in status_data
    finally:
        os.environ.pop("SIM_ENABLED", None)
