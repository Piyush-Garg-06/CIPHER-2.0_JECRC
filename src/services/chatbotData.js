/**
 * Scripted, deterministic clinical data assistant.
 * NOT an LLM. NOT medical advice.
 * Pure keyword/regex intent router evaluated in strict priority order.
 */

import { formatRisk, formatRiskPercentage, getDriverLabel, formatDriverValue } from '../utils/formatters.js';
import { getWhatIf } from './api.js';
import { isPatientStale } from './patientService.js';

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
  "approx risk": "Approximate cardiovascular risk is the model's calibrated probability of a high-risk event occurring within 7 days.",
  "7-day risk": "The probability that a high-risk event will occur within the next 7 calendar days.",
  "baseline": "Personal physiological baseline established from the first 3 valid days of resting HR, HRV, and daily step telemetry.",
  "resting hr": "Resting heart rate in beats per minute, recorded during periods of rest or nocturnal monitoring.",
  "hrv": "Heart rate variability (rMSSD in milliseconds), measuring beat-to-beat variations reflecting autonomic recovery balance.",
  "steps ratio": "Daily step count expressed as a ratio relative to the patient's personalized baseline step count.",
  "recovery index": "Recovery index (d_t) estimates physiological divergence from baseline, where lower values indicate worse autonomic strain.",
  "d_t": "Recovery index (d_t) estimates physiological divergence from baseline, where lower values indicate worse autonomic strain.",
  "drift": "The rate at which recovery index (d_t) is moving over time across daily wearable observations.",
  "stale data": "Indicates no readings for 3 or more days; predictions are held frozen.",
  "band": "The projection cone reflecting Kalman filter uncertainty bounds (P10 to P90) under current trend continuation.",
  "uncertainty": "Uncertainty reflects Kalman filter estimation bounds and is not a validated confidence interval for event timing.",
  "scenario": "A hypothetical what-if calculation where selected measures are changed and all others held fixed.",
  "what-if": "A hypothetical scenario calculation testing how risk scores change if specific measures are altered.",
  "demo data": "Synthetic demonstration data used for illustration purposes when not connected to a live hospital database.",
  "live api": "The active server connection providing streaming calibrated digital twin scoring and telemetry ingestion."
};

const EMERGENCY_PATTERNS = [
  /\bchest\s+pains?\b/i,
  /\bcan'?t\s+breathe?\b/i,
  /\bshort(?:ness)?\s+of\s+breath\b/i,
  /\bbreath/i,
  /\bfaint/i,
  /\bunconscious\b/i,
  /\bheart\s+attacks?\b/i,
  /\bstrokes?\b/i,
  /\bsevere\s+pains?\b/i,
  /\bbleed/i,
  /\bemergenc(?:y|ies)\b/i,
  /\bdizz/i,
  /\bfeel(?:ing)?\s+(?:unwell|sick)\b/i,
  /\barm\s+hurts?\b/i,
  /\barm\s+pains?\b/i,
  /\bjaw\s+pains?\b/i,
  /\bchest\s+tightness\b/i,
  /\bchest\s+pressure\b/i,
  /\bpressure\s+(?:in\s+)?(?:my\s+)?chest\b/i,
  /\bpalpitations?\b/i,
  /\bheart\s+racing\b/i,
  /\bnausea\b/i,
  /\bvomit(?:ing)?\b/i,
  /\bnumb(?:ness)?\b/i,
  /\bpassed\s+out\b/i,
  /\bblacked\s+out\b/i,
  /\bblackouts?\b/i,
  /\bswelling\b/i,
  /\bpains?\b/i,
  /\bhurts?\b/i,
  /\bach(?:e|es|ing)?\b/i,
  /\boverdose\b/i
];

const SELF_HARM_PATTERNS = [
  /\bsuicid/i,
  /\bkill\s+myself\b/i,
  /\bend\s+my\s+life\b/i,
  /\bself[-\s]?harm\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bwanna\s+die\b/i,
  /\bdon'?t\s+want\s+to\s+live\b/i,
  /\bdo\s+not\s+want\s+to\s+live\b/i,
  /\bkill\s+me\b/i,
  /\bend\s+it\s+all\b/i,
  /\bhurt\s+myself\b/i,
  /\bharm\s+myself\b/i,
  /\bno\s+reason\s+to\s+live\b/i
];

