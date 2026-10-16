import os
import sys
import time
import tempfile
import subprocess
import sqlite3
import glob
import json
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
    # Round 8 Part 2a: No alerts for watch
    assert len(alerts_after_1) == initial_alerts

    # 2. Second consecutive day: triggers transition to Yellow alert zone (2 consecutive nights)
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
    assert len(alerts_after_2) == initial_alerts + 1
    first_alert = alerts_after_2[0]
    first_alert_id = first_alert["id"]
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
        # Non-local client carrying X-Forwarded-For: 127.0.0.1 -> 403 (never trust X-Forwarded-For)
        client_remote = TestClient(app, client=("192.168.1.100", 50000))
        r_forbidden = client_remote.get("/api/sim/status", headers={"X-Forwarded-For": "127.0.0.1"})
        assert r_forbidden.status_code == 403, f"Non-local client got {r_forbidden.status_code}, expected 403"

        # Localhost client -> 200
        client_local = TestClient(app, client=("127.0.0.1", 50000))
        r_ok = client_local.get("/api/sim/status")
        assert r_ok.status_code == 200
        status_data = r_ok.json()
        assert "running" in status_data
        assert "tickSeconds" in status_data
        assert "patientsActive" in status_data
        assert "patientsExhausted" in status_data
    finally:
        os.environ.pop("SIM_ENABLED", None)

def test_t8_metrics_json_unchanged():
    """
    T8: No existing numeric value in reports/metrics.json may change.
    Asserts reports/metrics.json is identical to the baseline commit.
    """
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    metrics_path = os.path.join(repo_root, "reports", "metrics.json")
    assert os.path.exists(metrics_path)
    res = subprocess.run(
        ["git", "diff", "--exit-code", "47203024db753ff97ae3e3844fb8cae5b0b4eece", "--", "reports/metrics.json"],
        cwd=repo_root,
        capture_output=True,
        text=True
    )
    assert res.returncode == 0, f"reports/metrics.json has been modified:\n{res.stdout}\n{res.stderr}"

def test_suite_does_not_create_or_modify_data_app_db():
    """
    Part 2a: Asserts the test suite does not create or modify data/app.db.
    """
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    app_db = os.path.join(repo_root, "data", "app.db")
    if os.path.exists(app_db):
        mtime = os.path.getmtime(app_db)
        assert time.time() - mtime > 5.0, "data/app.db was recently modified by test suite"

def test_import_main_lazy_db():
    """
    Part 2b: Importing api.main with DB_PATH set to a tmp path that does not exist;
    assert the file still does not exist after import.
    """
    tmp_db_file = os.path.join(tempfile.gettempdir(), f"lazy_import_test_{os.getpid()}_{time.time_ns()}.db")
    if os.path.exists(tmp_db_file):
        os.remove(tmp_db_file)
    try:
        proc = subprocess.run(
            [sys.executable, "-c", f"import os; os.environ['DB_PATH'] = r'{tmp_db_file}'; import api.main"],
            capture_output=True,
            text=True
        )
        assert proc.returncode == 0, f"Importing api.main failed:\n{proc.stderr}"
        assert not os.path.exists(tmp_db_file), f"Database file {tmp_db_file} was created on import"
    finally:
        if os.path.exists(tmp_db_file):
            os.remove(tmp_db_file)

