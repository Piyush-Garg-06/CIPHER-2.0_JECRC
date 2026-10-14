import os
import sys
import time
import logging
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
import numpy as np
from pydantic import BaseModel, Field, ConfigDict
from fastapi import APIRouter, HTTPException, Depends, Request

from data_gen.cohort_v2 import generate_synthetic_cohort
from api.models import WearablePacketInput
from api.cohort_v2_store import cohort_store, CohortStore
from api.db import db, Database

ALLOWED_COHORT_KEYS = {
    "id", "age", "gender", "index_event", "revascularization", "lvef",
    "hypertension", "diabetes", "hba1c", "egfr", "ldl", "family_history_cad",
    "smoker", "bmi", "daily_readings"
}

def generate_pt8092_synthetic_continuation(day: int, seed: int = 42) -> Dict[str, Any]:
    """
    Continues observed physiological trend for PT-8092 with deterministic seeded noise.
    NOTE: All values produced by this continuation function are purely synthetic.
    """
    # Deterministic seeded noise for synthetic patient telemetry continuation
    rng = np.random.default_rng(seed + day * 101)
    hr_noise = float(rng.normal(0, 0.4))
    hrv_noise = float(rng.normal(0, 0.4))
    step_noise = int(rng.integers(-40, 41))

    resting_hr = round(min(max(74.0 + (day * 0.5) + hr_noise, 40.0), 160.0), 1)
    hrv = round(max(58.0 - (day * 0.8) + hrv_noise, 30.0), 1)
    steps = max(int(7500 - (day * 150) + step_noise), 2000)

    return {
        "day": day,
        "resting_hr": resting_hr,
        "hrv": hrv,
        "steps": steps,
        "sleep_hours": 6.5,
        "med_adherence": True,
        "rehab_attended": (day % 3 == 0),
        "spo2": 97,
        "bp_sys": 128,
        "bp_dia": 82,
        "red_flag": None
    }

class SimSpeedInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    tickSeconds: float = Field(..., ge=5.0, le=120.0)