const MEDICAL_ADVICE_PATTERNS = [
  /\bmedicat/i,
  /\bmedicines?\b/i,
  /\bmeds?\b/i,
  /\bdrugs?\b/i,
  /\bdos(?:e|es|ing)?\b/i,
  /\bdosages?\b/i,
  /\btablets?\b/i,
  /\bpills?\b/i,
  /\bside\s+effects?\b/i,
  /\bstatins?\b/i,
  /\baspirins?\b/i,
  /\bbeta\s+blockers?\b/i,
  /\bamlodipine\b/i,
  /\batorvastatin\b/i,
  /\bcoq10\b/i,
  /\bmetoprolol\b/i,
  /\blisinopril\b/i,
  /\bclopidogrel\b/i,
  /\bwarfarin\b/i,
  /\bapixaban\b/i,
  /\btreatments?\b/i,
  /\btreat(?:s|ed|ing)?\b/i,
  /\bcures?\b/i,
  /\bdiagnos(?:e|es|ed|is|ing)?\b/i,
  /\bprescriptions?\b/i,
  /\bdiets?\b/i,
  /\bfoods?\b/i,
  /\b(?:eat|eating|eats)\b/i,
  /\bsupplements?\b/i,
  /\bshould\s+i\b/i,
  /\bcan\s+i\s+take\b/i,
  /\bis\s+it\s+safe\b/i,
  /\bwhat\s+should\s+i\s+do\b/i,
  /\bexercise\s+plan\b/i,
  /\bhow\s+much\s+exercise\b/i,
  /\brecover\s+faster\b/i,
  /\bam\s+i\s+going\s+to\b/i,
  /\bwill\s+i\s+die\b/i,
  /\bwill\s+i\s+be\s+readmitted\b/i
];

const WHAT_IF_TRIGGERS = [
  "what if", "if my", "suppose", "scenario", "simulate", "what would happen"
];