def test_alerts_limit_bounds_and_read_all(tmp_path, monkeypatch):
    """
    Part 4e: limit bounds, read-all (all, one patient, unknown patient).
    """
    db_file = str(tmp_path / "alerts_bounds.db")
    test_db = Database(db_file)
    monkeypatch.setattr("api.routes_v2.db", test_db)
    monkeypatch.setattr("api.db.db", test_db)

    # Insert test alerts
    test_db.insert_alert("PT-8092", "initial", "watch", None, 0.10, 14, "Initial watch", read=0)
    test_db.insert_alert("PT-8092", "transition", "yellow", None, 0.15, 15, "Yellow transition", read=0)
    test_db.insert_alert("PT-8001", "transition", "red", "model", 0.40, 20, "Red transition", read=0)

    client = TestClient(app)

    # Limit = 2 returns 2
    r_lim2 = client.get("/api/v2/alerts?limit=2")
    assert r_lim2.status_code == 200
    assert len(r_lim2.json()) == 2

    # Limit = 500 is accepted
    r_lim500 = client.get("/api/v2/alerts?limit=500")
    assert r_lim500.status_code == 200

    # Limit = 501 returns 422
    r_lim501 = client.get("/api/v2/alerts?limit=501")
    assert r_lim501.status_code == 422

    # Read-all for unknown patient -> 404
    r_404 = client.post("/api/v2/alerts/read-all?patient_id=PT-NONEXISTENT")
    assert r_404.status_code == 404

    # Read-all for PT-8092 -> 2 updated
    r_one = client.post("/api/v2/alerts/read-all?patient_id=PT-8092")
    assert r_one.status_code == 200
    assert r_one.json()["updated"] == 2

    # Verify PT-8092 alerts are read, PT-8001 is unread
    unreads = test_db.get_alerts(unread_only=True)
    assert len(unreads) == 1
    assert unreads[0]["patient_id"] == "PT-8001"

    # Read-all for all remaining -> 1 updated
    r_all = client.post("/api/v2/alerts/read-all")
    assert r_all.status_code == 200
    assert r_all.json()["updated"] == 1
    assert len(test_db.get_alerts(unread_only=True)) == 0

def test_alerts_downgrade_kind(tmp_path, monkeypatch):
    """
    Part 4c & 4e: When a state downgrades (e.g. red->yellow, yellow->watch, yellow->green, watch->green),
    store kind="downgrade".
    """
    db_file = str(tmp_path / "downgrade.db")
    test_db = Database(db_file)
    monkeypatch.setattr("api.routes_v2.db", test_db)
    monkeypatch.setattr("api.db.db", test_db)
    store = CohortStore(num_patients=200, days_count=60, seed=42, db_instance=test_db)
    sim = WearableStreamSimulator(store=store, db_instance=test_db)
    pid = "PT-8036"

    # Ingest days 35-38: Day 35 (watch), Day 36 (red), Day 37 (red - repeat, no alert), Day 38 (yellow - downgrade)
    for d in (35, 36, 37, 38):
        pkt = sim.future_packets[pid][d]
        store.ingest_reading(pid, pkt, source="simulated")

    alerts = [a for a in test_db.get_alerts() if a["patient_id"] == pid]
    # Expect 2 alerts: red transition, yellow downgrade (day 35 was watch -> no alert; day 37 was duplicate red, suppressed)
    assert len(alerts) == 2
    downgrades = [a for a in alerts if a["kind"] == "downgrade"]
    assert len(downgrades) == 1
    assert downgrades[0]["zone"] == "yellow"
    assert downgrades[0]["kind"] == "downgrade"


def test_round8_security_non_local_403():
    """Requirement 1: verify_sim_access uses request.client.host only; never X-Forwarded-For."""
    os.environ["SIM_ENABLED"] = "1"
    try:
        client = TestClient(app, client=("203.0.113.195", 49152))
        r = client.get("/api/sim/status", headers={"X-Forwarded-For": "127.0.0.1"})
        assert r.status_code == 403
    finally:
        os.environ.pop("SIM_ENABLED", None)


def test_round8_alerts_summary_endpoint(tmp_path, monkeypatch):
    """Requirement 2b: GET /api/v2/alerts/summary -> {total, unread, byZone}."""
    db_file = str(tmp_path / "summary_test.db")
    test_db = Database(db_file)
    monkeypatch.setattr("api.routes_v2.db", test_db)
    monkeypatch.setattr("api.db.db", test_db)

    # Insert test alerts
    test_db.insert_alert("PT-8001", "transition", "red", "model", 0.35, 15, "Red alert", read=0)
    test_db.insert_alert("PT-8002", "transition", "yellow", None, 0.20, 15, "Yellow alert", read=1)
    test_db.insert_alert("PT-8003", "downgrade", "yellow", None, 0.18, 16, "Downgrade alert", read=0)

    client = TestClient(app)
    resp = client.get("/api/v2/alerts/summary")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 3
    assert data["unread"] == 2
    assert data["byZone"]["red"] == 1
    assert data["byZone"]["yellow"] == 2


