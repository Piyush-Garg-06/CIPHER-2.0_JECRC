import { PATIENTS, INITIAL_ALERTS, DEMO_SIMULATION_STEPS } from './patientData';
import { getPatients as apiGetPatients, getTwin as apiGetTwin, getWhatIf as apiGetWhatIf } from './api';

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
        // Never spread mock fields over live patients
        this.patients = liveData.map(p => ({
          ...p,
          isSimulated: false
        }));
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

  // Fetch physiological timeseries with personal normal bands
  async fetchPatientTimeseries(patientId) {
    if (this.source === 'live') {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v2/patients/${patientId}/timeseries`);
        if (response.ok) return await response.json();
      } catch (e) {}
    }
    const patient = this.getPatientById(patientId);
    return patient?.riskTrajectory || [];
  }

  async getWhatIf(patientId, overrides) {
    return apiGetWhatIf(patientId, overrides);
  }

  getPatients() {
    return [...this.patients];
  }

  getPatientById(id) {
    return this.patients.find(p => p.id === id) || this.patients[0];
  }

  getStats() {
    const total = this.patients.length;
    const stable = this.patients.filter(p => p.riskLevel === 'stable').length;
    const elevated = this.patients.filter(p => p.riskLevel === 'elevated').length;
    const critical = this.patients.filter(p => p.riskLevel === 'critical').length;
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
