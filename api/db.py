import os
import sqlite3
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

DEFAULT_DB_PATH = os.path.join("data", "app.db")

def get_db_path() -> str:
    return os.environ.get("DB_PATH", DEFAULT_DB_PATH)

class Database:
    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or get_db_path()
        self._mem_conn = None
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
        else:
            db_dir = os.path.dirname(os.path.abspath(self.db_path))
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self) -> None:
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
                source TEXT CHECK(source IN ('api', 'simulated')),
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
                reading_data.get("source", "api"),
                reading_data.get("received_at", datetime.now(timezone.utc).isoformat())
            ))
            conn.commit()

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

    def get_alerts(self, unread_only: bool = False) -> List[Dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            if unread_only:
                cur.execute("SELECT * FROM alerts WHERE read = 0 ORDER BY id DESC")
            else:
                cur.execute("SELECT * FROM alerts ORDER BY id DESC")
            rows = cur.fetchall()
            return [dict(r) for r in rows]

    def get_alert_by_id(self, alert_id: int) -> Optional[Dict[str, Any]]:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("SELECT * FROM alerts WHERE id = ?", (alert_id,))
            row = cur.fetchone()
            return dict(row) if row else None

    def mark_alert_read(self, alert_id: int) -> Optional[Dict[str, Any]]:
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
            cur.execute("SELECT patient_id, next_day FROM sim_state")
            return {row["patient_id"]: row["next_day"] for row in cur.fetchall()}

    def set_sim_state(self, patient_id: str, next_day: int) -> None:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("INSERT OR REPLACE INTO sim_state (patient_id, next_day) VALUES (?, ?)", (patient_id, next_day))
            conn.commit()

    def reset_sim_data(self) -> None:
        with self.get_connection() as conn:
            cur = conn.cursor()
            cur.execute("DELETE FROM readings WHERE source = 'simulated'")
            cur.execute("DELETE FROM alerts")
            cur.execute("DELETE FROM sim_state")
            conn.commit()

# Default singleton instance
db = Database()
