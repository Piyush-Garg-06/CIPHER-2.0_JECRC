"""
Cohort Store and Digital Twin Orchestrator for API Serving

Features:
- Seeded generation of synthetic cohort with simulation harness (as_of_day in [10, days_count]).
- Hidden label protection: outcome event_day is extracted into private self._hidden_event_day
  and completely excluded from patient dicts and twin/ code.
- Precomputed cache computed at startup and refreshed per-patient.
- Evaluation parity for missing latest days: carry forward last valid score, do not rescore.
- Strict uncalibrated handling: return None for all risk probabilities.
- All 25 required Digital Twin state fields populated consistently.
"""

import os
import sys
import threading
from typing import Dict, Any, List, Optional
import numpy as np
from datetime import datetime, timezone
import logging

# Add root directory to python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from data_gen.cohort_v2 import generate_synthetic_cohort
from twin.baseline import compute_personal_baseline
from twin.estimator_v2 import CausalKalmanFilter
from twin.features import standardize_and_clip
from twin.forecast import RiskForecaster
from twin.zones import TriageZoneStateMachine

import hashlib

STATIC_EHR_FEATURES = {
    "age", "lvef", "diabetes", "hba1c", "egfr", "family_history_cad", "smoker"
}

MALE_FIRST_NAMES = [
    "Amit", "Arjun", "Vikram", "Karan", "Sanjay", "Deepak", "Rohan", "Aarav",
    "Rahul", "Rajesh", "Nikhil", "Aditya", "Manish", "Alok", "Suresh", "Vijay"
]

FEMALE_FIRST_NAMES = [
    "Anita", "Meera", "Pooja", "Sunita", "Neha", "Priya", "Ananya", "Kavita",
    "Ritu", "Shreya", "Sneha", "Divya", "Swati", "Preeti", "Aarti", "Sunidhi"
]

LAST_NAMES = [
    "Gupta", "Verma", "Patel", "Singh", "Kapoor", "Rao", "Reddy", "Mehta",
    "Joshi", "Nair", "Desai", "Sharma", "Malhotra", "Chopra", "Bhatia", "Saxena"
]

def derive_patient_name(patient_id: str, gender: str) -> str:
    h = int(hashlib.md5(patient_id.encode("utf-8")).hexdigest(), 16)
    if str(gender).lower() == "female":
        first = FEMALE_FIRST_NAMES[h % len(FEMALE_FIRST_NAMES)]
    else:
        first = MALE_FIRST_NAMES[h % len(MALE_FIRST_NAMES)]
    last = LAST_NAMES[(h >> 8) % len(LAST_NAMES)]
    return f"{first} {last}"



from api.db import db

