from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from api.cohort_v2_store import cohort_store
from api.db import db
from api.models import (
    PatientResponseModel,
    DigitalTwinStateModel,
    WhatIfRequestModel,
    WhatIfResponseModel,
    AlertResponseModel
)

router = APIRouter(prefix="/api/v2", tags=["Cohort V2 & Digital Twin"])

@router.get("/patients", response_model=List[PatientResponseModel])
async def list_patients():
    """List all synthetic patients with real-time risk scores and vitals."""
    return cohort_store.get_all_patients()

@router.get("/patients/{patient_id}/twin", response_model=DigitalTwinStateModel)
async def get_patient_twin(patient_id: str):
    """Retrieve digital twin state (Kalman d_t, baseline lock, 7-day risk cone, triage zone)."""
    if patient_id not in cohort_store.patient_map:
        raise HTTPException(status_code=404, detail="Patient ID not found in cohort store")
    twin_data = cohort_store.compute_twin(patient_id)
    return twin_data

@router.get("/patients/{patient_id}/timeseries")
async def get_patient_timeseries(patient_id: str):
    """Retrieve longitudinal readings, personal normal bands, and Kalman filtered trajectory."""
    if patient_id not in cohort_store.patient_map:
        raise HTTPException(status_code=404, detail="Patient ID not found in cohort store")
    
    patient = cohort_store.patient_map[patient_id]
    readings = patient.get("daily_readings", [])
    twin_state = cohort_store.compute_twin(patient_id)
    
    return {
        "patient_id": patient_id,
        "readings": readings,
        "normalBand": twin_state.get("normalBand"),
        "forwardCone": twin_state.get("forwardCone")
    }

@router.post("/patients/{patient_id}/what-if", response_model=WhatIfResponseModel)
async def run_patient_what_if(patient_id: str, request: WhatIfRequestModel):
    """
    Simulates a counterfactual what-if scenario on the latest scored day per PART D7.
    """
    overrides_dict = {k: v for k, v in request.overrides.model_dump().items() if v is not None}
    try:
        result = cohort_store.what_if_scenario(patient_id, overrides_dict)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return result

@router.get("/alerts", response_model=List[AlertResponseModel])
async def list_alerts(
    unread: Optional[bool] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500)
):
    """Retrieve all triage alerts, newest first, with optional ?unread=true and ?limit=N filters."""
    alerts = db.get_alerts(unread_only=bool(unread), limit=limit)
    return [
        {
            "id": a["id"],
            "patient_id": a["patient_id"],
            "kind": a["kind"],
            "zone": a["zone"],
            "red_source": a["red_source"],
            "p50": a["p50"],
            "score_day": a["score_day"],
            "rationale": a["rationale"],
            "created_at": a["created_at"],
            "read": bool(a["read"])
        }
        for a in alerts
    ]

@router.post("/alerts/read-all")
async def read_all_alerts(patient_id: Optional[str] = Query(default=None)):
    """Mark all alerts (or all alerts for a specific patient) as read."""
    if patient_id is not None:
        if patient_id not in cohort_store.patient_map:
            raise HTTPException(status_code=404, detail="Patient not found")
    count = db.mark_all_alerts_read(patient_id=patient_id)
    return {"updated": count}

@router.patch("/alerts/{alert_id}/read", response_model=AlertResponseModel)
async def mark_alert_read(alert_id: int):
    """Mark an alert as read in the database."""
    updated = db.mark_alert_read(alert_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {
        "id": updated["id"],
        "patient_id": updated["patient_id"],
        "kind": updated["kind"],
        "zone": updated["zone"],
        "red_source": updated["red_source"],
        "p50": updated["p50"],
        "score_day": updated["score_day"],
        "rationale": updated["rationale"],
        "created_at": updated["created_at"],
        "read": bool(updated["read"])
    }

