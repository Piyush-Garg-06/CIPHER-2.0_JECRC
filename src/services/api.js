/**
 * Minimal API client for Digital Twin Core API per PART C0.
 * Base URL configured via VITE_API_URL (default: http://localhost:8000).
 */

const API_BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:8000';

export async function getPatients() {
  const response = await fetch(`${API_BASE_URL}/api/v2/patients`);
  if (!response.ok) {
    throw new Error(`Failed to fetch patients: ${response.status}`);
  }
  return response.json();
}

export async function getTwin(patientId) {
  const response = await fetch(`${API_BASE_URL}/api/v2/patients/${patientId}/twin`);
  if (!response.ok) {
    throw new Error(`Failed to fetch twin for patient ${patientId}: ${response.status}`);
  }
  return response.json();
}

export async function getModelCard() {
  const response = await fetch(`${API_BASE_URL}/api/model-card`);
  if (!response.ok) {
    throw new Error(`Failed to fetch model card: ${response.status}`);
  }
  return response.json();
}

export async function getWhatIf(patientId, overrides) {
  const response = await fetch(`${API_BASE_URL}/api/v2/patients/${patientId}/what-if`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ overrides })
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to run what-if simulation: ${response.status}`);
  }
  return response.json();
}

export async function getAlerts(unreadOnly = false) {
  const url = `${API_BASE_URL}/api/v2/alerts${unreadOnly ? '?unread=true' : ''}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts: ${response.status}`);
  }
  return response.json();
}

export async function getAlertsSummary() {
  const response = await fetch(`${API_BASE_URL}/api/v2/alerts/summary`);
  if (!response.ok) {
    throw new Error(`Failed to fetch alerts summary: ${response.status}`);
  }
  return response.json();
}

export async function markAlertAsRead(alertId) {
  const response = await fetch(`${API_BASE_URL}/api/v2/alerts/${alertId}/read`, {
    method: 'PATCH'
  });
  if (!response.ok) {
    throw new Error(`Failed to mark alert read: ${response.status}`);
  }
  return response.json();
}

export async function markAllAlertsRead(patientId) {
  const url = `${API_BASE_URL}/api/v2/alerts/read-all${patientId ? `?patient_id=${encodeURIComponent(patientId)}` : ''}`;
  const response = await fetch(url, {
    method: 'POST'
  });
  if (!response.ok) {
    throw new Error(`Failed to mark all alerts read: ${response.status}`);
  }
  return response.json();
}

export async function getSimStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/sim/status`);
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // Treat as not running without error noise
  }
  return null;
}

export default {
  getPatients,
  getTwin,
  getModelCard,
  getWhatIf,
  getAlerts,
  markAlertAsRead,
  getSimStatus
};
