# Cardiovascular Digital Twin & Remote Monitoring System

An interactive digital twin platform for cardiovascular telemetry monitoring, causal Kalman filter drift tracking, and 7-day risk projection.

---

## 1. Installation

### Prerequisites
- Python 3.10+ (tested on Python 3.11)
- Node.js 18+ and npm

### Backend Setup
```bash
# Optional: create and activate a Python virtual environment
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate  # macOS/Linux

# Install Python dependencies
pip install -r requirements.txt
```

### Frontend Setup
```bash
# Install Node dependencies
npm install
```

---

## 2. Running Backend and Frontend

### Option A: Automated Launch Script (Windows PowerShell)
You can launch both the backend and frontend in separate dedicated windows:
```powershell
.\start_demo.ps1
```
Available switches:
- `.\start_demo.ps1 -NoSim`: Launch with simulator disabled.
- `.\start_demo.ps1 -AutoRestart`: Enable automated simulation restart upon cohort exhaustion (`SIM_AUTORESTART=1`).
- `.\start_demo.ps1 -Fresh`: Clear `data/app.db*` before starting to begin from seed telemetry.

### Option B: Manual Execution

#### Terminal 1 — Backend API
```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
API runs at: `http://127.0.0.1:8000` (OpenAPI docs at `http://127.0.0.1:8000/docs`).

#### Terminal 2 — Frontend Application
```bash
npm run dev
```
Vite dev server runs at: `http://localhost:5173`.

---

## 3. Environment Variables Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SIM_ENABLED` | `1` | `1` enables the background wearable telemetry stream simulator; `0` disables background generation. |
| `SIM_AUTORESTART` | `0` | `1` enables automated simulation loop restart when all patients reach day 60 exhaustion; `0` stops when exhausted. |
| `SIM_TICK_SECONDS` | `20.0` | Cadence in seconds between simulated streaming ticks. |
| `SIM_ADVANCE_FRACTION` | `0.34` | Fraction of active cohort patients selected to receive a new daily packet on each tick. |
| `DB_PATH` | `data/app.db` | File path for SQLite persistence. Set to `:memory:` for temporary in-memory storage (used in tests). |
| `VITE_POLL_MS` | `5000` | Frontend polling cadence in milliseconds for fetching updated cohort telemetry and alerts. |

---

## 4. How to Reset the Demo

To clear state and return to day 0 seed telemetry:

1. **Via PowerShell Script**:
   ```powershell
   .\start_demo.ps1 -Fresh
   ```
2. **Via REST API**:
   ```bash
   curl -X POST http://127.0.0.1:8000/api/sim/reset
   ```
3. **Manual File Reset**:
   Stop the backend and delete `data/app.db`, `data/app.db-wal`, and `data/app.db-shm`. The database will automatically recreate cleanly on the next startup.

---

## 5. Synthetic Data Notice & Non-Validation Disclosure

- **Synthetic Cohort**: All 177 cohort patients, physiological telemetry streams (resting heart rate, rMSSD HRV, daily steps, blood pressure), medical record PDFs, lab panels, and physician notes are synthetically generated for software demonstration purposes. No real patient data or protected health information (PHI) is used.
- **Not Clinically Validated**: Risk scores, triage zones (Green / Watch / Yellow / Red), causal Kalman filter recovery indices ($d_t$), and 7-day forward projection cones are algorithmic demonstration projections. They are **not clinically validated**, do not constitute medical diagnosis or advice, and must not be used to direct clinical interventions or replace physician judgment.

---

## 6. Known Demo Limits

- **Stale patients keep their last zone**: When no telemetry readings have been received for 3 or more calendar days, digital twin scores and triage zones are held frozen rather than reset or rescored.
- **Red counts include frozen scores**: In this synthetic replay, most Red-model patients are stale because the generator stops producing readings at the modeled event, so the Red count includes frozen scores.
- **Simulator replays pre-generated histories**: The simulator replays pre-generated histories and is not a model test.
- **Probabilities below calibration threshold are not precise**: Probabilities below about the calibration threshold in the model card are not precise.

---

## 7. Technical & Architectural Limitations

- **No Authentication / Access Control**: The application is designed for local demonstration and development. Role switching between Doctor and Patient portals is purely a client-side interface toggle with no multi-tenant isolation, user authentication, or cryptographic authorization.
- **Localhost Only**: Backend endpoints bind strictly to loopback (`127.0.0.1` / `localhost`). Simulator control endpoints (`/api/sim/*`) enforce loopback checks and reject non-localhost network callers.
- **Single-Node SQLite Storage**: Persistence uses a local SQLite database file with WAL mode. It is not designed for concurrent multi-instance clustering or distributed high-availability production workloads.
