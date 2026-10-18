import { PATIENTS, INITIAL_ALERTS, DEMO_SIMULATION_STEPS } from './patientData';
import { 
  getPatients as apiGetPatients, 
  getTwin as apiGetTwin, 
  getWhatIf as apiGetWhatIf,
  getAlerts as apiGetAlerts,
  markAlertRead as apiMarkAlertRead
} from './api';

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:8000';

class PatientService {
  constructor() {
    this.patients = [];
    this.source = 'loading'; // 'loading' | 'live' | 'offline-demo'
    this.lastFetched = null;
    this.error = null;
    this.alerts = [...INITIAL_ALERTS];
    this.isBackendConnected = false;
  }

  getState() {
    return {
      patients: this.patients,
      source: this.source,
      lastFetched: this.lastFetched,
      error: this.error
    };
  }

  // Fetch all patients from backend or fallback to local dataset
  async fetchPatients() {
    try {
      const liveData = await apiGetPatients();
      if (Array.isArray(liveData) && liveData.length > 0) {
        this.patients = liveData.map(p => {
          const localMatch = PATIENTS.find(lp => lp.id === p.id) || PATIENTS[0];
          return {
            ...localMatch,
            ...p,
            vitals: {
              ...localMatch?.vitals,
              ...p.vitals
            },
            records: (localMatch?.records && localMatch.records.length > 0) ? localMatch.records : (PATIENTS[0]?.records || []),
            hotspots: localMatch?.hotspots || PATIENTS[0]?.hotspots,
            alerts: p.alerts || localMatch?.alerts || [],
            isSimulated: false
          };
        });

        // Also fetch real alerts from backend DB if connected
        try {
          const liveAlerts = await apiGetAlerts();
          if (Array.isArray(liveAlerts) && liveAlerts.length > 0) {
            this.alerts = liveAlerts.map(a => {
              const matchedPt = this.patients.find(pt => pt.id === a.patient_id);
              const isCrit = a.zone === 'red' || a.kind === 'CRITICAL_TRIAGE';
              const isElev = a.zone === 'yellow' || a.kind === 'WATCH_ALERT';
              return {
                id: a.id,
                patientId: a.patient_id,
                patientName: matchedPt ? matchedPt.name : a.patient_id,
                timestamp: a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
                severity: isCrit ? 'critical' : (isElev ? 'elevated' : 'stable'),
                title: a.kind === 'CRITICAL_TRIAGE' ? 'High-Risk Triage Alert' : (a.kind === 'WATCH_ALERT' ? 'Early Trajectory Warning' : 'Clinical Telemetry Event'),
                description: a.rationale || `Patient entered ${a.zone?.toUpperCase()} triage risk cone.`,
                isRead: Boolean(a.read),
                actionRequired: isCrit ? 'Immediate Clinical Review' : 'Monitor Recovery Trajectory'
              };
            });
          }
        } catch (alertErr) {
          console.warn("Could not fetch backend alerts:", alertErr);
        }

        this.source = 'live';
        this.lastFetched = new Date();
        this.error = null;
        this.isBackendConnected = true;
        return this.patients;
      }
    } catch (err) {
      this.error = err.message || 'API connection failed';
    }

    // Fallback to offline demo data
    this.patients = PATIENTS.map(p => ({
      ...p,
      isSimulated: true
    }));
    this.source = 'offline-demo';
    this.lastFetched = new Date();
    this.isBackendConnected = false;
    return this.patients;
  }

  // Fetch digital twin state (Kalman d_t, baseline lock, 7-day risk cone P10/P50/P90)
  async fetchPatientTwin(patientId) {
    if (this.source === 'live') {
      try {
        return await apiGetTwin(patientId);
      } catch (e) {
        // fallback to cached twinState on patient summary
      }
    }
    const p = this.getPatientById(patientId);
    return p?.twinState || p;
  }

  // Fetch physiological timeseries with personal normal bands and dropout indicators
  async fetchPatientTimeseries(patientId) {
    if (this.source === 'live') {
      try {
        const response = await fetch(`${API_BASE_URL}/api/v2/patients/${patientId}/timeseries`);
        if (response.ok) return await response.json();
      } catch (e) {}
    }
    const patient = this.getPatientById(patientId);
    return patient?.riskTrajectory || [];
  }

  // What-if simulation
  async getWhatIf(patientId, overrides) {
    return apiGetWhatIf(patientId, overrides);
  }

  // Connect to SSE Telemetry stream
  subscribeToLiveStream(patientId, onPacketReceived, onError) {
    try {
      const eventSource = new EventSource(`${API_BASE_URL}/api/stream/${patientId}`);
      eventSource.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          onPacketReceived(packet);
        } catch (err) {
          console.error("Stream parse error:", err);
        }
      };
      eventSource.onerror = (err) => {
        if (onError) onError(err);
        eventSource.close();
      };
      return eventSource;
    } catch (err) {
      if (onError) onError(err);
      return null;
    }
  }

  getPatients() {
    return this.patients.length > 0 ? [...this.patients] : [...PATIENTS];
  }

  getPatientById(id) {
    const list = this.patients.length > 0 ? this.patients : PATIENTS;
    return list.find(p => p.id === id) || list[0];
  }

  getStats() {
    const list = this.getPatients();
    const total = list.length;
    const stable = list.filter(p => p.riskLevel === 'stable' || p.twinState?.triageZone === 'green').length;
    const elevated = list.filter(p => p.riskLevel === 'elevated' || p.twinState?.triageZone === 'yellow').length;
    const critical = list.filter(p => p.riskLevel === 'critical' || p.twinState?.triageZone === 'red').length;
    return {
      total,
      stable,
      elevated,
      critical,
      activePredictions: elevated + critical
    };
  }

  getAlerts() {
    return [...this.alerts];
  }

  markAlertAsRead(alertId) {
    this.alerts = this.alerts.map(a => a.id === alertId ? { ...a, isRead: true } : a);
    if (this.source === 'live') {
      apiMarkAlertRead(alertId).catch(() => {});
    }
    return [...this.alerts];
  }

  addAlert(newAlert) {
    this.alerts = [newAlert, ...this.alerts];
    return [...this.alerts];
  }

  getSimulationSteps() {
    return DEMO_SIMULATION_STEPS;
  }
}

export const patientService = new PatientService();

export async function fetchLivePatients() {
  return patientService.fetchPatients();
}

export default patientService;
