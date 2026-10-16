import os
import sys
import time
import json
import urllib.request
import urllib.error
import subprocess

PORT = 8025
BASE_URL = f"http://127.0.0.1:{PORT}"

def http_get(path):
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def http_post(path, body=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"} if body is not None else {}
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read().decode("utf-8"))

def wait_for_server(proc):
    for _ in range(60):
        if proc.poll() is not None:
            raise RuntimeError(f"Server exited with code {proc.returncode}")
        try:
            req = urllib.request.Request(f"{BASE_URL}/health")
            with urllib.request.urlopen(req, timeout=2) as resp:
                if resp.getcode() == 200:
                    return True
        except Exception:
            pass
        time.sleep(0.3)
    return False

def record_patient_state(pid):
    p = http_get(f"/api/v2/patients/{pid}/twin")
    return {
        "pid": pid,
        "scoreDay": p.get("scoreDay"),
        "p50": round(p.get("p50", 0.0), 4) if p.get("p50") is not None else None,
        "zone": p.get("triageZone")
    }

def run_test():
    tmp_db = os.path.abspath(os.path.join("data", "tmp_round8_restart.db"))
    for ext in ("", "-wal", "-shm"):
        f = tmp_db + ext
        if os.path.exists(f):
            os.remove(f)

    target_pids = ["PT-8092", "PT-8000", "PT-8036", "PT-8045"]

    print("=================== 1. STARTING SERVER (RUN 1) ===================")
    env1 = os.environ.copy()
    env1["SIM_ENABLED"] = "1"
    env1["DB_PATH"] = tmp_db
    env1["SIM_TICK_SECONDS"] = "5"

    proc1 = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app", "--port", str(PORT), "--log-level", "warning"],
        env=env1,
        cwd=os.getcwd()
    )

    try:
        assert wait_for_server(proc1), "Server 1 failed to start"
        print("Server 1 is online. Setting speed to 5...", flush=True)
        http_post("/api/sim/speed", {"tickSeconds": 5.0})

        print("Waiting for at least 6 ticks to run (tracking lastTickAt changes)...", flush=True)
        ticks = 0
        last_seen_tick = None
        start_t = time.time()
        while time.time() - start_t < 60:
            st = http_get("/api/sim/status")
            curr_tick = st.get("lastTickAt")
            if curr_tick and curr_tick != last_seen_tick:
                ticks += 1
                last_seen_tick = curr_tick
                print(f"  Tick {ticks} completed at {curr_tick}", flush=True)
                if ticks >= 6:
                    print(f"Reached {ticks} ticks successfully!", flush=True)
                    break
            time.sleep(1)

        # Pause sim to freeze state for recording
        http_post("/api/sim/pause")

        print("\n--- RECORDING VALUES BEFORE RESTART ---")
        before_states = {}
        for pid in target_pids:
            before_states[pid] = record_patient_state(pid)
            print(f"  {pid}: Day {before_states[pid]['scoreDay']} | p50={before_states[pid]['p50']} | zone={before_states[pid]['zone']}")

        before_summary = http_get("/api/v2/alerts/summary")
        print(f"Alert summary: {before_summary}")

    finally:
        print("\nStopping Server 1...")
        proc1.terminate()
        proc1.wait(timeout=10)
        print("Server 1 stopped.")

    time.sleep(2)

    print("\n=================== 2. RESTARTING SERVER (RUN 2 - NO RESET) ===================")
    env2 = os.environ.copy()
    env2["SIM_ENABLED"] = "1"
    env2["DB_PATH"] = tmp_db
    env2["SIM_TICK_SECONDS"] = "60"  # Keep slow or pause

    proc2 = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api.main:app", "--port", str(PORT), "--log-level", "warning"],
        env=env2,
        cwd=os.getcwd()
    )

    try:
        assert wait_for_server(proc2), "Server 2 failed to start"
        print("Server 2 is online.")
        # Pause simulator immediately to prevent advancing
        http_post("/api/sim/pause")

        print("\n--- RECORDING VALUES AFTER RESTART ---")
        after_states = {}
        for pid in target_pids:
            after_states[pid] = record_patient_state(pid)
            print(f"  {pid}: Day {after_states[pid]['scoreDay']} | p50={after_states[pid]['p50']} | zone={after_states[pid]['zone']}")

        after_summary = http_get("/api/v2/alerts/summary")
        print(f"Alert summary: {after_summary}")

        print("\n--- VERIFYING MATCHES ---")
        all_matched = True
        for pid in target_pids:
            b = before_states[pid]
            a = after_states[pid]
            match = (b["scoreDay"] == a["scoreDay"] and b["p50"] == a["p50"] and b["zone"] == a["zone"])
            print(f"  {pid} match: {match} (day {b['scoreDay']}=={a['scoreDay']}, p50 {b['p50']}=={a['p50']}, zone {b['zone']}=={a['zone']})")
            if not match:
                all_matched = False

        summary_match = (before_summary["total"] == after_summary["total"] and
                         before_summary["unread"] == after_summary["unread"] and
                         before_summary["byZone"] == after_summary["byZone"])
        print(f"  Alert summary match: {summary_match}")
        if not summary_match:
            all_matched = False

        assert all_matched, "Restart validation failed - values before and after restart do not match!"
        print("\n>>> LIVE RESTART TEST PASSED: ALL VALUES MATCH PERFECTLY <<<")

    finally:
        print("\nStopping Server 2...")
        proc2.terminate()
        proc2.wait(timeout=10)
        print("Server 2 stopped.")

        # Cleanup tmp files
        for ext in ("", "-wal", "-shm"):
            f = tmp_db + ext
            if os.path.exists(f):
                try:
                    os.remove(f)
                except Exception:
                    pass

if __name__ == "__main__":
    run_test()
