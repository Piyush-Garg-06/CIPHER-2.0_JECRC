from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from api.cohort_v2_store import cohort_store
from api.models import (
    PatientResponseModel,
    DigitalTwinStateModel,
    WhatIfRequestModel,
    WhatIfResponseModel
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
