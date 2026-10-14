import { PATIENTS, INITIAL_ALERTS, DEMO_SIMULATION_STEPS } from './patientData';
import { 
  getPatients as apiGetPatients, 
  getTwin as apiGetTwin, 
  getWhatIf as apiGetWhatIf,
  getAlerts as apiGetAlerts,
  markAlertAsRead as apiMarkAlertRead
} from './api';
import { formatRisk } from '../utils/formatters';

class PatientService {
  constructor() {
    this.patients = [];
    this.source = 'loading'; // 'loading' | 'live' | 'offline-demo'
    this.lastFetched = null;
    this.error = null;
    this.alerts = [...INITIAL_ALERTS];
    this.liveAlerts = [];
    this.readAlertIds = new Set();
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

        // Fetch live alerts from API
        try {
          const apiAlerts = await apiGetAlerts();
          if (Array.isArray(apiAlerts)) {
            this.liveAlerts = apiAlerts;
          }
        } catch (alertErr) {
          // Keep existing live alerts on transient failure
        }

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
    if (this.source === 'live') {
      if (this.liveAlerts && this.liveAlerts.length > 0) {
        return this.liveAlerts.map(a => {
          const patient = this.patients.find(p => p.id === a.patient_id);
          const zone = (a.zone || 'green').toLowerCase();
          const severity = zone === 'red' ? 'critical' : (zone === 'yellow' ? 'elevated' : 'watch');
          const approxRisk = formatRisk(a.p50);
          return {
            id: a.id,
            patientId: a.patient_id,
            patientName: patient?.name || a.patient_id,
            kind: a.kind,
            zone,
            redSource: a.red_source || null,
            p50: a.p50,
            scoreDay: a.score_day,
            approxRisk,
            zoneRationale: a.rationale,
            severity,
            title: `Triage Zone: ${zone.toUpperCase()}${a.red_source ? ` (${a.red_source})` : ''}`,
            description: `${approxRisk}${a.score_day != null ? ` at day ${a.score_day}` : ''}. ${a.rationale}`,
            timestamp: a.score_day != null ? `Day ${a.score_day}` : 'Recent',
            isRead: Boolean(a.read),
            isSimulated: false
          };
        });
      }

      const qualifying = this.patients.filter(p => {
        const zone = (p.twinState?.triageZone || p.triageZone || p.riskLevel || '').toLowerCase();
        const isWatch = Boolean(p.twinState?.watch ?? p.watch);
        return zone === 'red' || zone === 'yellow' || isWatch || zone === 'watch';
      });

      return qualifying.map(p => {
        const ts = p.twinState || {};
        let zone = (ts.triageZone || p.triageZone || p.riskLevel || 'green').toLowerCase();
        const isWatch = Boolean(ts.watch ?? p.watch);
        if (isWatch && zone !== 'red' && zone !== 'yellow') {
          zone = 'watch';
        }
        const redSource = ts.redSource || p.redSource || null;
        const p50 = ts.p50 ?? p.riskScore;
        const approxRisk = formatRisk(p50);
        const scoreDay = ts.scoreDay ?? p.scoreDay ?? null;
        const zoneRationale = ts.zoneRationale || p.zoneRationale || (
          zone === 'red' ? 'High risk threshold exceeded' :
          zone === 'yellow' ? 'Elevated risk threshold exceeded' :
          'Watch state active'
        );
        const alertId = `alert-${p.id}`;
        const severity = zone === 'red' ? 'critical' : (zone === 'yellow' ? 'elevated' : 'watch');

        return {
          id: alertId,
          patientId: p.id,
          patientName: p.name || p.id,
          zone,
          redSource,
          p50,
          scoreDay,
          approxRisk,
          zoneRationale,
          severity,
          title: `Triage Zone: ${zone.toUpperCase()}${redSource ? ` (${redSource})` : ''}`,
          description: `${approxRisk}${scoreDay != null ? ` at day ${scoreDay}` : ''}. ${zoneRationale}`,
          timestamp: scoreDay != null ? `Day ${scoreDay}` : 'Recent',
          isRead: this.readAlertIds ? this.readAlertIds.has(alertId) : false,
          isSimulated: false
        };
      });
    }

    return this.alerts.map(a => ({
      ...a,
      isRead: this.readAlertIds ? this.readAlertIds.has(a.id) : false,
      isSimulated: true
    }));
  }

  getUnreadAlertCount() {
    if (this.source === 'live') {
      if (this.liveAlerts && this.liveAlerts.length > 0) {
        return this.liveAlerts.filter(a => !a.read).length;
      }
      return this.getAlerts().filter(a => !a.isRead).length;
    }
    // C3: Offline mode keeps the mock alerts tagged DEMO DATA, with badge 0
    return 0;
  }

  markAlertAsRead(alertId) {
    if (this.source === 'live') {
      apiMarkAlertRead(alertId).catch(err => {
        console.error('Failed to mark alert read on backend:', err);
      });
      this.liveAlerts = this.liveAlerts.map(a => 
        a.id === alertId ? { ...a, read: 1 } : a
      );
      return this.getAlerts();
    }

    if (!this.readAlertIds) this.readAlertIds = new Set();
    this.readAlertIds.add(alertId);
    this.alerts = this.alerts.map(a => a.id === alertId ? { ...a, isRead: true } : a);
    return this.getAlerts();
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
