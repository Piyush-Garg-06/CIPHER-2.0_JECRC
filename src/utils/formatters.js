/**
 * Shared formatting utilities for clinical risk and vital metrics.
 * Ensures consistent, null-safe, and truthful presentation across all views.
 */

export const RISK_LIMITATION_TOOLTIP = "Synthetic decline before an event is stronger than in real life, so predictions above 50% can occur.";

export function isOverFifty(p50) {
  if (p50 === null || p50 === undefined || p50 === "" || isNaN(p50)) {
    return false;
  }
  return Number(p50) >= 0.5;
}

export function getRiskTooltip(p50, modelCard = null) {
  if (isOverFifty(p50)) {
    if (modelCard?.limitations && Array.isArray(modelCard.limitations)) {
      const match = modelCard.limitations.find(l => typeof l === 'string' && l.includes("predictions above 50%"));
      if (match) return match;
    }
    return RISK_LIMITATION_TOOLTIP;
  }
  return null;
}

export function formatRisk(p50) {
  if (p50 === null || p50 === undefined || p50 === "" || isNaN(p50)) {
    return "-";
  }
  const val = Number(p50);
  if (isOverFifty(val)) {
    return "over 50% (approx.)";
  }
  const pct = Math.round(val * 100);
  return `~${pct}% 7-day readmission risk (approx.)`;
}

export function formatRiskPercentage(p50) {
  if (p50 === null || p50 === undefined || p50 === "" || isNaN(p50)) {
    return "-";
  }
  const val = Number(p50);
  if (isOverFifty(val)) {
    return "over 50% (approx.)";
  }
  return `~${Math.round(val * 100)}%`;
}

export function formatTimeAgo(isoString, now = Date.now()) {
  if (!isoString) return null;
  const timestamp = new Date(isoString).getTime();
  if (isNaN(timestamp)) return null;
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) {
    return remMinutes > 0 ? `${hours}h ${remMinutes}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
}

export function formatVitalValue(val, unit = "") {
  if (val === null || val === undefined || val === "" || isNaN(val)) {
    return "-";
  }
  return unit ? `${val} ${unit}` : val;
}

export const DRIVER_FEATURE_CONFIG = {
  steps_ratio_3d_mean: {
    label: "Steps ratio",
    formatValue: (raw) => raw !== null && raw !== undefined ? `${Math.round(raw * 100)}% of own baseline` : "-"
  },
  hr_above_baseline_3d_mean: {
    label: "HR above baseline",
    formatValue: (raw) => raw !== null && raw !== undefined ? `${raw >= 0 ? '+' : ''}${Math.round(raw)} bpm` : "-"
  },
  d_t: {
    label: "Recovery index (lower = worse)",
    formatValue: (raw) => raw !== null && raw !== undefined ? `${Number(raw).toFixed(2)}` : "-"
  },
  missed_meds_last_7d: {
    label: "Missed medication days",
    formatValue: (raw) => raw !== null && raw !== undefined ? `${Math.round(raw)} days` : "-"
  },
  sleep_hours_3d_mean: {
    label: "Sleep hours",
    formatValue: (raw) => raw !== null && raw !== undefined ? `${Number(raw).toFixed(1)} hrs` : "-"
  },
  rehab_attended_last_7d: {
    label: "Rehab sessions",
    formatValue: (raw) => raw !== null && raw !== undefined ? `${Math.round(raw)} sessions` : "-"
  },
  baseline_clinical_profile: {
    label: "Baseline clinical profile",
    formatValue: () => "Static profile (demo)"
  }
};

export function getDriverLabel(feature) {
  return DRIVER_FEATURE_CONFIG[feature]?.label || feature;
}

export function formatDriverValue(feature, rawValue) {
  const config = DRIVER_FEATURE_CONFIG[feature];
  if (config && config.formatValue) {
    return config.formatValue(rawValue);
  }
  return rawValue !== null && rawValue !== undefined ? String(rawValue) : "-";
}

export function calcSliderPosition(vital, value) {
  if (value === null || value === undefined || isNaN(value)) {
    return null;
  }
  const num = Number(value);
  let min = 0, max = 100;
  switch (vital) {
    case 'restingHR':
      min = 40; max = 140; break;
    case 'hrv':
      min = 10; max = 100; break;
    case 'bloodPressure':
    case 'bpSys':
      min = 90; max = 180; break;
    case 'steps':
    case 'dailySteps':
      min = 0; max = 12000; break;
    default:
      return null;
  }
  const pct = ((num - min) / (max - min)) * 100;
  return Math.min(Math.max(pct, 0), 100);
}

