import os
import sqlite3
import threading
import time
import logging
from contextlib import contextmanager
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

DEFAULT_DB_PATH = os.path.join("data", "app.db")
SCHEMA_VERSION = "1.1"

def get_db_path() -> str:
    return os.environ.get("DB_PATH", DEFAULT_DB_PATH)

class Database:
    def __init__(self, db_path: Optional[str] = None, auto_init: Optional[bool] = None):
        self.db_path = db_path or get_db_path()
        self._write_lock = threading.Lock()
        self._mem_conn = None
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row

        if auto_init is None:
            auto_init = (db_path is not None)

        if auto_init:
            self.init_db()

    def close(self) -> None:
        """Close shared in-memory connection if active."""
        if self._mem_conn is not None:
            try:
                self._mem_conn.close()
            except Exception:
                pass
            self._mem_conn = None

    @contextmanager
    def get_connection(self):
        if self._mem_conn is not None:
            yield self._mem_conn
        else:
            db_dir = os.path.dirname(os.path.abspath(self.db_path))
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
            conn = sqlite3.connect(self.db_path, timeout=30.0, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA busy_timeout=5000")
            try:
                yield conn
            finally:
                conn.close()

    def _check_and_migrate_schema(self) -> None:
        """
        If an existing database file has a different schema_version or lacks
        the current columns, log a clear warning, rename the file to
        <name>.old-<timestamp>, and allow fresh DB initialization.
        """
        if self.db_path == ":memory:" or not os.path.exists(self.db_path):
            return

        needs_backup = False
        reason = ""
        try:
            conn = sqlite3.connect(self.db_path, timeout=5.0)
            conn.row_factory = sqlite3.Row
            cur = conn.cursor()

            # Check meta table schema_version
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='meta'")
            if cur.fetchone():
                cur.execute("SELECT value FROM meta WHERE key='schema_version'")
                row = cur.fetchone()
                if row is None or row["value"] != SCHEMA_VERSION:
                    needs_backup = True
                    reason = f"schema_version is '{row['value'] if row else None}', expected '{SCHEMA_VERSION}'"

            # Check readings table columns
            cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='readings'")
            if cur.fetchone():
                cur.execute("PRAGMA table_info(readings)")
                col_names = {r["name"] for r in cur.fetchall()}
                if "stream_source" in col_names or "ingested_at" in col_names:
                    needs_backup = True
                    reason = f"obsolete columns present: {col_names & {'stream_source', 'ingested_at'}}"
                elif "source" not in col_names or "received_at" not in col_names:
                    needs_backup = True
                    reason = f"missing required columns (has {col_names})"

            conn.close()
        except Exception as e:
            needs_backup = True
            reason = f"error inspecting database: {e}"

        if needs_backup:
            ts = int(time.time())
            base_dir = os.path.dirname(os.path.abspath(self.db_path))
            filename = os.path.basename(self.db_path)
            old_name = f"{filename}.old-{ts}"
            backup_path = os.path.join(base_dir, old_name)
            logging.warning(
                "Database at %s has incompatible schema (%s). Renaming to %s and starting a fresh database.",
                self.db_path, reason, backup_path
            )
            try:
                if os.path.exists(self.db_path):
                    os.rename(self.db_path, backup_path)
                for ext in ("-wal", "-shm"):
                    extra = self.db_path + ext
                    if os.path.exists(extra):
                        try:
                            os.rename(extra, backup_path + ext)
                        except Exception:
                            pass
            except Exception as e:
                logging.error("Failed to rename old database file %s: %s", self.db_path, e)

    def init_db(self) -> None:
        with self._write_lock:
            self._check_and_migrate_schema()
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT
                );
                """)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS readings (
                    patient_id TEXT,
                    day INTEGER,
                    resting_hr REAL,
                    hrv REAL,
                    steps INTEGER,
                    sleep_hours REAL,
                    med_adherence INTEGER,
                    rehab_attended INTEGER,
                    spo2 INTEGER,
                    bp_sys INTEGER,
                    bp_dia INTEGER,
                    red_flag TEXT,
                    source TEXT CHECK(source IN ('api', 'simulated', 'seed')),
                    received_at TEXT,
                    PRIMARY KEY (patient_id, day)
                );
                """)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS alerts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    patient_id TEXT,
                    kind TEXT,
                    zone TEXT,
                    red_source TEXT,
                    p50 REAL,
                    score_day INTEGER,
                    rationale TEXT,
                    created_at TEXT,
                    read INTEGER DEFAULT 0
                );
                """)
                cur.execute("""
                CREATE TABLE IF NOT EXISTS sim_state (
                    patient_id TEXT PRIMARY KEY,
                    next_day INTEGER
                );
                """)
                conn.commit()

    def get_meta(self, key: str) -> Optional[str]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT value FROM meta WHERE key = ?", (key,))
            row = cur.fetchone()
            return row["value"] if row else None

    def set_meta(self, key: str, value: str) -> None:
        with self._write_lock:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", (key, str(value)))
                conn.commit()

    def get_all_meta(self) -> Dict[str, str]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT key, value FROM meta")
            return {row["key"]: row["value"] for row in cur.fetchall()}

    def insert_reading(self, reading_data: Dict[str, Any]) -> None:
        with self._write_lock:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                INSERT OR REPLACE INTO readings (
                    patient_id, day, resting_hr, hrv, steps, sleep_hours,
                    med_adherence, rehab_attended, spo2, bp_sys, bp_dia,
                    red_flag, source, received_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    reading_data["patient_id"],
                    int(reading_data["day"]),
                    reading_data.get("resting_hr"),
                    reading_data.get("hrv"),
                    reading_data.get("steps"),
                    reading_data.get("sleep_hours"),
                    int(reading_data.get("med_adherence", 1)) if reading_data.get("med_adherence") is not None else 1,
                    int(reading_data.get("rehab_attended", 0)) if reading_data.get("rehab_attended") is not None else 0,
                    reading_data.get("spo2"),
                    reading_data.get("bp_sys"),
                    reading_data.get("bp_dia"),
                    reading_data.get("red_flag"),
                    reading_data.get("source", reading_data.get("stream_source", "api")),
                    reading_data.get("received_at", reading_data.get("ingested_at", datetime.now(timezone.utc).isoformat()))
                ))
                conn.commit()

    def store_reading(self, reading_data: Dict[str, Any]) -> None:
        """Alias for insert_reading."""
        self.insert_reading(reading_data)

    def get_readings(self, patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            if patient_id:
                cur.execute("SELECT * FROM readings WHERE patient_id = ? ORDER BY day ASC", (patient_id,))
            else:
                cur.execute("SELECT * FROM readings ORDER BY patient_id ASC, day ASC")
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def insert_alert(
        self,
        patient_id: str,
        kind: str,
        zone: str,
        red_source: Optional[str],
        p50: Optional[float],
        score_day: Optional[int],
        rationale: str,
        created_at: Optional[str] = None,
        read: int = 0
    ) -> int:
        if created_at is None:
            created_at = datetime.now(timezone.utc).isoformat()
        with self._write_lock:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                INSERT INTO alerts (
                    patient_id, kind, zone, red_source, p50, score_day, rationale, created_at, read
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    patient_id,
                    kind,
                    zone,
                    red_source,
                    p50,
                    score_day,
                    rationale,
                    created_at,
                    read
                ))
                conn.commit()
                return cur.lastrowid

    def get_alerts(self, unread_only: bool = False, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            query = "SELECT * FROM alerts"
            params = []
            if unread_only:
                query += " WHERE read = 0"
            query += " ORDER BY id DESC"
            if limit is not None:
                query += " LIMIT ?"
                params.append(limit)
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_alerts_summary(self) -> Dict[str, Any]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute("SELECT COUNT(*) FROM alerts")
                total = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM alerts WHERE read = 0")
                unread = cur.fetchone()[0]
                cur.execute("SELECT zone, COUNT(*) FROM alerts GROUP BY zone")
                by_zone = {row["zone"].lower(): row[1] for row in cur.fetchall() if row["zone"]}
                return {
                    "total": total,
                    "unread": unread,
                    "byZone": by_zone
                }
            except sqlite3.OperationalError:
                return {"total": 0, "unread": 0, "byZone": {}}

    def mark_all_alerts_read(self, patient_id: Optional[str] = None) -> int:
        with self._write_lock:
            with self.get_connection() as conn:
                cur = conn.cursor()
                if patient_id:
                    cur.execute("UPDATE alerts SET read = 1 WHERE patient_id = ? AND read = 0", (patient_id,))
                else:
                    cur.execute("UPDATE alerts SET read = 1 WHERE read = 0")
                count = cur.rowcount
                conn.commit()
                return count

    def get_alert_by_id(self, alert_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def mark_alert_read(self, alert_id: int) -> Optional[Dict[str, Any]]:
        with self._write_lock:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("UPDATE alerts SET read = 1 WHERE id = ?", (alert_id,))
                if cur.rowcount == 0:
                    conn.commit()
                    return None
                conn.commit()
                cur.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
                row = cur.fetchone()
                return dict(row) if row else None

    def get_sim_state(self) -> Dict[str, int]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            try:
                cur.execute("SELECT patient_id, next_day FROM sim_state")
                return {row["patient_id"]: row["next_day"] for row in cur.fetchall()}
            except sqlite3.OperationalError:
                return {}

    def set_sim_state(self, patient_id: str, next_day: int) -> None:
        with self._write_lock:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("""
                CREATE TABLE IF NOT EXISTS sim_state (
                    patient_id TEXT PRIMARY KEY,
                    next_day INTEGER
                );
                """)
                cur.execute("INSERT OR REPLACE INTO sim_state (patient_id, next_day) VALUES (?, ?)", (patient_id, next_day))
                conn.commit()

    def reset_sim_data(self) -> None:
        with self._write_lock:
            with self.get_connection() as conn:
                cur = conn.cursor()
                cur.execute("DELETE FROM readings WHERE source = 'simulated'")
                cur.execute("DELETE FROM alerts")
                cur.execute("DELETE FROM sim_state")
                conn.commit()

# Default singleton instance
db = Database()
