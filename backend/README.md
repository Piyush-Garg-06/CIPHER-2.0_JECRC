# PulseTwin / AURA - Backend Core API & ML Engine

The backend layer is an asynchronous REST & Server-Sent Events (SSE) telemetry service powered by FastAPI, Pydantic v2, and a pure-NumPy 4-Stage Predictive Digital Twin Model.

---

## 📁 Backend Directory Structure

```
backend/
├── api/
│   ├── main.py              # FastAPI app initialization, lifespan, CORS, SSE endpoint
│   ├── routes_v2.py         # REST endpoints (patients, twin, timeseries, what-if, alerts)
│   ├── cohort_v2_store.py   # Thread-safe in-memory CohortStore singleton & precomputed caches
│   ├── db.py                # SQLite persistence layer with WAL mode & automated migration
│   ├── models.py            # Pydantic v2 data contracts & validation schemas
│   ├── simulator.py         # Wearable streaming telemetry background simulator thread
│   ├── stream_state.py      # Real-time SSE broadcasting manager
│   └── model_card.py        # Model card and performance metrics loader
│
├── twin/
│   ├── baseline.py          # Stage 1: Personal baseline calibration guard (days 0-14)
│   ├── estimator_v2.py      # Stage 2: 2-state causal Kalman filter (recovery index d_t)
│   ├── features.py          # Feature extraction & causal rolling feature engineering
│   ├── forecast.py          # Stage 3: Calibrated 7-day readmission risk forecaster
│   ├── zones.py             # Stage 4: Triage zone state machine with clinical hysteresis
│   ├── model.json           # Trained logistic regression model weights & calibration intercept
│   └── zone_cutoffs.json    # Calibrated triage threshold cutoffs (Yellow, Red)
│
├── data_gen/
│   └── cohort_v2.py         # Pure-NumPy synthetic patient trajectory generator (177 cohort)
│
├── scripts/
│   ├── train_model.py       # Model training, Platt scaling calibration, and validation
│   └── check_cohort.py      # Cohort data validation and diagnostic utilities
│
├── reports/
│   ├── metrics.json         # Evaluation benchmarks and validation metric report
│   ├── metrics.md           # Formatted model card and clinical summary
│   └── test_patient_ids.json# Train/test split partitions
│
├── tests/                   # Pytest test suite (hardening, causality, parity, persistence, simulator)
├── requirements.txt         # Python dependencies
└── pytest.ini               # Pytest configuration
```

---

## 🚀 Running the Backend Standalone

### 1. Setup Environment
```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
```

### 2. Start Uvicorn Server
```bash
# Windows PowerShell:
$env:SIM_ENABLED = "1"
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload
```
API runs at `http://127.0.0.1:8000`
OpenAPI Documentation: `http://127.0.0.1:8000/docs`

### 3. Run Backend Tests
```bash
pytest
```