class WearableStreamSimulator:
    def __init__(self, store: Optional[CohortStore] = None, db_instance: Optional[Database] = None):
        self.store = store if store is not None else cohort_store
        self.db = db_instance if db_instance is not None else db
        self.tick_seconds = float(os.environ.get("SIM_TICK_SECONDS", 20))
        self.advance_fraction = float(os.environ.get("SIM_ADVANCE_FRACTION", 0.34))
        self.running = True
        self.paused = False
        self.last_tick_at: Optional[str] = None
        self.tick_count = 0
        self.restart_count = 0
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._lock = threading.RLock()

        self._build_future_packets()

    def _build_future_packets(self) -> None:
        raw_cohort = generate_synthetic_cohort(
            num_patients=self.store.num_patients,
            days_count=self.store.days_count,
            seed=self.store.seed
        )

        for p in raw_cohort:
            for k in list(p.keys()):
                if k not in ALLOWED_COHORT_KEYS:
                    p.pop(k, None)

        self.future_packets: Dict[str, Dict[int, Dict[str, Any]]] = {}
        raw_map = {p["id"]: p for p in raw_cohort}

        for pid, patient in self.store.patient_map.items():
            self.future_packets[pid] = {}
            if pid == "PT-8092":
                for d in range(15, self.store.days_count + 1):
                    self.future_packets[pid][d] = generate_pt8092_synthetic_continuation(d, self.store.seed)
            else:
                raw_p = raw_map.get(pid)
                if raw_p:
                    for r in raw_p.get("daily_readings", []):
                        d = r.get("day")
                        if d is not None and d <= self.store.days_count:
                            self.future_packets[pid][int(d)] = r

    def _init_sim_state(self) -> None:
        if not self.db:
            return
        existing_state = self.db.get_sim_state()
        for pid, patient in self.store.patient_map.items():
            if pid not in existing_state:
                readings = patient.get("daily_readings", [])
                last_stored_day = readings[-1]["day"] if readings else 0
                next_day = last_stored_day + 1
                self.db.set_sim_state(pid, next_day)

    def tick(self) -> List[Dict[str, Any]]:
        with self._lock:
            if not self.db:
                return []
            sim_state = self.db.get_sim_state()
            if not sim_state:
                self._init_sim_state()
                sim_state = self.db.get_sim_state()
            active_pids = [
                pid for pid in sorted(self.store.patient_map.keys())
                if sim_state.get(pid, 1) <= self.store.days_count
            ]
            if not active_pids:
                self.last_tick_at = datetime.now(timezone.utc).isoformat()
                if os.environ.get("SIM_AUTORESTART") == "1":
                    self.reset()
                    self.restart_count += 1
                return []

            k = int(round(len(active_pids) * self.advance_fraction))
            if k == 0 and len(active_pids) > 0 and self.advance_fraction > 0:
                k = 1
            k = min(k, len(active_pids))

            rng = np.random.default_rng(self.store.seed + self.tick_count * 1000)
            chosen_pids = sorted(rng.choice(active_pids, size=k, replace=False))

            results = []
            for pid in chosen_pids:
                day_to_ingest = sim_state.get(pid, 1)
                reading_raw = self.future_packets.get(pid, {}).get(day_to_ingest)
                if not reading_raw:
                    reading_raw = {
                        "day": day_to_ingest,
                        "resting_hr": None,
                        "hrv": None,
                        "steps": None,
                        "sleep_hours": None,
                        "med_adherence": False,
                        "rehab_attended": False,
                        "spo2": None,
                        "bp_sys": None,
                        "bp_dia": None,
                        "red_flag": None
                    }

                # Validate against WearablePacketInput
                packet = WearablePacketInput(
                    patient_id=pid,
                    day=day_to_ingest,
                    resting_hr=reading_raw.get("resting_hr"),
                    hrv=reading_raw.get("hrv"),
                    steps=int(reading_raw["steps"]) if reading_raw.get("steps") is not None else None,
                    sleep_hours=reading_raw.get("sleep_hours"),
                    med_adherence=bool(reading_raw.get("med_adherence", True)),
                    rehab_attended=bool(reading_raw.get("rehab_attended", False)),
                    spo2=int(reading_raw["spo2"]) if reading_raw.get("spo2") is not None else None,
                    bp_sys=int(reading_raw["bp_sys"]) if reading_raw.get("bp_sys") is not None else None,
                    bp_dia=int(reading_raw["bp_dia"]) if reading_raw.get("bp_dia") is not None else None,
                    red_flag=reading_raw.get("red_flag")
                )

                # Ingest through CohortStore with source="simulated"
                res = self.store.ingest_reading(
                    patient_id=pid,
                    packet_data=packet.model_dump(),
                    source="simulated"
                )

                next_day = day_to_ingest + 1
                self.db.set_sim_state(pid, next_day)
                sim_state[pid] = next_day
                results.append(res)

            self.tick_count += 1
            self.last_tick_at = datetime.now(timezone.utc).isoformat()
            return results

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            sim_state = self.db.get_sim_state() if self.db else {}
            all_pids = list(self.store.patient_map.keys())
            active = sum(1 for pid in all_pids if sim_state.get(pid, 1) <= self.store.days_count)
            exhausted = sum(1 for pid in all_pids if sim_state.get(pid, 1) > self.store.days_count)
            return {
                "running": bool(self.running and not self.paused),
                "tickSeconds": float(self.tick_seconds),
                "advanceFraction": float(self.advance_fraction),
                "patientsActive": int(active),
                "patientsExhausted": int(exhausted),
                "lastTickAt": self.last_tick_at,
                "restartCount": int(self.restart_count)
            }

    def reset(self) -> Dict[str, Any]:
        with self._lock:
            if self.db:
                self.db.reset_sim_data()
            self.store.reset_to_seed()
            self.tick_count = 0
            self.last_tick_at = None
            self._build_future_packets()
            self._init_sim_state()
            return self.get_status()

    def start_scheduler(self) -> None:
        if os.environ.get("SIM_ENABLED") != "1":
            return
        self._init_sim_state()
        if self._thread is not None and self._thread.is_alive():
            return
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run_loop, daemon=True, name="WearableSimulatorThread")
        self._thread.start()

    def stop_scheduler(self) -> None:
        self._stop_event.set()
        if self._thread is not None and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        self._thread = None

    def _run_loop(self) -> None:
        while not self._stop_event.is_set():
            # Sleep in small slices to respond to stop/pause promptly
            sleep_step = 0.5
            elapsed = 0.0
            while elapsed < self.tick_seconds and not self._stop_event.is_set():
                time.sleep(sleep_step)
                elapsed += sleep_step

            if not self._stop_event.is_set() and not self.paused and self.running:
                try:
                    self.tick()
                except Exception as e:
                    logging.error("Error during simulator tick: %s", e)

# Default singleton simulator
simulator = WearableStreamSimulator()

def verify_sim_access(request: Request) -> None:
    """Enforces SIM_ENABLED=1 and localhost client restriction."""
    if os.environ.get("SIM_ENABLED") != "1":
        raise HTTPException(status_code=404, detail="Simulator is not enabled")
    host = request.client.host if request.client else ""
    if host not in ("127.0.0.1", "::1", "localhost", "testclient"):
        raise HTTPException(status_code=403, detail="Localhost clients only")

router = APIRouter(prefix="/api/sim", tags=["Wearable Telemetry Simulator"], dependencies=[Depends(verify_sim_access)])

@router.get("/status")
async def get_simulation_status():
    return simulator.get_status()

@router.post("/pause")
async def pause_simulation():
    simulator.paused = True
    return simulator.get_status()

@router.post("/resume")
async def resume_simulation():
    simulator.paused = False
    return simulator.get_status()

@router.post("/reset")
async def reset_simulation():
    return simulator.reset()

@router.post("/speed")
async def set_simulation_speed(speed: SimSpeedInput):
    simulator.tick_seconds = speed.tickSeconds
    return simulator.get_status()