function normalizeText(text) {
  if (!text) return "";
  return text.replace(/[\u2018\u2019’‘`]/g, "'");
}

function matchWordBoundary(text, term) {
  if (!text || !term) return false;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`\\b${escaped}\\b`, 'i');
  return regex.test(text);
}

export function parseWhatIfOverrides(text, patient) {
  const norm = normalizeText(text);
  const q = norm.toLowerCase();
  const overrides = {};
  const meta = {};
  const twin = patient?.twinState || {};

  // 1. Steps
  if (q.includes("return to baseline") || q.includes("return to my baseline") || q.includes("back to baseline") || q.includes("back to my baseline") || q.includes("baseline steps")) {
    overrides.stepsRatio = 1.0;
  } else {
    const stepsRatioMatch = q.match(/steps\s*(?:ratio)?\s*(?:to|is|were|=)?\s*([0-9.]+)(?:%|x)?/);
    if (stepsRatioMatch) {
      const val = parseFloat(stepsRatioMatch[1]);
      if (q.includes("%") || (val > 2.0 && val <= 200.0)) {
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
  // Distinguish "below/above baseline" (absolute) vs "lower/higher" without baseline (relative to current)
  const hasBaselineInHr = q.includes("baseline");
  const hrLowerMatch = q.match(/(?:resting\s*)?hr\s*(?:is|were|=|set to)?\s*(\d+)\s*bpm\s*(?:lower|below)/i) ||
                       q.match(/(\d+)\s*bpm\s*(?:lower|below)/i);
  const hrHigherMatch = q.match(/(?:resting\s*)?hr\s*(?:is|were|=|set to)?\s*(\d+)\s*bpm\s*(?:higher|above)/i) ||
                        q.match(/(\d+)\s*bpm\s*(?:higher|above)/i);

  if (hrLowerMatch) {
    const amount = parseFloat(hrLowerMatch[1]);
    if (hasBaselineInHr || q.includes("below baseline")) {
      overrides.hrAboveBaseline = Math.max(-15.0, -amount);
      meta.hrAboveBaseline = { mode: 'absolute', amount, dir: 'below' };
    } else {
      // Relative to current value
      let currentVal = 0.0;
      const d = twin.drivers?.find(dr => dr.feature === 'hr_above_baseline_3d_mean' || dr.feature?.includes('hr_above_baseline'));
      if (d && d.rawValue != null) {
        currentVal = d.rawValue;
      } else if (patient?.currentValues?.hrAboveBaseline != null) {
        currentVal = patient.currentValues.hrAboveBaseline;
      } else if (patient?.vitals?.restingHR != null && twin.hr0 != null) {
        currentVal = patient.vitals.restingHR - twin.hr0;
      }
      const target = Math.min(30.0, Math.max(-15.0, Number((currentVal - amount).toFixed(1))));
      overrides.hrAboveBaseline = target;
      meta.hrAboveBaseline = { mode: 'relative', amount, dir: 'lower', currentVal, target };
    }
  } else if (hrHigherMatch) {
    const amount = parseFloat(hrHigherMatch[1]);
    if (hasBaselineInHr || q.includes("above baseline")) {
      overrides.hrAboveBaseline = Math.min(30.0, amount);
      meta.hrAboveBaseline = { mode: 'absolute', amount, dir: 'above' };
    } else {
      // Relative to current value
      let currentVal = 0.0;
      const d = twin.drivers?.find(dr => dr.feature === 'hr_above_baseline_3d_mean' || dr.feature?.includes('hr_above_baseline'));
      if (d && d.rawValue != null) {
        currentVal = d.rawValue;
      } else if (patient?.currentValues?.hrAboveBaseline != null) {
        currentVal = patient.currentValues.hrAboveBaseline;
      } else if (patient?.vitals?.restingHR != null && twin.hr0 != null) {
        currentVal = patient.vitals.restingHR - twin.hr0;
      }
      const target = Math.min(30.0, Math.max(-15.0, Number((currentVal + amount).toFixed(1))));
      overrides.hrAboveBaseline = target;
      meta.hrAboveBaseline = { mode: 'relative', amount, dir: 'higher', currentVal, target };
    }
  } else if (q.includes("resting hr") && q.includes("baseline")) {
    overrides.hrAboveBaseline = 0.0;
    meta.hrAboveBaseline = { mode: 'absolute', amount: 0, dir: 'baseline' };
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

  Object.defineProperty(overrides, '_meta', { value: meta, enumerable: false, writable: true });
  return overrides;
}

function describeAppliedOverride(k, v, currentValues = {}, hrMeta = null) {
  const currVal = currentValues ? currentValues[k] : null;
  const isNull = (currVal === null || currVal === undefined);
  let appliedDesc = `${k}: ${v}`;
  let isSame = false;

  const is3DayFeature = (k === 'hrAboveBaseline' || k === 'stepsRatio' || k === 'sleepHours');
  const labelPrefix = is3DayFeature ? "current 3-day avg" : "current";

  if (k === 'hrAboveBaseline') {
    let currStr = "n/a";
    if (!isNull) {
      const sign = currVal >= 0 ? "+" : "";
      currStr = `${sign}${Number(currVal.toFixed(1))} bpm`;
      if (Math.abs(v - currVal) < 0.5) {
        isSame = true;
      }
    }

    if (hrMeta?.mode === 'relative') {
      appliedDesc = `Resting HR set to ${hrMeta.amount} bpm ${hrMeta.dir} (relative to current) (${labelPrefix}: ${currStr})`;
    } else if (hrMeta?.mode === 'absolute') {
      if (v < 0) {
        appliedDesc = `Resting HR set to ${Math.abs(v)} bpm below baseline (absolute vs baseline) (${labelPrefix}: ${currStr})`;
      } else if (v > 0) {
        appliedDesc = `Resting HR set to ${v} bpm above baseline (absolute vs baseline) (${labelPrefix}: ${currStr})`;
      } else {
        appliedDesc = `Resting HR set to baseline (absolute vs baseline) (${labelPrefix}: ${currStr})`;
      }
    } else {
      if (v < 0) {
        appliedDesc = `Resting HR set to ${Math.abs(v)} bpm below baseline (absolute vs baseline) (${labelPrefix}: ${currStr})`;
      } else if (v > 0) {
        appliedDesc = `Resting HR set to ${v} bpm above baseline (absolute vs baseline) (${labelPrefix}: ${currStr})`;
      } else {
        appliedDesc = `Resting HR set to baseline (absolute vs baseline) (${labelPrefix}: ${currStr})`;
      }
    }
  } else if (k === 'stepsRatio') {
    let currStr = "n/a";
    if (!isNull) {
      currStr = `${Math.round(currVal * 100)}%`;
      if (Math.abs(v - currVal) < 0.02) {
        isSame = true;
      }
    }
    if (v === 1.0) {
      appliedDesc = `Steps set to baseline (${labelPrefix}: ${currStr})`;
    } else {
      appliedDesc = `Steps set to ${Math.round(v * 100)}% of baseline (${labelPrefix}: ${currStr})`;
    }
  } else if (k === 'sleepHours') {
    let currStr = "n/a";
    if (!isNull) {
      currStr = `${Number(currVal.toFixed(1))}h`;
      if (Math.abs(v - currVal) < 0.1) {
        isSame = true;
      }
    }
    appliedDesc = `Sleep hours set to ${v}h (${labelPrefix}: ${currStr})`;
  } else if (k === 'recoveryIndex') {
    let currStr = "n/a";
    if (!isNull) {
      currStr = `${currVal >= 0 ? '+' : ''}${Number(currVal.toFixed(2))}`;
      if (Math.abs(v - currVal) < 0.05) {
        isSame = true;
      }
    }
    const vStr = v >= 0 ? `+${v}` : `${v}`;
    appliedDesc = `Recovery index set to ${vStr} (${labelPrefix}: ${currStr})`;
  } else if (k === 'missedMeds7d') {
    let currStr = "n/a";
    if (!isNull) {
      currStr = `${Math.round(currVal)}`;
      if (v === Math.round(currVal)) {
        isSame = true;
      }
    }
    appliedDesc = `Missed medication days set to ${v} (${labelPrefix}: ${currStr})`;
  } else if (k === 'rehabSessions7d') {
    let currStr = "n/a";
    if (!isNull) {
      currStr = `${Math.round(currVal)}`;
      if (v === Math.round(currVal)) {
        isSame = true;
      }
    }
    appliedDesc = `Rehab sessions set to ${v} (${labelPrefix}: ${currStr})`;
  }

  if (isNull) {
    isSame = false;
  }

  return { appliedDesc, isSame, isNull };
}

export async function generateChatbotResponse(question, patient, modelCard = null) {
  const norm = normalizeText(question);
  const q = norm.toLowerCase().trim();

  // PRIORITY 1A: CRISIS / SELF-HARM
  for (const pattern of SELF_HARM_PATTERNS) {
    if (pattern.test(q)) {
      return {
        text: "I'm sorry you're going through this. I can't help with this here. Please contact your local emergency number or a local crisis line now, or someone you trust.",
        intent: "crisis"
      };
    }
  }

  // PRIORITY 1B: EMERGENCY / SYMPTOM
  for (const pattern of EMERGENCY_PATTERNS) {
    if (pattern.test(q)) {
      return {
        text: "I can't assess symptoms. If you think this may be an emergency, contact your local emergency number now. For anything else, contact your care team.",
        intent: "emergency"
      };
    }
  }

  // PRIORITY 2: MEDICAL ADVICE / TOPICS
  // Exemption regex: requires missed followed by days/meds/medications/medicines/doses
  const MISSED_REGEX = /\bmissed\s+(?:\d+\s+)?(?:days?|meds?|medications?|medicines?|doses?)\b/i;
  const qWithoutMissed = q.replace(new RegExp(MISSED_REGEX.source, 'gi'), ' ');

  for (const pattern of MEDICAL_ADVICE_PATTERNS) {
    if (pattern.test(qWithoutMissed)) {
      return {
        text: "I can't help with medical questions, medications or treatment. Please contact your care team. I can show your recorded data, explain terms used in this app, or run a what-if scenario.",
        intent: "medical_refusal"
      };
    }
  }

  // PRIORITY 3: WHAT-IF
  const isWhatIfTrigger = WHAT_IF_TRIGGERS.some(trigger => matchWordBoundary(q, trigger));
  if (isWhatIfTrigger) {
    if (!patient || patient.isSimulated) {
      return {
        text: "Patient data answers need the live API.",
        intent: "what_if_offline"
      };
    }

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
      const baseRiskStr = formatRiskPercentage(result.baselineP50);
      const scenRiskStr = formatRiskPercentage(result.scenarioP50);

      const yCutoffPct = modelCard?.yellowCutoff != null ? `${(modelCard.yellowCutoff * 100).toFixed(2)}%` : null;
      const rCutoffPct = modelCard?.redCutoff != null ? `${(modelCard.redCutoff * 100).toFixed(2)}%` : null;

      const cutoffStatus = result.scenarioAtOrAboveRedCutoff
        ? (rCutoffPct ? `At or above Red score cutoff (${rCutoffPct})` : "At or above Red score cutoff")
        : result.scenarioAtOrAboveYellowCutoff
        ? (yCutoffPct ? `At or above Yellow score cutoff (${yCutoffPct})` : "At or above Yellow score cutoff")
        : (yCutoffPct ? `Below Yellow score cutoff (${yCutoffPct})` : "Below Yellow score cutoff");

      const appliedDescs = [];
      let anySame = false;
      let anyNull = false;
      for (const [k, v] of Object.entries(result.appliedOverrides)) {
        const hrMeta = k === 'hrAboveBaseline' ? overrides._meta?.hrAboveBaseline : null;
        const { appliedDesc, isSame, isNull } = describeAppliedOverride(k, v, result.currentValues, hrMeta);
        appliedDescs.push(appliedDesc);
        if (isSame) anySame = true;
        if (isNull) anyNull = true;
      }
      if (!anyNull && Math.abs(result.baselineP50 - result.scenarioP50) < 0.0001 && result.deltaLogOdds === 0) {
        anySame = true;
      }

      const sameNotice = (!anyNull && anySame) ? " No change: this value is already the same as today's." : "";

      const highScoreLimitation = Array.isArray(modelCard?.limitations)
        ? modelCard.limitations.find(l => l.includes("predictions above 50%"))
        : null;

      let highScoreNote = "";
      if (Math.max(result.baselineP50, result.scenarioP50) >= 0.5 && highScoreLimitation) {
        highScoreNote = `\n${highScoreLimitation.trim()}`;
      }

      const calibThresh = modelCard?.calibrationEstablishedFromP;
      let lowScoreNote = "";
      if (calibThresh != null) {
        const calibPctVal = calibThresh <= 1 ? calibThresh * 100 : calibThresh;
        const xStr = Number(calibPctVal.toFixed(1));
        const threshNorm = calibThresh <= 1 ? calibThresh : calibThresh / 100;
        if (result.baselineP50 < threshNorm || result.scenarioP50 < threshNorm) {
          lowScoreNote = `\nPercentages below about ${xStr}% are not precise.`;
        }
      }

      return {
        text: `Scenario values applied: ${appliedDescs.join("; ")}.${sameNotice}\n` +
              `Approximate 7-day risk: ${baseRiskStr} -> ${scenRiskStr}.\n` +
              `Score status: ${cutoffStatus}.\n\n` +
              `${result.note}${highScoreNote}${lowScoreNote}`,
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
    const yellowCatch = modelCard.yellowCatchRate?.rate != null
      ? `${Number(modelCard.yellowCatchRate.rate).toFixed(1)}%`
      : "not available";
    const redCatch = modelCard.modelRedCatchRate?.rate != null
      ? `${Number(modelCard.modelRedCatchRate.rate).toFixed(1)}%`
      : "not available";
    const epPrec = modelCard.episodePrecision?.yellow?.false_alarms_per_true != null
      ? `${modelCard.episodePrecision.yellow.false_alarms_per_true} false alarms per true catch`
      : "not available";

    let calibNote = modelCard.calibrationNote || "not available";
    if (calibNote.endsWith(".")) {
      calibNote = calibNote.slice(0, -1);
    }

    const lines = [
      `Model performance (synthetic data only): AUC-ROC is ${rocAuc}.`,
      `Yellow catch rate: ${yellowCatch}, Red catch rate: ${redCatch}.`,
      `For Yellow alerts, there are ${epPrec}.`,
      `Calibration note: ${calibNote}.`
    ];

    if (Array.isArray(modelCard.limitations) && modelCard.limitations.length > 0) {
      modelCard.limitations.forEach(lim => {
        const cleanLim = lim.trim().replace(/^-\s*/, '');
        lines.push(`- ${cleanLim}`);
      });
    } else {
      lines.push(`- not available`);
    }

    lines.push(`Synthetic data only.`);

    return {
      text: lines.join("\n"),
      intent: "model_info"
    };
  }

  // PRIORITY 5: PATIENT STATS (Live data only)
  const isGlossaryQuestion = matchWordBoundary(q, "mean") || matchWordBoundary(q, "meaning") || matchWordBoundary(q, "define") || matchWordBoundary(q, "definition") || matchWordBoundary(q, "explain") || (q.startsWith("what is ") && !q.includes("my") && !q.includes("patient"));

  const STATS_KEYWORDS = [
    "my", "stats", "latest", "today", "steps", "sleep", "hrv", "heart rate",
    "spo2", "oxygen", "blood pressure", "baseline", "week", "why", "drivers", "forecast", "trajectory", "next 7 days",
    "trend", "last reading", "data age", "how old"
  ];
  const isOwnStatus = q.includes("my zone") || q.includes("current zone") || q.includes("my risk") || q.includes("my score") || q.includes("today's score") || q.includes("score rationale") || q.includes("zone rationale");
  const isStats = !isGlossaryQuestion && (STATS_KEYWORDS.some(k => matchWordBoundary(q, k)) || isOwnStatus || (matchWordBoundary(q, "zone") && !isGlossaryQuestion));

  if (isStats) {
    if (!patient || patient.isSimulated) {
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
        const pStartVal = ts?.p50 ?? cone[0].p50;
        const pEndVal = cone[cone.length - 1].p50;
        const pStartStr = formatRiskPercentage(pStartVal);
        const pEndStr = formatRiskPercentage(pEndVal);
        return {
          text: `If the current trend continues, the score would move from ${pStartStr} to ${pEndStr} over 7 days. Scenario only; the band reflects filter uncertainty and is not validated.`,
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
      const zoneStr = ts?.triageZone ? ts.triageZone.toUpperCase() : "not available";
      const watchStr = ts?.watch !== null && ts?.watch !== undefined ? (ts.watch ? "Yes" : "No") : "not available";
      const p50Val = ts?.p50 ?? patient?.riskScore;
      const approxRisk = p50Val != null ? formatRiskPercentage(p50Val) : "not available";
      const zoneRationale = ts?.zoneRationale ? ts.zoneRationale : "not available";

      let redSourcePart = "";
      if (ts?.triageZone === "red") {
        const redSrc = ts?.redSource ? ts.redSource : "not available";
        redSourcePart = ` Red source: ${redSrc}.`;
      }

      const highScoreLimitation = Array.isArray(modelCard?.limitations)
        ? modelCard.limitations.find(l => l.includes("predictions above 50%"))
        : null;

      let highScoreNote = "";
      if (p50Val != null && Math.round(p50Val * 100) > 50 && highScoreLimitation) {
        highScoreNote = `\n${highScoreLimitation.trim()}`;
      }

      const calibThresh = modelCard?.calibrationEstablishedFromP;
      let lowScoreNote = "";
      if (calibThresh != null && p50Val != null) {
        const calibPctVal = calibThresh <= 1 ? calibThresh * 100 : calibThresh;
        const xStr = Number(calibPctVal.toFixed(1));
        const threshNorm = calibThresh <= 1 ? calibThresh : calibThresh / 100;
        if (p50Val < threshNorm) {
          lowScoreNote = `\nPercentages below about ${xStr}% are not precise.`;
        }
      }

      return {
        text: `Current zone: ${zoneStr} (Watch: ${watchStr}). Approx. risk: ${approxRisk}.${redSourcePart} ${zoneRationale}${highScoreNote}${lowScoreNote}`,
        intent: "zone_status"
      };
    }

    // E. Data Age / Stale
    if (matchWordBoundary(q, "data age") || matchWordBoundary(q, "stale") || matchWordBoundary(q, "how old")) {
      const sDay = ts?.scoreDay !== null && ts?.scoreDay !== undefined ? `Day ${ts.scoreDay}` : "not available";
      const age = ts?.dataAgeDays !== null && ts?.dataAgeDays !== undefined ? `${ts.dataAgeDays} day(s)` : "not available";
      const isStale = isPatientStale(patient, ts);
      const staleText = isStale
        ? `No readings for ${ts?.dataAgeDays ?? 3} days; scores are held frozen.`
        : "Telemetry data is receiving and up to date.";
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
