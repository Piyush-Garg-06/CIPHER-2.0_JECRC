from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field, model_validator, ConfigDict

class VitalsModel(BaseModel):
    heartRate: Optional[int] = Field(default=None, description="Current heart rate in BPM")
    restingHR: Optional[int] = Field(default=None, description="Resting heart rate in BPM")
    hrv: Optional[int] = Field(default=None, description="rMSSD HRV in milliseconds")
    bloodPressure: Optional[str] = Field(default=None, description="Blood pressure string")
    spo2: Optional[int] = Field(default=None, description="Blood oxygen SpO2 %")
    dailySteps: Optional[int] = Field(default=None, description="Daily step count")
    sleepHours: Optional[str] = Field(default=None, description="Sleep duration")

class DigitalTwinStateModel(BaseModel):
    isCalibrated: bool = True
    lockDay: Optional[int] = None
    hr0: Optional[float] = None
    hrv0: Optional[float] = None
    steps0: Optional[float] = None
    normalBand: Optional[Dict[str, float]] = None
    kalman_d_t: Optional[float] = None
    kalman_sd_t: Optional[float] = None
    driftRate: Optional[float] = None
    p10: Optional[float] = None
    p50: Optional[float] = None
    p90: Optional[float] = None
    forwardCone: Optional[List[Dict[str, Any]]] = None
    triageZone: str = "green"
    watch: bool = False
    redSource: Optional[str] = None
    zoneRationale: str = "Stable recovery"
    activeEpisode: Optional[Dict[str, Any]] = None
    scoreDay: Optional[int] = None
    dataAgeDays: Optional[int] = None
    staleData: bool = False
    bandsValidated: bool = False
    bandBasis: Optional[str] = None
    modelVersion: Optional[str] = None
    trainedOn: Optional[str] = None
    drivers: Optional[List[Dict[str, Any]]] = None
    driversNote: Optional[str] = None
    scoreHistory: Optional[List[Dict[str, Any]]] = None
    recentReadings: Optional[List[Dict[str, Any]]] = None

class WhatIfOverridesModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stepsRatio: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    sleepHours: Optional[float] = Field(default=None, ge=0.0, le=14.0)
    hrAboveBaseline: Optional[float] = Field(default=None, ge=-15.0, le=30.0)
    recoveryIndex: Optional[float] = Field(default=None, ge=-6.0, le=3.0)
    missedMeds7d: Optional[int] = Field(default=None, ge=0, le=7)
    rehabSessions7d: Optional[int] = Field(default=None, ge=0, le=7)

    @model_validator(mode="before")
    @classmethod
    def validate_integer_fields(cls, data: Any):
        if isinstance(data, dict):
            for int_field in ("missedMeds7d", "rehabSessions7d"):
                if int_field in data and data[int_field] is not None:
                    val = data[int_field]
                    if not isinstance(val, int) or isinstance(val, bool):
                        raise ValueError(f"{int_field} must be an integer, got {type(val).__name__}")
        return data

    @model_validator(mode="after")
    def validate_non_empty(self):
        set_fields = [k for k, v in self.__dict__.items() if v is not None and not k.startswith("_")]
        if not set_fields:
            raise ValueError("Overrides cannot be empty")
        return self

class WhatIfRequestModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    overrides: WhatIfOverridesModel

class WhatIfResponseModel(BaseModel):
    model_config = ConfigDict(extra="forbid")
    patientId: str
    scoreDay: int
    appliedOverrides: Dict[str, Any]
    baselineP50: float
    scenarioP50: float
    deltaLogOdds: float
    scenarioAtOrAboveYellowCutoff: bool
    scenarioAtOrAboveRedCutoff: bool
    note: str

class PatientResponseModel(BaseModel):
    id: str
    name: str
    age: int
    gender: str
    riskLevel: str
    riskScore: Optional[float] = None
    riskPercentage: Optional[int] = None
    watch: bool = False
    redSource: Optional[str] = None
    scoreDay: Optional[int] = None
    dataAgeDays: Optional[int] = None
    staleData: bool = False
    monitoringStatus: str = "ok"
    vitals: VitalsModel
    twinState: Optional[DigitalTwinStateModel] = None

class WearablePacketInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    patient_id: str
    day: int
    resting_hr: Optional[float] = None
    hrv: Optional[float] = None
    steps: Optional[int] = None
    sleep_hours: Optional[float] = None
    med_adherence: bool = True
    rehab_attended: bool = False
    spo2: Optional[int] = None
    bp_sys: Optional[int] = None
    bp_dia: Optional[int] = None
    red_flag: Optional[Literal["chest_pain", "syncope", "acute_dyspnea"]] = None

    @model_validator(mode="after")
    def validate_packet_constraints(self):
        if self.day < 1:
            raise ValueError("day must be >= 1")

        # Core 4 sensors: ALL present or ALL None
        core_sensors = [
            self.resting_hr is not None,
            self.hrv is not None,
            self.steps is not None,
            self.sleep_hours is not None,
        ]
        if not (all(core_sensors) or not any(core_sensors)):
            raise ValueError("resting_hr, hrv, steps, and sleep_hours must be ALL present or ALL None")

        if self.resting_hr is not None and not (30 <= self.resting_hr <= 220):
            raise ValueError("resting_hr must be between 30 and 220")
        if self.hrv is not None and not (5 <= self.hrv <= 200):
            raise ValueError("hrv must be between 5 and 200")
        if self.steps is not None and not (0 <= self.steps <= 60000):
            raise ValueError("steps must be between 0 and 60000")
        if self.sleep_hours is not None and not (0 <= self.sleep_hours <= 24):
            raise ValueError("sleep_hours must be between 0 and 24")
        if self.spo2 is not None and not (50 <= self.spo2 <= 100):
            raise ValueError("spo2 must be between 50 and 100")
        if self.bp_sys is not None and not (60 <= self.bp_sys <= 260):
            raise ValueError("bp_sys must be between 60 and 260")
        if self.bp_dia is not None and not (30 <= self.bp_dia <= 160):
            raise ValueError("bp_dia must be between 30 and 160")

        return self

