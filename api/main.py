import os
import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from api.db import db
from api.routes_v2 import router as v2_router
from api.simulator import router as sim_router, simulator
from api.models import WearablePacketInput
from api.stream_state import stream_manager
from api.cohort_v2_store import cohort_store
from api.model_card import load_model_card

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: database initialisation/restore/seed alerts
    db.init_db()
    cohort_store._init_db_and_restore()
    if os.environ.get("SIM_ENABLED") == "1":
        simulator.start_scheduler()
    yield
    # Shutdown
    simulator.stop_scheduler()

app = FastAPI(
    title="AURA Digital Twin Core - Cardiovascular Risk API",
    description="High-performance pure-NumPy 4-Stage Predictive Digital Twin Engine",
    version="2.1.0",
    lifespan=lifespan
)

# CORS configuration per PART B2:
# Allowed origins from env CORS_ORIGINS (comma list), default http://localhost:5173 and http://localhost:3000.
# allow_credentials False unless an explicit origin list is configured. Never a wildcard together with credentials.
cors_env = os.environ.get("CORS_ORIGINS")
if cors_env:
    allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()]
    allow_credentials = ("*" not in allowed_origins)
else:
    allowed_origins = ["http://localhost:5173", "http://localhost:3000"]
    allow_credentials = False

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Routes
app.include_router(v2_router)
app.include_router(sim_router)

@app.get("/health")
async def health_check():
    return {"status": "online", "model": "4-Stage Causal Digital Twin", "engine": "Pure-NumPy"}

@app.get("/api/model-card")
async def get_model_card():
    card = load_model_card()
    if card is None:
        raise HTTPException(status_code=503, detail="Model card reports missing")
    return card

@app.get("/api/v2/model-card")
async def get_model_card_v2():
    card = load_model_card()
    if card is None:
        raise HTTPException(status_code=503, detail="Model card reports missing")
    return card

@app.post("/api/ingest/wearable")
async def ingest_wearable_packet(packet: WearablePacketInput):
    """
    Feature 7: Ingests real-time wearable packet and broadcasts to SSE subscribers.
    Applies strict validation, deduplication, missing-day interpolation,
    cache mutation under store lock, and returns updated digital twin state fields.
    """
    if packet.patient_id not in cohort_store.patient_map:
        raise HTTPException(status_code=404, detail=f"Patient {packet.patient_id} not found")

    patient = cohort_store.patient_map[packet.patient_id]
    readings = patient.get("daily_readings", [])
    last_day = readings[-1]["day"] if readings else 0
    if packet.day <= last_day:
        raise HTTPException(status_code=409, detail=f"Day {packet.day} <= last stored day {last_day}")

    data = packet.model_dump()
    try:
        result = cohort_store.ingest_reading(packet.patient_id, data)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Patient {packet.patient_id} not found")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))

    # Broadcast to live SSE stream including twin state indicators
    broadcast_data = dict(data)
    broadcast_data.update({
        "triageZone": result.get("triageZone"),
        "watch": result.get("watch"),
        "redSource": result.get("redSource"),
        "p50": result.get("p50"),
        "scoreDay": result.get("scoreDay"),
        "dataAgeDays": result.get("dataAgeDays"),
        "staleData": result.get("staleData")
    })
    await stream_manager.broadcast_packet(packet.patient_id, broadcast_data)

    return result

@app.get("/api/stream/{patient_id}")
async def stream_telemetry(patient_id: str, request: Request):
    """
    Feature 7: Server-Sent Events (SSE) live telemetry stream.
    """
    if patient_id not in cohort_store.patient_map:
        raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
    queue = stream_manager.subscribe(patient_id)

    async def event_generator():
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    # Wait for next packet or emit heartbeat
                    packet = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield f"data: {json.dumps(packet)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat keep-alive
                    yield f": heartbeat\n\n"
        finally:
            stream_manager.unsubscribe(patient_id, queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="0.0.0.0", port=8000, reload=True)

