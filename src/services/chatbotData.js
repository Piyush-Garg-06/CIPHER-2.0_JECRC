/**
 * Scripted, deterministic clinical data assistant.
 * NOT an LLM. NOT medical advice.
 * Pure keyword/regex intent router evaluated in strict priority order.
 */

import { formatRisk, getDriverLabel, formatDriverValue } from '../utils/formatters.js';
import { getWhatIf } from './api.js';

export const INITIAL_CHAT_MESSAGES = [
  {
    id: "msg-1",
    sender: "bot",
    timestamp: "Just now",
    text: "Scripted assistant. It answers questions about this app, this patient's own data, and what-if scenarios. No medical advice. Not connected to a language model."
  }
];

export const SUGGESTED_PROMPTS = [
  "What is my current zone?",
  "Show my last 7 days",
  "What are the main drivers of my score?",
  "What does the next 7 days look like if the trend continues?",
  "What if my steps return to my baseline?",
  "How accurate is this model?",
  "What does Watch mean?"
];

export const SCENARIO_CHIPS = [
  { label: "Steps back to my baseline", query: "what if my steps return to my baseline" },
  { label: "Sleep 8 hours", query: "what if sleep 8 hours" },
  { label: "HR 5 bpm below baseline", query: "what if resting hr is 5 bpm below baseline" },
  { label: "HR 5 bpm above baseline", query: "what if resting hr is 5 bpm above baseline" },
  { label: "No missed medication days", query: "what if no missed medication days" },
  { label: "Recovery index set to +1", query: "what if recovery index set to +1" }
];

export const GLOSSARY = {
  "zone": "A triage level assigned by the app based on 2 consecutive days above score cutoffs or an acute red-flag symptom.",
  "green": "Green zone indicates the patient is in stable recovery with risk scores below the yellow alert threshold.",
  "watch": "Watch is an informational state where the risk score is elevated for a single day, awaiting confirmation before an alert.",
  "yellow": "Yellow zone signifies elevated risk where scores have exceeded the yellow cutoff across 2 consecutive days.",
  "red": "Red zone indicates critical deterioration confirmed by 2 consecutive days above red cutoff or an acute symptom flag.",
  "red source": "Red source indicates whether Red triage was triggered by the model score ('model'), acute red flag ('symptom'), or both.",
  "approx risk": "Approximate readmission risk is the model's calibrated probability of a readmission event occurring within 7 days.",
  "7-day risk": "The probability that a readmission event will occur within the next 7 calendar days.",
  "baseline": "Personal physiological baseline established from the first 3 valid days of resting HR, HRV, and daily step telemetry.",
  "resting hr": "Resting heart rate in beats per minute, recorded during periods of rest or nocturnal monitoring.",
  "hrv": "Heart rate variability (rMSSD in milliseconds), measuring beat-to-beat variations reflecting autonomic recovery balance.",
  "steps ratio": "Daily step count expressed as a ratio relative to the patient's personalized baseline step count.",
  "recovery index": "Recovery index (d_t) estimates physiological divergence from baseline, where lower values indicate worse autonomic strain.",
  "d_t": "Recovery index (d_t) estimates physiological divergence from baseline, where lower values indicate worse autonomic strain.",
  "drift": "The rate at which recovery index (d_t) is moving over time across daily wearable observations.",
  "stale data": "Indicates no new telemetry readings have been received for 3 or more calendar days; predictions are held frozen.",
  "band": "The projection cone reflecting Kalman filter uncertainty bounds (P10 to P90) under current trend continuation.",
  "uncertainty": "Uncertainty reflects Kalman filter estimation bounds and is not a validated confidence interval for event timing.",
  "scenario": "A hypothetical what-if calculation where selected measures are changed and all others held fixed.",
  "what-if": "A hypothetical scenario calculation testing how risk scores change if specific measures are altered.",
  "demo data": "Synthetic demonstration data used for illustration purposes when not connected to a live hospital database.",
  "live api": "The active server connection providing continuous calibrated digital twin scoring and telemetry ingestion."
};