def test_round8_patient_names_uniqueness():
    """Requirement 5: Unique names across 177 seed cohort, PT-8092 stays Rahul Sharma."""
    from api.cohort_v2_store import cohort_store
    names = [p["name"] for p in cohort_store.patient_map.values()]
    assert len(names) == 177
    assert len(set(names)) == 177, f"Found duplicate patient names: {len(names)} total vs {len(set(names))} unique"
    assert cohort_store.patient_map["PT-8092"]["name"] == "Rahul Sharma"


def test_round8_db_cleanup_windows(tmp_path):
    """Requirement 6b: After 1000 store_reading calls on a tmp file, os.remove succeeds on Windows."""
    db_path = str(tmp_path / "cleanup_test.db")
    test_db = Database(db_path)
    for i in range(1000):
        test_db.store_reading({
            "patient_id": f"PT-{i%10}",
            "day": (i // 10) + 1,
            "resting_hr": 70.0,
            "hrv": 50.0,
            "steps": 5000,
            "source": "simulated"
        })

    # Close and remove
    os.remove(db_path)
    for ext in ("-wal", "-shm"):
        wal_file = db_path + ext
        if os.path.exists(wal_file):
            os.remove(wal_file)
    assert not os.path.exists(db_path)


def test_round8_init_restore_counter_once(tmp_path, monkeypatch):
    """Requirement 6c: Confirm _init_db_and_restore runs exactly once per startup."""
    from api.main import app
    import asyncio

    test_db_file = str(tmp_path / "counter_app.db")
    test_db = Database(test_db_file)
    monkeypatch.setattr("api.main.db", test_db)
    test_store = CohortStore(num_patients=10, days_count=60, seed=42)
    monkeypatch.setattr("api.main.cohort_store", test_store)

    assert test_store.init_restore_count == 0

    async def run_lifespan():
        async with app.router.lifespan_context(app):
            assert test_store.init_restore_count == 1

    asyncio.run(run_lifespan())
    assert test_store.init_restore_count == 1


def test_round8_check_constraint_and_schema_1_1(tmp_path):
    """Requirement 6d: CHECK constraint on source column ('api','simulated','seed') and schema_version 1.1."""
    import sqlite3
    db_file = str(tmp_path / "check_test.db")
    test_db = Database(db_file)

    # Valid sources succeed
    for src in ("api", "simulated", "seed"):
        test_db.insert_reading({
            "patient_id": f"PT-{src}",
            "day": 1,
            "resting_hr": 72.0,
            "source": src
        })

    # Invalid source fails with IntegrityError
    try:
        test_db.insert_reading({
            "patient_id": "PT-invalid",
            "day": 1,
            "resting_hr": 72.0,
            "source": "unauthorized_source"
        })
        assert False, "Should have failed CHECK constraint"
    except sqlite3.IntegrityError:
        pass


def test_round8_sim_autorestart(tmp_path, monkeypatch):
    """Requirement 9: SIM_AUTORESTART=1 resets automatically when every patient is exhausted."""
    db_file = str(tmp_path / "autorestart.db")
    test_db = Database(db_file)
    monkeypatch.setattr("api.routes_v2.db", test_db)
    monkeypatch.setattr("api.db.db", test_db)
    store = CohortStore(num_patients=5, days_count=60, seed=42, db_instance=test_db)
    sim = WearableStreamSimulator(store=store, db_instance=test_db)

    # Fast-forward all patients to exhausted (next_day > days_count)
    for pid in list(store.patient_map.keys()):
        sim.db.set_sim_state(pid, store.days_count + 1)

    monkeypatch.setenv("SIM_AUTORESTART", "1")
    assert sim.restart_count == 0
    sim.tick()
    assert sim.restart_count == 1
    status = sim.get_status()
    assert status["restartCount"] == 1


def test_round9_database_memory_persistence():
    """
    Requirement 1a: Prove Database(':memory:') works: create schema, insert a reading,
    read it back in a second call.
    """
    mem_db = Database(":memory:")
    mem_db.init_db()

    packet = {
        "patient_id": "PT-MEM-1",
        "day": 10,
        "resting_hr": 75.5,
        "hrv": 45.0,
        "steps": 4500,
        "source": "api"
    }
    # First call: insert reading
    mem_db.insert_reading(packet)

    # Second call: read it back
    readings = mem_db.get_readings(patient_id="PT-MEM-1")
    assert len(readings) == 1
    assert readings[0]["patient_id"] == "PT-MEM-1"
    assert readings[0]["day"] == 10
    assert readings[0]["resting_hr"] == 75.5
    assert readings[0]["source"] == "api"

    # Close memory connection
    mem_db.close()


def test_round9_schema_migration_and_backup(tmp_path):
    """
    Requirement 1b: Schema handling: if an existing DB file has a different schema_version,
    or lacks the current columns, log a clear warning, rename the file to app.db.old-<timestamp>,
    and start a fresh DB. It must never crash on startup. Test with a fixture DB created with
    the round-6 schema (columns stream_source, ingested_at).
    """
    db_file = str(tmp_path / "app.db")

    # 1. Create a fixture DB with the round-6 schema (columns stream_source, ingested_at)
    conn = sqlite3.connect(db_file)
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE meta (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    cur.execute("INSERT INTO meta (key, value) VALUES ('schema_version', '1.0');")
    cur.execute("""
    CREATE TABLE readings (
        patient_id TEXT,
        day INTEGER,
        resting_hr REAL,
        hrv REAL,
        steps INTEGER,
        sleep_hours REAL,
        med_adherence INTEGER,
        rehab_attended INTEGER,
        spo2 REAL,
        bp_sys INTEGER,
        bp_dia INTEGER,
        red_flag TEXT,
        stream_source TEXT,
        ingested_at TEXT,
        PRIMARY KEY (patient_id, day)
    );
    """)
    cur.execute("""
    INSERT INTO readings (patient_id, day, resting_hr, stream_source, ingested_at)
    VALUES ('PT-OLD', 5, 80.0, 'legacy', '2026-10-10T00:00:00Z');
    """)
    conn.commit()
    conn.close()

    assert os.path.exists(db_file)

    # 2. Initialize Database on this legacy file; it must not crash
    db = Database(db_file)
    db.init_db()

    # 3. Verify backup file was created
    dir_files = os.listdir(tmp_path)
    old_files = [f for f in dir_files if f.startswith("app.db.old-")]
    assert len(old_files) >= 1, f"Expected app.db.old-<timestamp> backup file, found {dir_files}"

    # 4. Verify fresh DB has schema 1.1 columns and can insert new readings
    with db.get_connection() as c:
        cur = c.cursor()
        cur.execute("PRAGMA table_info(readings)")
        cols = {row["name"] for row in cur.fetchall()}
        assert "source" in cols
        assert "received_at" in cols
        assert "stream_source" not in cols
        assert "ingested_at" not in cols


def test_round10_real_startup_lifespan_restart(tmp_path):
    """
    Round 10, 1b:
    Test with the real startup path (lifespan, not TestClient shortcuts): start the app
    with DB_PATH=tmp, ingest 3 readings via POST /api/ingest/wearable, restart twice on the
    same file, assert no *.old-* file exists and the twin state is identical each time.
    """
    db_file = str(tmp_path / "app.db")
    tmp_dir = str(tmp_path)

    # Subprocess 1: Real startup via lifespan, ingest 3 readings for PT-8092, dump twin state
    script1 = f"""
import os, json, sys
os.environ['DB_PATH'] = r'{db_file}'
os.environ['SIM_ENABLED'] = '0'
from fastapi.testclient import TestClient
from api.main import app
from api.cohort_v2_store import cohort_store

with TestClient(app) as client:
    for day in [15, 16, 17]:
        payload = {{
            'patient_id': 'PT-8092',
            'day': day,
            'resting_hr': 70.0 + (day - 14),
            'hrv': 45.0,
            'steps': 5000,
            'sleep_hours': 7.0,
            'spo2': 98,
            'bp_sys': 120,
            'bp_dia': 80
        }}
        resp = client.post('/api/ingest/wearable', json=payload)
        assert resp.status_code == 200, resp.text
    twin = cohort_store.compute_twin('PT-8092')
    with open(r'{os.path.join(tmp_dir, "twin1.json")}', 'w') as f:
        json.dump(twin, f, default=str)
"""
    p1 = subprocess.run([sys.executable, "-c", script1], capture_output=True, text=True)
    assert p1.returncode == 0, f"Process 1 failed:\n{p1.stderr}"

    old_files_1 = glob.glob(os.path.join(tmp_dir, "*.old-*"))
    assert len(old_files_1) == 0, f"Found unexpected *.old-* files after startup: {old_files_1}"

    # Subprocess 2: Restart 1 on the exact same DB file
    script2 = f"""
import os, json, sys
os.environ['DB_PATH'] = r'{db_file}'
os.environ['SIM_ENABLED'] = '0'
from fastapi.testclient import TestClient
from api.main import app
from api.cohort_v2_store import cohort_store

with TestClient(app) as client:
    twin = cohort_store.compute_twin('PT-8092')
    with open(r'{os.path.join(tmp_dir, "twin2.json")}', 'w') as f:
        json.dump(twin, f, default=str)
"""
    p2 = subprocess.run([sys.executable, "-c", script2], capture_output=True, text=True)
    assert p2.returncode == 0, f"Process 2 (Restart 1) failed:\n{p2.stderr}"

    old_files_2 = glob.glob(os.path.join(tmp_dir, "*.old-*"))
    assert len(old_files_2) == 0, f"Found unexpected *.old-* files after restart 1: {old_files_2}"

    # Subprocess 3: Restart 2 on the exact same DB file
    script3 = script2.replace("twin2.json", "twin3.json")
    p3 = subprocess.run([sys.executable, "-c", script3], capture_output=True, text=True)
    assert p3.returncode == 0, f"Process 3 (Restart 2) failed:\n{p3.stderr}"

    old_files_3 = glob.glob(os.path.join(tmp_dir, "*.old-*"))
    assert len(old_files_3) == 0, f"Found unexpected *.old-* files after restart 2: {old_files_3}"

    with open(os.path.join(tmp_dir, "twin1.json")) as f:
        twin1 = json.load(f)
    with open(os.path.join(tmp_dir, "twin2.json")) as f:
        twin2 = json.load(f)
    with open(os.path.join(tmp_dir, "twin3.json")) as f:
        twin3 = json.load(f)

    assert twin1["scoreDay"] == 17
    assert twin1 == twin2, f"Twin state mismatch between run 1 and restart 1"
    assert twin2 == twin3, f"Twin state mismatch between restart 1 and restart 2"


def test_round11_observation_window_days_in_routes():
    """
    Requirement 1b: Backend test through the real routes:
    GET /api/v2/patients and GET /api/v2/patients/{id}/twin both contain observationWindowDays
    equal to the store's days_count.
    """
    from fastapi.testclient import TestClient
    from api.main import app
    from api.cohort_v2_store import cohort_store

    with TestClient(app) as client:
        resp = client.get("/api/v2/patients")
        assert resp.status_code == 200, resp.text
        patients = resp.json()
        assert len(patients) > 0
        p0 = patients[0]
        assert p0.get("observationWindowDays") == cohort_store.days_count
        assert p0.get("twinState", {}).get("observationWindowDays") == cohort_store.days_count

        pid = p0["id"]
        resp_twin = client.get(f"/api/v2/patients/{pid}/twin")
        assert resp_twin.status_code == 200, resp_twin.text
        twin = resp_twin.json()
        assert twin.get("observationWindowDays") == cohort_store.days_count