class CohortStore:
    """
    In-memory cohort cache and 4-Stage Prediction Engine Orchestrator
    """

    def __init__(self, num_patients: int = 200, days_count: int = 60, seed: int = 42, db_instance: Optional[Any] = None):
        self.num_patients = num_patients
        self.days_count = days_count
        self.seed = seed
        self.schema_version = "1.0"
        self.db = db_instance if db_instance is not None else db

        self.kalman_filter = CausalKalmanFilter()
        self.forecaster = RiskForecaster()
        self.zone_machine = TriageZoneStateMachine()
        self._lock = threading.Lock()

        # Step 3a: Private hidden outcome labels storage
        self._hidden_event_day: Dict[str, Optional[int]] = {}
        self._patient_ingest_meta: Dict[str, Dict[str, Any]] = {}
        self.patient_map: Dict[str, Dict[str, Any]] = {}
        self._twin_cache: Dict[str, Dict[str, Any]] = {}
        self._summary_cache: Dict[str, Dict[str, Any]] = {}
        self._raw_feature_cache: Dict[str, Dict[str, Any]] = {}

        self._build_seed_cohort()

        # Step 3d: Precomputed caches - compute cache for all patients at startup
        for pid in list(self.patient_map.keys()):
            self._compute_and_cache_patient(pid)

        # Restore from DB or initialize DB only when explicit db_instance passed
        if self.db is not None and db_instance is not None:
            self._init_db_and_restore()

    def _build_seed_cohort(self) -> None:
        """Constructs the seed cohort in-memory."""
        # Generate synthetic cohort
        raw_cohort = generate_synthetic_cohort(num_patients=self.num_patients, days_count=self.days_count, seed=self.seed)

        # Step 3b: Simulation harness - simulates active ward observation at as_of_day
        rng_as_of = np.random.default_rng(self.seed + 1000)
        self.patient_map = {}
        self._patient_ingest_meta = {}

        for p in raw_cohort:
            pid = p["id"]
            # Extract and hide outcome label
            ev_day = p.pop("event_day", None)
            self._hidden_event_day[pid] = ev_day

            # Draw observation day uniformly in [10, days_count]
            as_of_day = int(rng_as_of.integers(10, self.days_count + 1))

            # Patients who had an event on or before as_of_day have left the ward
            if ev_day is not None and ev_day <= as_of_day:
                continue

            # Keep telemetry readings strictly up to as_of_day
            p["daily_readings"] = [
                r for r in p.get("daily_readings", [])
                if r.get("day", 0) <= as_of_day
            ]
            p["name"] = derive_patient_name(pid, p.get("gender", "Male"))
            self.patient_map[pid] = p
            self._patient_ingest_meta[pid] = {"lastIngestAt": None, "streamSource": "seed"}

        # Step 3i: Demo patient PT-8092 with complete schema
        self.patient_map.pop("PT-8092", None)
        self._hidden_event_day["PT-8092"] = None

        demo_readings = [
            {
                "day": d,
                "resting_hr": 74.0 + int(d * 0.5),
                "hrv": max(58.0 - int(d * 0.8), 38.0),
                "steps": max(7500 - d * 150, 3200),
                "sleep_hours": 6.5,
                "med_adherence": True,
                "rehab_attended": (d % 3 == 0),
                "spo2": 97,
                "bp_sys": 128,
                "bp_dia": 82,
                "red_flag": None
            }
            for d in range(1, 15)
        ]

        self.patient_map["PT-8092"] = {
            "id": "PT-8092",
            "name": "Rahul Sharma",
            "age": 52,
            "gender": "Male",
            "index_event": "STEMI (Anterior)",
            "revascularization": "PCI with DES",
            "lvef": 48.0,
            "hypertension": True,
            "diabetes": False,
            "hba1c": 5.8,
            "egfr": 88.0,
            "ldl": 112.0,
            "family_history_cad": True,
            "smoker": False,
            "bmi": 26.4,
            "daily_readings": demo_readings
        }
        self._patient_ingest_meta["PT-8092"] = {"lastIngestAt": None, "streamSource": "seed"}

    def _seed_initial_alerts(self) -> None:
        """C4: On first startup, create one alert per patient in watch/yellow/red."""
        if not self.db:
            return
        existing = self.db.get_alerts()
        if existing:
            return
        now_iso = datetime.now(timezone.utc).isoformat()
        for pid in sorted(self.patient_map.keys()):
            twin = self._twin_cache.get(pid, {})
            zone = twin.get("triageZone", "green")
            is_watch = twin.get("watch", False)
            effective_zone = "watch" if (is_watch and zone not in ("yellow", "red")) else zone
            if effective_zone in ("watch", "yellow", "red"):
                self.db.insert_alert(
                    patient_id=pid,
                    kind="initial",
                    zone=effective_zone,
                    red_source=twin.get("redSource"),
                    p50=twin.get("p50"),
                    score_day=twin.get("scoreDay"),
                    rationale=twin.get("zoneRationale", f"Initial triage state {effective_zone.upper()}"),
                    created_at=now_iso,
                    read=0
                )

    def _init_db_and_restore(self) -> None:
        """B4: Check metadata and replay persisted non-seed readings in (patient_id, day) order."""
        if not self.db:
            return
        with self._lock:
            stored_meta = self.db.get_all_meta()
            if not stored_meta:
                # First startup: record meta and seed alerts
                self.db.set_meta("seed", str(self.seed))
                self.db.set_meta("num_patients", str(self.num_patients))
                self.db.set_meta("days_count", str(self.days_count))
                self.db.set_meta("schema_version", self.schema_version)
                self._seed_initial_alerts()
                return

            # Check meta matches
            mismatches = []
            if stored_meta.get("seed") != str(self.seed):
                mismatches.append(f"seed (db={stored_meta.get('seed')} vs store={self.seed})")
            if stored_meta.get("num_patients") != str(self.num_patients):
                mismatches.append(f"num_patients (db={stored_meta.get('num_patients')} vs store={self.num_patients})")
            if stored_meta.get("days_count") != str(self.days_count):
                mismatches.append(f"days_count (db={stored_meta.get('days_count')} vs store={self.days_count})")

            if mismatches:
                logging.warning(
                    "Database metadata mismatch: %s. Refusing persisted data and serving seed cohort.",
                    ", ".join(mismatches)
                )
                return

            # Re-apply persisted readings in (patient_id, day) order
            persisted_readings = self.db.get_readings()
            persisted_readings.sort(key=lambda r: (r["patient_id"], r["day"]))
            for r in persisted_readings:
                pid = r["patient_id"]
                if pid in self.patient_map:
                    self._ingest_reading_locked(
                        patient_id=pid,
                        packet_data=r,
                        source=r.get("source", "api"),
                        received_at=r.get("received_at"),
                        persist=False,
                        generate_alert=False
                    )

            if not self.db.get_alerts():
                self._seed_initial_alerts()

    def reset_to_seed(self) -> None:
        """Resets the in-memory store and recomputes all caches to the clean seed cohort."""
        with self._lock:
            self._build_seed_cohort()
            self._twin_cache = {}
            self._summary_cache = {}
            self._raw_feature_cache = {}
            for pid in list(self.patient_map.keys()):
                self._compute_and_cache_patient(pid)
            self._seed_initial_alerts()

    def _make_uncalibrated_twin(self, rationale: str) -> Dict[str, Any]:
        """Returns standard uncalibrated digital twin response dict."""
        return {
            "isCalibrated": False,
            "lockDay": None,
            "hr0": None,
            "hrv0": None,
            "steps0": None,
            "normalBand": None,
            "kalman_d_t": None,
            "kalman_sd_t": None,
            "driftRate": None,
            "p10": None,
            "p50": None,
            "p90": None,
            "forwardCone": None,
            "triageZone": "not_calibrated",
            "watch": False,
            "redSource": None,
            "zoneRationale": rationale,
            "activeEpisode": None,
            "scoreDay": None,
            "dataAgeDays": None,
            "staleData": False,
            "bandsValidated": False,
            "bandBasis": None,
            "modelVersion": self.forecaster.version,
            "trainedOn": self.forecaster.trained_on,
            "drivers": None,
            "driversNote": None,
            "scoreHistory": None,
            "recentReadings": None,
            "lastIngestAt": None,
            "streamSource": "seed"
        }

    def _make_patient_summary(self, p: Dict[str, Any], twin_data: Dict[str, Any]) -> Dict[str, Any]:
        """Constructs patient summary response for list view."""
        p50 = twin_data.get("p50")
        if p50 is not None:
            risk_pct = int(round(p50 * 100))
            risk_score = round(p50, 4)
        else:
            risk_pct = None
            risk_score = None

        zone = twin_data.get("triageZone", "not_calibrated")
        if zone == "red":
            risk_level = "critical"
        elif zone == "yellow":
            risk_level = "elevated"
        elif zone == "green":
            risk_level = "stable"
        else:
            risk_level = "not_calibrated"

        valid_readings = [r for r in p.get("daily_readings", []) if r.get("resting_hr") is not None]
        latest_r = valid_readings[-1] if valid_readings else None

        if latest_r is not None:
            resting_hr = latest_r.get("resting_hr")
            heart_rate = resting_hr  # heartRate = restingHR, No +6!
            hrv = latest_r.get("hrv")
            steps = latest_r.get("steps")
            sleep_hrs = latest_r.get("sleep_hours")
            sleep_str = f"{sleep_hrs}h" if sleep_hrs is not None else None
            spo2 = latest_r.get("spo2")
            bp_sys = latest_r.get("bp_sys")
            bp_dia = latest_r.get("bp_dia")
            bp_str = f"{bp_sys}/{bp_dia}" if (bp_sys is not None and bp_dia is not None) else None
        else:
            resting_hr = None
            heart_rate = None
            hrv = None
            steps = None
            sleep_str = None
            spo2 = None
            bp_str = None

        vitals = {
            "heartRate": int(heart_rate) if heart_rate is not None else None,
            "restingHR": int(resting_hr) if resting_hr is not None else None,
            "hrv": int(hrv) if hrv is not None else None,
            "bloodPressure": bp_str,
            "spo2": int(spo2) if spo2 is not None else None,
            "dailySteps": int(steps) if steps is not None else None,
            "sleepHours": sleep_str
        }

        return {
            "id": p["id"],
            "name": derive_patient_name(p["id"], p.get("gender", "Male")),
            "age": p.get("age", 0),
            "gender": p.get("gender", "Unknown"),
            "riskLevel": risk_level,
            "riskScore": risk_score,
            "riskPercentage": risk_pct,
            "watch": twin_data.get("watch", False),
            "redSource": twin_data.get("redSource"),
            "scoreDay": twin_data.get("scoreDay"),
            "dataAgeDays": twin_data.get("dataAgeDays"),
            "staleData": twin_data.get("staleData", False),
            "monitoringStatus": "no_recent_data" if twin_data.get("staleData", False) else "ok",
            "vitals": vitals,
            "twinState": twin_data
        }

    def _compute_and_cache_patient(self, patient_id: str) -> None:
        """Computes and caches digital twin state and list summary for a patient."""
        p = self.patient_map.get(patient_id)
        if not p:
            twin_data = self._make_uncalibrated_twin("Unknown patient ID.")
            self._twin_cache[patient_id] = twin_data
            self._summary_cache[patient_id] = self._make_patient_summary({"id": patient_id}, twin_data)
            return

        readings = p.get("daily_readings", [])
        if not readings:
            twin_data = self._make_uncalibrated_twin("No daily readings recorded.")
            self._twin_cache[patient_id] = twin_data
            self._summary_cache[patient_id] = self._make_patient_summary(p, twin_data)
            return

        current_day = readings[-1]["day"]

        # Stage 1: Personal Baseline Lock
        baseline = compute_personal_baseline(readings)
        if not baseline:
            twin_data = self._make_uncalibrated_twin(
                "Patient has fewer than 3 valid baseline resting HR readings. Predictions withheld to prevent false alarms."
            )
            self._twin_cache[patient_id] = twin_data
            self._summary_cache[patient_id] = self._make_patient_summary(p, twin_data)
            return

        # Stage 2: Causal Kalman Filter (run once)
        kalman_states = self.kalman_filter.filter_trajectory(readings, baseline)

        # Stage 3: Risk Forecaster
        try:
            scored_days = self.forecaster.score_patient_days(p, readings, baseline, kalman_states)
        except ValueError as err:
            twin_data = self._make_uncalibrated_twin(f"Missing required EHR field: {err}")
            self._twin_cache[patient_id] = twin_data
            self._summary_cache[patient_id] = self._make_patient_summary(p, twin_data)
            return

        if not scored_days:
            twin_data = self._make_uncalibrated_twin("No valid scored telemetry days available.")
            self._twin_cache[patient_id] = twin_data
            self._summary_cache[patient_id] = self._make_patient_summary(p, twin_data)
            return

        latest_scored = scored_days[-1]
        score_day = latest_scored["day"]
        data_age_days = current_day - score_day
        stale_data = (data_age_days >= 3)

        # Retrieve Kalman state corresponding to score_day
        scored_idx = None
        for idx, r in enumerate(readings):
            if r.get("day") == score_day:
                scored_idx = idx
                break
        if scored_idx is not None and scored_idx < len(kalman_states):
            ks = kalman_states[scored_idx]
        else:
            ks = kalman_states[-1] if kalman_states else {"d_t": 0.0, "sd_t": 0.18, "drift_rate": 0.0}

        # Step 1: Forward Risk Cone
        cone = self.forecaster.risk_cone(
            x_raw=latest_scored["x_raw"],
            d_t=float(ks.get("d_t", 0.0)),
            sd_t=float(ks.get("sd_t", 0.18)),
            drift_rate=float(ks.get("drift_rate", 0.0))
        )

        # Stage 4: Triage Zone State Machine
        recent_scores = [(s["day"], s["p50"]) for s in scored_days]
        acute_red_flags = [
            {"day": r["day"], "type": r.get("red_flag")}
            for r in readings
            if r.get("red_flag") is not None and r.get("day", current_day) <= current_day
        ]

        triage_state = self.zone_machine.evaluate_triage_state(
            is_calibrated=True,
            recent_scores=recent_scores,
            acute_red_flags=acute_red_flags,
            patient_id=patient_id,
            current_day=current_day
        )

        # Step D2: Drivers - telemetry features individually; ALL static EHR features summed
        # into ONE item {feature: "baseline_clinical_profile"}. Top 6 by absolute value.
        exp = self.forecaster.explain(latest_scored["x_raw"])
        static_contrib = sum(
            f["logitContribution"]
            for f in exp["features"]
            if f["feature"] in STATIC_EHR_FEATURES
        )
        grouped_features = [
            f for f in exp["features"]
            if f["feature"] not in STATIC_EHR_FEATURES
        ]
        grouped_features.append({
            "feature": "baseline_clinical_profile",
            "rawValue": None,
            "zScore": None,
            "logitContribution": float(static_contrib)
        })
        drivers = sorted(grouped_features, key=lambda c: abs(c["logitContribution"]), reverse=True)[:6]
        drivers_note = (
            "linear-model contributions in log-odds units; not causal; clipped at +-4. "
            "Contributions are relative to the average training patient; "
            "telemetry features overlap, so credit between them is approximate."
        )

        # Step D6: scoreHistory: [{day, p50}] for the last 14 valid scored days.
        score_history = [{"day": s["day"], "p50": s["p50"]} for s in scored_days[-14:]]

        # Step D6: recentReadings: last 7 calendar days [{day, restingHR, hrv, steps, sleepHours, spo2, bpSys, bpDia}] with null for missing values/days.
        reading_by_day = {r.get("day"): r for r in readings if r.get("day") is not None}
        recent_readings = []
        for d in range(current_day - 6, current_day + 1):
            r = reading_by_day.get(d)
            if r is not None:
                recent_readings.append({
                    "day": d,
                    "restingHR": r.get("resting_hr"),
                    "hrv": r.get("hrv"),
                    "steps": r.get("steps"),
                    "sleepHours": r.get("sleep_hours"),
                    "spo2": r.get("spo2"),
                    "bpSys": r.get("bp_sys"),
                    "bpDia": r.get("bp_dia")
                })
            else:
                recent_readings.append({
                    "day": d,
                    "restingHR": None,
                    "hrv": None,
                    "steps": None,
                    "sleepHours": None,
                    "spo2": None,
                    "bpSys": None,
                    "bpDia": None
                })

        # Step D6: Keep the latest scored day's raw feature vector in PRIVATE store cache
        self._raw_feature_cache[patient_id] = {
            "score_day": score_day,
            "x_raw": list(latest_scored["x_raw"])
        }

        twin_data = {
            "isCalibrated": True,
            "lockDay": baseline["lock_day"],
            "hr0": float(baseline["hr_0"]),
            "hrv0": float(baseline["hrv_0"]),
            "steps0": float(baseline["steps_0"]),
            "normalBand": baseline["normal_band"],
            "kalman_d_t": float(ks["d_t"]),
            "kalman_sd_t": float(ks["sd_t"]),
            "driftRate": float(ks["drift_rate"]),
            "p10": cone["p10"],
            "p50": cone["p50"],
            "p90": cone["p90"],
            "forwardCone": cone["forward_cone"],
            "triageZone": triage_state["zone"],
            "watch": triage_state["watch"],
            "redSource": triage_state["red_source"],
            "zoneRationale": triage_state["rationale"],
            "activeEpisode": triage_state["active_episode"],
            "scoreDay": score_day,
            "dataAgeDays": data_age_days,
            "staleData": stale_data,
            "bandsValidated": cone.get("bandsValidated", False),
            "bandBasis": cone.get("bandBasis", "kalman_filter_uncertainty_only"),
            "modelVersion": self.forecaster.version,
            "trainedOn": self.forecaster.trained_on,
            "drivers": drivers,
            "driversNote": drivers_note,
            "scoreHistory": score_history,
            "recentReadings": recent_readings,
            "lastIngestAt": self._patient_ingest_meta.get(patient_id, {}).get("lastIngestAt"),
            "streamSource": self._patient_ingest_meta.get(patient_id, {}).get("streamSource", "seed")
        }

        self._twin_cache[patient_id] = twin_data
        self._summary_cache[patient_id] = self._make_patient_summary(p, twin_data)

    def refresh(self, patient_id: str) -> None:
        """Recomputes and refreshes the cache for a specific patient under lock."""
        with self._lock:
            self._compute_and_cache_patient(patient_id)

    def _ingest_reading_locked(
        self,
        patient_id: str,
        packet_data: Dict[str, Any],
        source: str = "api",
        received_at: Optional[str] = None,
        persist: bool = True,
        generate_alert: bool = True
    ) -> Dict[str, Any]:
        if patient_id not in self.patient_map:
            raise KeyError(f"Patient {patient_id} not found")

        patient = self.patient_map[patient_id]
        readings = patient.setdefault("daily_readings", [])
        last_day = readings[-1]["day"] if readings else 0
        day = int(packet_data["day"])

        if day <= last_day:
            raise ValueError(f"Day {day} <= last stored day {last_day}")

        # Capture old state for alert generation
        old_twin = self._twin_cache.get(patient_id, {})
        old_zone = old_twin.get("triageZone")
        old_watch = old_twin.get("watch", False)
        old_effective_zone = "watch" if (old_watch and old_zone not in ("yellow", "red")) else old_zone
        old_red_source = old_twin.get("redSource")
        old_score_day = old_twin.get("scoreDay")

        received_time = received_at or datetime.now(timezone.utc).isoformat()
        self._patient_ingest_meta[patient_id] = {
            "lastIngestAt": received_time,
            "streamSource": source
        }

        # Fill skipped days with explicit missing-day entries
        if day > last_day + 1:
            for skipped_d in range(last_day + 1, day):
                skipped_entry = {
                    "day": skipped_d,
                    "resting_hr": None,
                    "hrv": None,
                    "steps": None,
                    "sleep_hours": None,
                    "spo2": None,
                    "bp_sys": None,
                    "bp_dia": None,
                    "med_adherence": False,
                    "rehab_attended": False,
                    "red_flag": None
                }
                readings.append(skipped_entry)
                if persist and self.db:
                    self.db.insert_reading({
                        "patient_id": patient_id,
                        "day": skipped_d,
                        "resting_hr": None,
                        "hrv": None,
                        "steps": None,
                        "sleep_hours": None,
                        "med_adherence": 0,
                        "rehab_attended": 0,
                        "spo2": None,
                        "bp_sys": None,
                        "bp_dia": None,
                        "red_flag": None,
                        "source": source,
                        "received_at": received_time
                    })

        # Append new reading with full schema
        new_entry = {
            "day": day,
            "resting_hr": packet_data.get("resting_hr"),
            "hrv": packet_data.get("hrv"),
            "steps": packet_data.get("steps"),
            "sleep_hours": packet_data.get("sleep_hours"),
            "med_adherence": bool(packet_data.get("med_adherence", True)),
            "rehab_attended": bool(packet_data.get("rehab_attended", False)),
            "spo2": packet_data.get("spo2"),
            "bp_sys": packet_data.get("bp_sys"),
            "bp_dia": packet_data.get("bp_dia"),
            "red_flag": packet_data.get("red_flag")
        }
        readings.append(new_entry)

        if persist and self.db:
            self.db.insert_reading({
                "patient_id": patient_id,
                "day": day,
                "resting_hr": packet_data.get("resting_hr"),
                "hrv": packet_data.get("hrv"),
                "steps": packet_data.get("steps"),
                "sleep_hours": packet_data.get("sleep_hours"),
                "med_adherence": 1 if packet_data.get("med_adherence", True) else 0,
                "rehab_attended": 1 if packet_data.get("rehab_attended", False) else 0,
                "spo2": packet_data.get("spo2"),
                "bp_sys": packet_data.get("bp_sys"),
                "bp_dia": packet_data.get("bp_dia"),
                "red_flag": packet_data.get("red_flag"),
                "source": source,
                "received_at": received_time
            })

        # Refresh patient cache under the same lock
        self._compute_and_cache_patient(patient_id)

        twin = self._twin_cache[patient_id]
        new_zone = twin.get("triageZone")
        new_watch = twin.get("watch", False)
        new_effective_zone = "watch" if (new_watch and new_zone not in ("yellow", "red")) else new_zone
        new_red_source = twin.get("redSource")
        new_score_day = twin.get("scoreDay")

        DOWNGRADE_TRANSITIONS = {
            ("red", "yellow"),
            ("red", "watch"),
            ("red", "green"),
            ("yellow", "watch"),
            ("yellow", "green"),
            ("watch", "green"),
        }

        if generate_alert and self.db:
            transition = (old_effective_zone, new_effective_zone)
            if transition in DOWNGRADE_TRANSITIONS:
                self.db.insert_alert(
                    patient_id=patient_id,
                    kind="downgrade",
                    zone=new_effective_zone,
                    red_source=new_red_source,
                    p50=twin.get("p50"),
                    score_day=new_score_day,
                    rationale=twin.get("zoneRationale", f"Improved: triage state transitioned from {str(old_effective_zone).upper()} to {str(new_effective_zone).upper()}"),
                    created_at=received_time
                )
            elif new_effective_zone in ("watch", "yellow", "red"):
                is_state_changed = (
                    (new_effective_zone != old_effective_zone) or
                    (new_red_source != old_red_source) or
                    (old_score_day is None and new_score_day is not None)
                )
                if is_state_changed:
                    self.db.insert_alert(
                        patient_id=patient_id,
                        kind="transition",
                        zone=new_effective_zone,
                        red_source=new_red_source,
                        p50=twin.get("p50"),
                        score_day=new_score_day,
                        rationale=twin.get("zoneRationale", ""),
                        created_at=received_time
                    )

        return {
            "status": "ingested",
            "patient_id": patient_id,
            "day": day,
            "triageZone": twin.get("triageZone"),
            "watch": twin.get("watch"),
            "redSource": twin.get("redSource"),
            "p50": twin.get("p50"),
            "scoreDay": twin.get("scoreDay"),
            "dataAgeDays": twin.get("dataAgeDays"),
            "staleData": twin.get("staleData"),
            "lastIngestAt": twin.get("lastIngestAt"),
            "streamSource": twin.get("streamSource")
        }

    def ingest_reading(
        self,
        patient_id: str,
        packet_data: Dict[str, Any],
        source: str = "api",
        received_at: Optional[str] = None,
        persist: bool = True,
        generate_alert: bool = True
    ) -> Dict[str, Any]:
        """
        Thread-safe ingestion of wearable telemetry packet per PART B1/B3.
        Writes through to readings table in DB under lock after in-memory update.
        """
        with self._lock:
            return self._ingest_reading_locked(
                patient_id=patient_id,
                packet_data=packet_data,
                source=source,
                received_at=received_at,
                persist=persist,
                generate_alert=generate_alert
            )

    def get_all_patients(self) -> List[Dict[str, Any]]:
        """Reads cached patient summaries."""
        return list(self._summary_cache.values())

    def compute_twin(self, patient_id: str) -> Dict[str, Any]:
        """Reads cached digital twin state for patient."""
        if patient_id in self._twin_cache:
            return self._twin_cache[patient_id]
        return self._make_uncalibrated_twin("Unknown patient ID.")

    def what_if_scenario(self, patient_id: str, overrides: Dict[str, Any]) -> Dict[str, Any]:
        """
        Runs a counterfactual scenario on the patient's latest scored day per PART D7.
        Does not mutate the patient store, cache, or raw features.
        """
        with self._lock:
            if patient_id not in self.patient_map:
                raise KeyError(f"Unknown patient ID '{patient_id}'")

            twin = self.compute_twin(patient_id)
            if not twin.get("isCalibrated"):
                raise ValueError("Patient is not calibrated; what-if scenario is unavailable.")

            score_day = twin.get("scoreDay")
            if score_day is None:
                raise ValueError("No scored telemetry days available for patient.")

            if twin.get("staleData", False):
                raise ValueError("Telemetry data is stale (dataAgeDays >= 3); what-if scenario is unavailable.")

            raw_info = self._raw_feature_cache.get(patient_id)
            if not raw_info or "x_raw" not in raw_info:
                raise ValueError("No raw feature vector cached for patient.")

            # Make a copy of cached latest raw feature vector
            x_scenario = list(raw_info["x_raw"])
            x_base = list(raw_info["x_raw"])

        # Mapping from API override keys to model feature names
        override_to_feature = {
            "stepsRatio": "steps_ratio_3d_mean",
            "sleepHours": "sleep_hours_3d_mean",
            "hrAboveBaseline": "hr_above_baseline_3d_mean",
            "recoveryIndex": "d_t",
            "missedMeds7d": "missed_meds_last_7d",
            "rehabSessions7d": "rehab_attended_last_7d"
        }

        # Apply overrides
        for k, v in overrides.items():
            if k not in override_to_feature:
                raise KeyError(f"Disallowed override key: '{k}'")
            feat_name = override_to_feature[k]
            idx = self.forecaster.feature_names.index(feat_name)
            x_scenario[idx] = float(v)

        # Score baseline through standard pipeline
        x_std_base = standardize_and_clip(x_base, self.forecaster.mean, self.forecaster.std, self.forecaster.clip)
        raw_logit_base = float(np.dot(x_std_base, self.forecaster.weights) + self.forecaster.intercept)
        calib_logit_base = float(self.forecaster.platt_a * raw_logit_base + self.forecaster.platt_b)
        baseline_p50 = float(1.0 / (1.0 + np.exp(-calib_logit_base)))

        # Score scenario through the EXACT same standardize_and_clip + logistic + Platt path
        x_std_scen = standardize_and_clip(x_scenario, self.forecaster.mean, self.forecaster.std, self.forecaster.clip)
        raw_logit_scen = float(np.dot(x_std_scen, self.forecaster.weights) + self.forecaster.intercept)
        calib_logit_scen = float(self.forecaster.platt_a * raw_logit_scen + self.forecaster.platt_b)
        scenario_p50 = float(1.0 / (1.0 + np.exp(-calib_logit_scen)))

        delta_log_odds = float(calib_logit_scen - calib_logit_base)

        yellow_cutoff = self.zone_machine.yellow_cutoff
        red_cutoff = self.zone_machine.red_cutoff

        note_constant = (
            "Scenario only: the selected value is changed and everything else is held fixed. "
            "Real changes usually move several measures together. This is not a prediction and not advice. "
            "Zones also need 2 consecutive days above a cutoff."
        )

        current_values = {}
        for k in overrides.keys():
            feat_name = override_to_feature[k]
            idx = self.forecaster.feature_names.index(feat_name)
            current_values[k] = float(x_base[idx])

        return {
            "patientId": patient_id,
            "scoreDay": score_day,
            "appliedOverrides": overrides,
            "currentValues": current_values,
            "baselineP50": baseline_p50,
            "scenarioP50": scenario_p50,
            "deltaLogOdds": delta_log_odds,
            "scenarioAtOrAboveYellowCutoff": scenario_p50 >= yellow_cutoff,
            "scenarioAtOrAboveRedCutoff": scenario_p50 >= red_cutoff,
            "note": note_constant
        }

cohort_store = CohortStore()
