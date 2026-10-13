/**
 * Shared formatting utilities for clinical risk and vital metrics.
 * Ensures consistent, null-safe, and truthful presentation across all views.
 */

export function formatRisk(p50) {
  if (p50 === null || p50 === undefined || isNaN(p50)) {
    return "-";
  }
  const pct = Math.round(p50 * 100);
  return `~${pct}% 7-day readmission risk (approx.)`;
}

export function formatRiskPercentage(p50) {
  if (p50 === null || p50 === undefined || isNaN(p50)) {
    return "-";
  }
  return `~${Math.round(p50 * 100)}%`;
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
    formatValue: () => "Static EHR profile"
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