const EMERGENCY_WORDS = [
  "chest pain", "can't breathe", "cant breathe", "short of breath",
  "shortness of breath", "faint", "fainting", "unconscious",
  "heart attack", "stroke", "severe pain", "bleeding", "emergency",
  "dizzy", "feel unwell", "feeling sick"
];

const MEDICAL_ADVICE_WORDS = [
  "medication", "medicine", "drug", "dose", "dosage", "tablet", "pill",
  "side effect", "statin", "aspirin", "beta blocker", "amlodipine",
  "atorvastatin", "coq10", "metoprolol", "lisinopril", "clopidogrel",
  "warfarin", "apixaban", "treatment", "treat", "cure", "diagnose",
  "diagnosis", "prescription", "diet", "food", "eat", "supplement",
  "should i", "can i take", "is it safe", "what should i do",
  "exercise plan", "how much exercise", "recover faster", "am i going to",
  "will i die", "will i be readmitted"
];

const WHAT_IF_TRIGGERS = [
  "what if", "if my", "suppose", "scenario", "simulate", "what would happen"
];

function matchWordBoundary(text, term) {
  if (!text || !term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

export function parseWhatIfOverrides(text, patient) {
  const q = text.toLowerCase();
  const overrides = {};
  const twin = patient?.twinState || {};

  // 1. Steps
  if (q.includes("return to my baseline") || q.includes("back to my baseline") || q.includes("baseline steps")) {
    overrides.stepsRatio = 1.0;
  } else {
    const stepsRatioMatch = q.match(/steps\s*(?:ratio)?\s*(?:to|is|were|=)?\s*([0-9.]+)(?:%|x)?/);
    if (stepsRatioMatch) {
      const val = parseFloat(stepsRatioMatch[1]);
      if (q.includes("%") || val > 2.0 && val <= 200.0) {
        overrides.stepsRatio = Math.min(Math.max(val / 100.0, 0.0), 2.0);
      } else if (val <= 2.0) {
        overrides.stepsRatio = Math.min(Math.max(val, 0.0), 2.0);
      } else if (twin.steps0 && twin.steps0 > 0) {
        overrides.stepsRatio = Math.min(Math.max(Number((val / twin.steps0).toFixed(2)), 0.0), 2.0);
      }
    } else {
      const absStepsMatch = q.match(/steps\s*(?:were|to|is|=)?\s*(\d{3,5})/);
      if (absStepsMatch) {
        const absVal = parseInt(absStepsMatch[1], 10);
        const baselineSteps = twin.steps0 || 5000;
        overrides.stepsRatio = Math.min(Math.max(Number((absVal / baselineSteps).toFixed(2)), 0.0), 2.0);
      }
    }
  }

  // 2. Sleep hours
  const sleepMatch = q.match(/sleep\s*(?:hours|hrs|to|is|=)?\s*([0-9.]+)\s*(?:hours|hrs|h)?/);
  if (sleepMatch) {
    const sVal = parseFloat(sleepMatch[1]);
    if (sVal >= 0 && sVal <= 14) {
      overrides.sleepHours = sVal;
    }
  }

  // 3. Resting HR
  const hrLowerMatch = q.match(/(?:resting\s*)?hr\s*(?:is|were|=|set to)?\s*(\d+)\s*bpm\s*(?:lower|below(?: baseline)?)/);
  const hrHigherMatch = q.match(/(?:resting\s*)?hr\s*(?:is|were|=|set to)?\s*(\d+)\s*bpm\s*(?:higher|above(?: baseline)?)/);
  if (hrLowerMatch) {
    const diff = parseFloat(hrLowerMatch[1]);
    overrides.hrAboveBaseline = Math.max(-15.0, -diff);
  } else if (hrHigherMatch) {
    const diff = parseFloat(hrHigherMatch[1]);
    overrides.hrAboveBaseline = Math.min(30.0, diff);
  }

  // 4. Recovery index
  const recoveryMatch = q.match(/recovery\s*(?:index)?\s*(?:is|to|set to|\+|=)?\s*([+-]?[0-9.]+)/);
  if (recoveryMatch) {
    const rVal = parseFloat(recoveryMatch[1]);
    if (rVal >= -6.0 && rVal <= 3.0) {
      overrides.recoveryIndex = rVal;
    }
  }

  // 5. Missed medication days
  if (q.includes("no missed medication days") || q.includes("0 missed meds") || q.includes("zero missed meds")) {
    overrides.missedMeds7d = 0;
  } else {
    const medsMatch = q.match(/missed\s*(\d+)\s*(?:med|medication|day)/);
    if (medsMatch) {
      const mVal = parseInt(medsMatch[1], 10);
      if (mVal >= 0 && mVal <= 7) {
        overrides.missedMeds7d = mVal;
      }
    }
  }

  // 6. Rehab sessions
  const rehabMatch = q.match(/rehab\s*(?:sessions)?\s*(?:is|to|=)?\s*(\d+)/) || q.match(/attended\s*(\d+)\s*rehab/);
  if (rehabMatch) {
    const rhVal = parseInt(rehabMatch[1], 10);
    if (rhVal >= 0 && rhVal <= 7) {
      overrides.rehabSessions7d = rhVal;
    }
  }

  return overrides;
}

function describeAppliedOverride(k, v, patient) {
  const ts = patient?.twinState;
  const vitals = patient?.vitals || {};
  let appliedDesc = `${k}: ${v}`;
  let isSame = false;

  if (k === 'hrAboveBaseline') {
    const driver = ts?.drivers?.find(d => d.feature === 'hr_above_baseline_3d_mean' || d.feature?.includes('hr_above_baseline'));
    let todayVal = driver?.rawValue != null ? Math.round(driver.rawValue) : null;
    if (todayVal == null && vitals.restingHR != null && ts?.hr0 != null) {
      todayVal = Math.round(vitals.restingHR - ts.hr0);
    }
    const todaySign = (todayVal != null && todayVal >= 0) ? '+' : '';
    const todayStr = todayVal != null ? `${todaySign}${todayVal}` : 'n/a';

    if (v < 0) {
      appliedDesc = `Resting HR set to ${Math.abs(v)} bpm below baseline (today: ${todayStr})`;
    } else if (v > 0) {
      appliedDesc = `Resting HR set to ${v} bpm above baseline (today: ${todayStr})`;
    } else {
      appliedDesc = `Resting HR set to baseline (today: ${todayStr})`;
    }
    if (todayVal != null && v === todayVal) {
      isSame = true;
    }
  } else if (k === 'stepsRatio') {
    const driver = ts?.drivers?.find(d => d.feature === 'steps_ratio_3d_mean' || d.feature?.includes('steps_ratio'));
    let todayRatio = driver?.rawValue != null ? driver.rawValue : null;
    if (todayRatio == null && vitals.dailySteps != null && ts?.steps0 != null && ts.steps0 > 0) {
      todayRatio = Number((vitals.dailySteps / ts.steps0).toFixed(2));
    }
    const todayPct = todayRatio != null ? `${Math.round(todayRatio * 100)}%` : 'n/a';
    if (v === 1.0) {
      appliedDesc = `Steps set to baseline (today: ${todayPct})`;
    } else {
      appliedDesc = `Steps set to ${Math.round(v * 100)}% of baseline (today: ${todayPct})`;
    }
    if (todayRatio != null && Math.abs(v - todayRatio) < 0.02) {
      isSame = true;
    }
  } else if (k === 'sleepHours') {
    const todaySleep = vitals.sleepHours ?? ts?.drivers?.find(d => d.feature?.includes('sleep'))?.rawValue;
    const todayStr = todaySleep != null ? `${todaySleep}h` : 'n/a';
    appliedDesc = `Sleep hours set to ${v}h (today: ${todayStr})`;
    if (todaySleep != null && Math.abs(v - todaySleep) < 0.1) {
      isSame = true;
    }
  } else if (k === 'recoveryIndex') {
    const driver = ts?.drivers?.find(d => d.feature === 'd_t' || d.feature?.includes('recovery'));
    const todayRec = driver?.rawValue;
    const todayStr = todayRec != null ? (todayRec >= 0 ? `+${todayRec}` : `${todayRec}`) : 'n/a';
    const vStr = v >= 0 ? `+${v}` : `${v}`;
    appliedDesc = `Recovery index set to ${vStr} (today: ${todayStr})`;
    if (todayRec != null && Math.abs(v - todayRec) < 0.05) {
      isSame = true;
    }
  } else if (k === 'missedMeds7d') {
    const driver = ts?.drivers?.find(d => d.feature === 'missed_meds_last_7d' || d.feature?.includes('missed_meds'));
    const todayMeds = driver?.rawValue != null ? Math.round(driver.rawValue) : 0;
    appliedDesc = `Missed medication days set to ${v} (today: ${todayMeds})`;
    if (todayMeds != null && v === todayMeds) {
      isSame = true;
    }
  } else if (k === 'rehabSessions7d') {
    const driver = ts?.drivers?.find(d => d.feature?.includes('rehab'));
    const todayRehab = driver?.rawValue != null ? Math.round(driver.rawValue) : null;
    appliedDesc = `Rehab sessions set to ${v} (today: ${todayRehab != null ? todayRehab : 'n/a'})`;
    if (todayRehab != null && v === todayRehab) {
      isSame = true;
    }
  }

  return { appliedDesc, isSame };
}

export async function generateChatbotResponse(question, patient, modelCard = null) {
  const q = (question || "").toLowerCase().trim();

  // PRIORITY 1: EMERGENCY / SYMPTOM
  for (const term of EMERGENCY_WORDS) {
    if (matchWordBoundary(q, term)) {
      return {
        text: "I can't assess symptoms. If you think this may be an emergency, contact your local emergency number now. For anything else, contact your care team.",
        intent: "emergency"
      };
    }
  }

  // PRIORITY 2: MEDICAL ADVICE / TOPICS
  const isWhatIfTrigger = WHAT_IF_TRIGGERS.some(trigger => matchWordBoundary(q, trigger));
  const isMissedMedsParam = matchWordBoundary(q, "missed med") || matchWordBoundary(q, "missed medication") || matchWordBoundary(q, "no missed med");

  for (const term of MEDICAL_ADVICE_WORDS) {
    if (matchWordBoundary(q, term)) {
      if ((term === "medication" || term === "medicine") && (isWhatIfTrigger || isMissedMedsParam)) {
        continue;
      }
      return {
        text: "I can't help with medical questions, medications or treatment. Please contact your care team. I can show your recorded data, explain terms used in this app, or run a what-if scenario.",
        intent: "medical_refusal"
      };
    }
  }

  // PRIORITY 3: WHAT-IF
  if (isWhatIfTrigger) {
    const overrides = parseWhatIfOverrides(q, patient);
    const hasKeys = Object.keys(overrides).length > 0;

    if (!hasKeys) {
      return {
        text: "I couldn't parse specific scenario values from your request. You can choose one of the scenario chips below or specify values (e.g. 'What if sleep 8 hours' or 'What if my steps return to my baseline'):",
        showChips: true,
        intent: "what_if_unparsed"
      };
    }

    try {
      const result = await getWhatIf(patient.id, overrides);
      const basePct = Math.round(result.baselineP50 * 100);
      const scenPct = Math.round(result.scenarioP50 * 100);

      const yCutoffPct = modelCard?.yellowCutoff != null ? `${(modelCard.yellowCutoff * 100).toFixed(1)}%` : null;
      const rCutoffPct = modelCard?.redCutoff != null ? `${(modelCard.redCutoff * 100).toFixed(1)}%` : null;

      const cutoffStatus = result.scenarioAtOrAboveRedCutoff
        ? (rCutoffPct ? `At or above Red score cutoff (${rCutoffPct})` : "At or above Red score cutoff")
        : result.scenarioAtOrAboveYellowCutoff
        ? (yCutoffPct ? `At or above Yellow score cutoff (${yCutoffPct})` : "At or above Yellow score cutoff")
        : (yCutoffPct ? `Below Yellow score cutoff (${yCutoffPct})` : "Below Yellow score cutoff");

      const appliedDescs = [];
      let anySame = false;
      for (const [k, v] of Object.entries(result.appliedOverrides)) {
        const { appliedDesc, isSame } = describeAppliedOverride(k, v, patient);
        appliedDescs.push(appliedDesc);
        if (isSame) anySame = true;
      }
      if (Math.abs(result.baselineP50 - result.scenarioP50) < 0.0001 && result.deltaLogOdds === 0) {
        anySame = true;
      }

      const sameNotice = anySame ? " No change: this value is already the same as today's." : "";

      return {
        text: `Scenario values applied: ${appliedDescs.join("; ")}.${sameNotice}\n` +
              `Approximate 7-day risk: ~${basePct}% -> ~${scenPct}%.\n` +
              `Score status: ${cutoffStatus}.\n\n` +
              `${result.note}`,
        intent: "what_if_success",
        data: result
      };
    } catch (err) {
      return {
        text: `Unable to calculate scenario: ${err.message || 'conflict or uncalibrated data'}.`,
        intent: "what_if_error"
      };
    }
  }

  // PRIORITY 4: MODEL INFO (Checked before generic "my" keyword in patient stats)
  const MODEL_KEYWORDS = [
    "accurate", "accuracy", "how good", "trust", "reliable", "auc",
    "false alarm", "false alarms", "precision", "synthetic", "limitations", "limitation"
  ];
  if (MODEL_KEYWORDS.some(k => matchWordBoundary(q, k))) {
    if (!modelCard || !modelCard.rocAuc) {
      return {
        text: "Model information is not available right now.",
        intent: "model_info"
      };
    }

    const rocAuc = `${(modelCard.rocAuc.mean * 100).toFixed(1)}% (95% CI: [${(modelCard.rocAuc.ci[0] * 100).toFixed(1)}%, ${(modelCard.rocAuc.ci[1] * 100).toFixed(1)}%])`;
    const yellowCatch = modelCard.yellowCatchRate ? `${modelCard.yellowCatchRate.rate}%` : "not available";
    const redCatch = modelCard.modelRedCatchRate ? `${modelCard.modelRedCatchRate.rate}%` : "not available";
    const epPrec = modelCard.episodePrecision?.yellow?.false_alarms_per_true != null
      ? `${modelCard.episodePrecision.yellow.false_alarms_per_true} false alarms per true catch`
      : "not available";
    const calibNote = modelCard.calibrationNote || "Show zones; show percentages as approximate.";
    const lims = Array.isArray(modelCard.limitations)
      ? modelCard.limitations.slice(0, 3).join("; ")
      : "Fully synthetic data; no real-world validation";

    return {
      text: `Model performance (synthetic data only): AUC-ROC is ${rocAuc}. Yellow catch rate: ${yellowCatch}, Red catch rate: ${redCatch}. For Yellow alerts, there are ${epPrec}. Calibration note: ${calibNote}. Limitations: ${lims}. Synthetic data only.`,
      intent: "model_info"
    };
  }

  // PRIORITY 5: PATIENT STATS (Live data only)
  const isGlossaryQuestion = matchWordBoundary(q, "mean") || matchWordBoundary(q, "meaning") || matchWordBoundary(q, "define") || matchWordBoundary(q, "definition") || matchWordBoundary(q, "explain") || (q.startsWith("what is ") && !q.includes("my") && !q.includes("patient"));

  const STATS_KEYWORDS = [
    "my", "stats", "latest", "today", "steps", "sleep", "hrv", "heart rate",
    "spo2", "oxygen", "blood pressure", "baseline", "week", "why", "drivers", "forecast", "trajectory", "next 7 days",
    "trend", "last reading", "data age"
  ];
  const isOwnStatus = q.includes("my zone") || q.includes("current zone") || q.includes("my risk") || q.includes("my score") || q.includes("today's score") || q.includes("score rationale") || q.includes("zone rationale");
  const isStats = !isGlossaryQuestion && (STATS_KEYWORDS.some(k => matchWordBoundary(q, k)) || isOwnStatus || (matchWordBoundary(q, "zone") && !isGlossaryQuestion));

  if (isStats) {
    if (patient?.isSimulated) {
      return {
        text: "Patient data answers need the live API.",
        intent: "stats_offline"
      };
    }

    const ts = patient?.twinState;

    // A. Why / Drivers
    if (matchWordBoundary(q, "why") || matchWordBoundary(q, "driver") || matchWordBoundary(q, "drivers")) {
      const drivers = ts?.drivers;
      const driversNote = ts?.driversNote || "";
      if (Array.isArray(drivers) && drivers.length > 0) {
        const rows = drivers.map(d => {
          const label = getDriverLabel(d.feature);
          const sign = d.logitContribution >= 0 ? "+" : "";
          const valStr = formatDriverValue(d.feature, d.rawValue);
          return `• ${label}: ${sign}${d.logitContribution.toFixed(3)} log-odds (${valStr})`;
        }).join("\n");
        return {
          text: `Main drivers of your score (in log-odds):\n${rows}\n\n${driversNote}`,
          intent: "drivers"
        };
      }
      return { text: "No driver breakdown available for this record.", intent: "drivers_unavailable" };
    }

    // B. Forecast / Next 7 days / Trajectory
    if (matchWordBoundary(q, "forecast") || matchWordBoundary(q, "next 7 days") || matchWordBoundary(q, "trajectory")) {
      const cone = ts?.forwardCone;
      if (Array.isArray(cone) && cone.length > 0) {
        const pStart = Math.round((ts?.p50 ?? cone[0].p50) * 100);
        const pEnd = Math.round(cone[cone.length - 1].p50 * 100);
        return {
          text: `If the current trend continues, the score would move from ~${pStart}% to ~${pEnd}% over 7 days. Scenario only; the band reflects filter uncertainty and is not validated.`,
          intent: "forecast"
        };
      }
      return { text: "No forward projection cone available for this record.", intent: "forecast_unavailable" };
    }

    // C. Last 7 days / Week
    if (matchWordBoundary(q, "last 7 days") || matchWordBoundary(q, "week")) {
      const recent = ts?.recentReadings;
      if (Array.isArray(recent) && recent.length > 0) {
        const tableRows = recent.map(r => {
          const hr = r.restingHR !== null && r.restingHR !== undefined ? `${r.restingHR} bpm` : "no reading";
          const hrv = r.hrv !== null && r.hrv !== undefined ? `${r.hrv} ms` : "no reading";
          const st = r.steps !== null && r.steps !== undefined ? `${r.steps}` : "no reading";
          const sl = r.sleepHours !== null && r.sleepHours !== undefined ? `${r.sleepHours}h` : "no reading";
          const ox = r.spo2 !== null && r.spo2 !== undefined ? `${r.spo2}%` : "no reading";
          const bp = (r.bpSys !== null && r.bpDia !== null && r.bpSys !== undefined && r.bpDia !== undefined) ? `${r.bpSys}/${r.bpDia}` : "no reading";
          return `Day ${r.day}: HR ${hr} | HRV ${hrv} | Steps ${st} | Sleep ${sl} | SpO2 ${ox} | BP ${bp}`;
        }).join("\n");
        return {
          text: `Last 7 calendar days telemetry:\n${tableRows}`,
          intent: "recent_readings"
        };
      }
      return { text: "No recent readings recorded.", intent: "recent_unavailable" };
    }

    // D. Current Zone / Risk / Score
    if (matchWordBoundary(q, "zone") || matchWordBoundary(q, "risk") || matchWordBoundary(q, "score")) {
      const zoneStr = ts?.triageZone ? ts.triageZone.toUpperCase() : "NOT CALIBRATED";
      const watchStr = ts?.watch ? "Yes" : "No";
      const p50Val = ts?.p50 ?? patient?.riskScore;
      const approxRisk = p50Val != null ? `~${Math.round(p50Val * 100)}%` : "-";
      return {
        text: `Current zone: ${zoneStr} (Watch: ${watchStr}). Approx. risk: ${approxRisk}.`,
        intent: "zone_status"
      };
    }

    // E. Data Age / Stale
    if (matchWordBoundary(q, "data age") || matchWordBoundary(q, "stale") || matchWordBoundary(q, "age")) {
      const sDay = ts?.scoreDay !== null && ts?.scoreDay !== undefined ? `Day ${ts.scoreDay}` : "not available";
      const age = ts?.dataAgeDays !== null && ts?.dataAgeDays !== undefined ? `${ts.dataAgeDays} day(s)` : "not available";
      const staleText = ts?.staleData ? "Stale data: telemetry is >= 3 days old; scores are held frozen." : "Telemetry data is active and up to date.";
      return {
        text: `Latest score day: ${sDay}. Data age: ${age}. ${staleText}`,
        intent: "data_age"
      };
    }

    // F. Latest vitals compared numerically to personal baseline
    const v = patient?.vitals || {};
    const hr0 = ts?.hr0 !== null && ts?.hr0 !== undefined ? ts.hr0 : null;
    const hrv0 = ts?.hrv0 !== null && ts?.hrv0 !== undefined ? ts.hrv0 : null;
    const steps0 = ts?.steps0 !== null && ts?.steps0 !== undefined ? ts.steps0 : null;

    const hrDiff = (v.restingHR !== null && v.restingHR !== undefined && hr0 !== null)
      ? `${v.restingHR - hr0 >= 0 ? '+' : ''}${Math.round(v.restingHR - hr0)}`
      : "n/a";
    const hrvDiff = (v.hrv !== null && v.hrv !== undefined && hrv0 !== null)
      ? `${v.hrv - hrv0 >= 0 ? '+' : ''}${Math.round(v.hrv - hrv0)}`
      : "n/a";
    const stepsDiff = (v.dailySteps !== null && v.dailySteps !== undefined && steps0 !== null)
      ? `${v.dailySteps - steps0 >= 0 ? '+' : ''}${Math.round(v.dailySteps - steps0)}`
      : "n/a";

    const hrText = v.restingHR !== null && v.restingHR !== undefined
      ? `Resting HR ${v.restingHR} bpm (your baseline ${hr0 !== null ? Math.round(hr0) : 'n/a'} bpm, ${hrDiff})`
      : "Resting HR not available";
    const hrvText = v.hrv !== null && v.hrv !== undefined
      ? `HRV ${v.hrv} ms (your baseline ${hrv0 !== null ? Math.round(hrv0) : 'n/a'} ms, ${hrvDiff})`
      : "HRV not available";
    const stepsText = v.dailySteps !== null && v.dailySteps !== undefined
      ? `Steps ${v.dailySteps} (your baseline ${steps0 !== null ? Math.round(steps0) : 'n/a'}, ${stepsDiff})`
      : "Steps not available";
    const sDay = ts?.scoreDay !== null && ts?.scoreDay !== undefined ? `Day ${ts.scoreDay}` : "Latest day";

    return {
      text: `Recorded readings for ${sDay}: ${hrText}. ${hrvText}. ${stepsText}.`,
      intent: "vitals_baseline"
    };
  }

  // PRIORITY 6: GLOSSARY
  const sortedGlossaryTerms = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  for (const term of sortedGlossaryTerms) {
    if (matchWordBoundary(q, term)) {
      return {
        text: `${term.toUpperCase()}: ${GLOSSARY[term]}`,
        intent: "glossary"
      };
    }
  }

  // PRIORITY 7: GREETING / HELP / ANYTHING ELSE
  return {
    text: "I am a scripted, data-only assistant. I can show recorded telemetry from this app, explain terms, or run a what-if scenario. Example questions you can ask:\n" +
          "1. What is my current zone?\n" +
          "2. Show my last 7 days\n" +
          "3. What if my steps return to my baseline?\n" +
          "4. How accurate is this model?",
    intent: "help"
  };
}
