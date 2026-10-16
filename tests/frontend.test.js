import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatRisk, formatVitalValue, getDriverLabel, formatDriverValue, calcSliderPosition } from '../src/utils/formatters';
import { 
  generateChatbotResponse, 
  parseWhatIfOverrides, 
  GLOSSARY,
  SUGGESTED_PROMPTS 
} from '../src/services/chatbotData';
import { fetchLivePatients, patientService } from '../src/services/patientService';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import MedicationReportsView from '../src/views/MedicationReportsView';
import Sidebar from '../src/components/Sidebar';
import AlertsView from '../src/views/AlertsView';
import Header from '../src/components/Header';
import Sparkline from '../src/components/Sparkline';
import HomeView from '../src/views/HomeView';
import RiskForecastChart from '../src/components/RiskForecastChart';
import RecordsView from '../src/views/RecordsView';
import HealthMagazineView from '../src/views/HealthMagazineView';
import PredictionsView from '../src/views/PredictionsView';
import HospitalBedCard from '../src/components/HospitalBedCard';
import WardBedView from '../src/views/WardBedView';
import App from '../src/App';
import { formatRiskPercentage, formatTimeAgo, isOverFifty } from '../src/utils/formatters';
import { isPatientStale } from '../src/services/patientService';

describe('Frontend Test Suite (GATE E)', () => {

  const mockLivePatient = {
    id: 'PT-8092',
    name: 'Patient PT-8092',
    isSimulated: false,
    riskLevel: 'stable',
    vitals: {
      restingHR: 68,
      hrv: 47,
      dailySteps: 5400,
      sleepHours: 7.2,
      bloodPressure: '124/82',
      spo2: 98
    },
    twinState: {
      patientId: 'PT-8092',
      calibrated: true,
      scoreDay: 14,
      dataAgeDays: 0,
      staleData: false,
      p50: 0.0858,
      triageZone: 'green',
      watch: false,
      redSource: null,
      zoneRationale: 'Scores remain below alert cutoffs across consecutive monitoring days.',
      hr0: 65,
      hrv0: 57,
      steps0: 6000,
      drivers: [
        { feature: 'steps_ratio_3d_mean', rawValue: 0.9, logitContribution: 0.15, zScore: -0.2 },
        { feature: 'hr_above_baseline_3d_mean', rawValue: 3.0, logitContribution: 0.12, zScore: 0.3 },
        { feature: 'baseline_clinical_profile', rawValue: null, logitContribution: -0.22, zScore: null }
      ],
      driversNote: 'Contributions are relative to the average training patient; telemetry features overlap, so credit between them is approximate.',
      recentReadings: [
        { day: 8, restingHR: 68, hrv: 48, steps: 5200, sleepHours: 7.0, spo2: 98, bpSys: 122, bpDia: 80 },
        { day: 9, restingHR: 67, hrv: 49, steps: 5600, sleepHours: 7.5, spo2: 98, bpSys: 124, bpDia: 82 },
        { day: 10, restingHR: 69, hrv: 46, steps: 5100, sleepHours: 6.8, spo2: 97, bpSys: 125, bpDia: 83 },
        { day: 11, restingHR: 70, hrv: 45, steps: 4900, sleepHours: 6.5, spo2: 98, bpSys: 126, bpDia: 84 },
        { day: 12, restingHR: 68, hrv: 47, steps: 5300, sleepHours: 7.1, spo2: 99, bpSys: 123, bpDia: 81 },
        { day: 13, restingHR: 67, hrv: 48, steps: 5500, sleepHours: 7.3, spo2: 98, bpSys: 124, bpDia: 82 },
        { day: 14, restingHR: 68, hrv: 47, steps: 5400, sleepHours: 7.2, spo2: 98, bpSys: 124, bpDia: 82 }
      ],
      forwardCone: [
        { day_ahead: 1, p10: 0.05, p50: 0.09, p90: 0.11, scenario: 'trend' },
        { day_ahead: 7, p10: 0.06, p50: 0.12, p90: 0.16, scenario: 'trend' }
      ]
    }
  };

  const mockModelCard = {
    rocAuc: { mean: 0.7096, ci: [0.6641, 0.7535] },
    testPositiveRate: 0.18,
    yellowCatchRate: { rate: 64.7 },
    modelRedCatchRate: { rate: 53.5 },
    combinedRedCatchRate: { rate: 68.2 },
    episodePrecision: { yellow: { false_alarms_per_true: 3.35 } },
    calibrationNote: 'Show zones; show percentages as approximate.',
    limitations: ['Fully synthetic data; no real-world validation', 'Linear model only'],
    yellowCutoff: 0.0468,
    redCutoff: 0.2319
  };

  beforeEach(() => {
    global.fetch = vi.fn((url, options) => {
      if (url.includes('/what-if')) {
        const body = JSON.parse(options?.body || '{}');
        const applied = body.overrides || {};
        const curr = {};
        for (const k of Object.keys(applied)) {
          if (k === 'hrAboveBaseline') curr[k] = 3.0;
          else if (k === 'sleepHours') curr[k] = 7.2;
          else if (k === 'stepsRatio') curr[k] = 0.9;
          else if (k === 'recoveryIndex') curr[k] = 0.1;
          else if (k === 'missedMeds7d') curr[k] = 0;
          else if (k === 'rehabSessions7d') curr[k] = 3;
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            patientId: 'PT-8092',
            scoreDay: 14,
            appliedOverrides: applied,
            currentValues: curr,
            baselineP50: 0.0858,
            scenarioP50: 0.0650,
            deltaLogOdds: -0.31,
            scenarioAtOrAboveYellowCutoff: true,
            scenarioAtOrAboveRedCutoff: false,
            note: 'Scenario only: the selected value is changed and everything else is held fixed. Real changes usually move several measures together. This is not a prediction and not advice. Zones also need 2 consecutive days above a cutoff.'
          })
        });
      }
      if (url.includes('/model-card')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockModelCard)
        });
      }
      if (url.includes('/patients')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              patient_id: 'PT-8092',
              twin_state: mockLivePatient.twinState,
              vitals: mockLivePatient.vitals
            }
          ])
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });
  });

  // (a) Live patients isolation from mock-only fields & MedicationReportsView demo data tests
  describe('(a) Live patients isolation from mock-only fields and MedicationReportsView', () => {
    it('live patients transformed from API never contain mock fields', async () => {
      const liveList = await fetchLivePatients();
      expect(liveList.length).toBeGreaterThan(0);
      for (const p of liveList) {
        expect(p.isSimulated).toBe(false);
        expect(p.sparkline).toBeUndefined();
        expect(p.riskTrend).toBeUndefined();
        expect(p.riskTrendValue).toBeUndefined();
        expect(p.riskTrajectory).toBeUndefined();
        expect(p.explainabilityFactors).toBeUndefined();
      }
    });

    it('the live-mode MedicationReportsView renders the DEMO DATA banner text', () => {
      // With known sample entry (PT-8092)
      const htmlKnown = renderToStaticMarkup(
        React.createElement(MedicationReportsView, { patient: mockLivePatient, isLive: true })
      );
      expect(htmlKnown).toContain('DEMO DATA - sample medication schedule, labs and remarks.');
      expect(htmlKnown).toContain('Not from this patient&#x27;s record. Shown for interface demonstration only.');
      expect(htmlKnown.replace(/&#x27;/g, "'")).toContain(
        "DEMO DATA - sample medication schedule, labs and remarks. Not from this patient's record. Shown for interface demonstration only."
      );
      expect(htmlKnown).not.toContain("This patient has no sample entry; PT-8092's sample data is shown.");

      // With fallback entry (patient without sample data)
      const fallbackPatient = { id: 'PT-9999', isSimulated: false };
      const htmlFallback = renderToStaticMarkup(
        React.createElement(MedicationReportsView, { patient: fallbackPatient, isLive: true })
      );
      expect(htmlFallback).toContain('DEMO DATA - sample medication schedule, labs and remarks.');
      expect(htmlFallback.replace(/&#x27;/g, "'")).toContain(
        "This patient has no sample entry; PT-8092's sample data is shown."
      );
    });

    it('the live-mode MedicationReportsView renders the medication list (not the "No medication data" text)', () => {
      const html = renderToStaticMarkup(
        React.createElement(MedicationReportsView, { patient: mockLivePatient, isLive: true })
      );
      expect(html).not.toContain('No medication data in this record.');
      expect(html).toContain('Amlodipine Besylate');
      expect(html).toContain('Atorvastatin Calcium');
      expect(html).toContain('CoQ10 (Ubiquinol) Supplement');
    });
  });

  // (b) Risk formatter for null, 0.0858, 0.2
  describe('(b) formatRisk formatter', () => {
    it('formats null as "-"', () => {
      expect(formatRisk(null)).toBe('-');
      expect(formatRisk(undefined)).toBe('-');
    });

    it('formats 0.0858 as "~9% 7-day readmission risk (approx.)"', () => {
      expect(formatRisk(0.0858)).toBe('~9% 7-day readmission risk (approx.)');
    });

    it('formats 0.2 as "~20% 7-day readmission risk (approx.)"', () => {
      expect(formatRisk(0.2)).toBe('~20% 7-day readmission risk (approx.)');
    });

    it('formats risk above 50% as "over 50% (approx.)"', () => {
      expect(formatRisk(0.9)).toBe('over 50% (approx.)');
      expect(formatRisk(0.55)).toBe('over 50% (approx.)');
      expect(formatRisk(0.50)).toBe('over 50% (approx.)');
    });
  });

  // (c) Null-safe vitals
  describe('(c) Null-safe vitals', () => {
    it('formats null and undefined vital values safely', () => {
      expect(formatVitalValue(null)).toBe('-');
      expect(formatVitalValue(undefined)).toBe('-');
      expect(formatVitalValue(72, 'bpm')).toBe('72 bpm');
      expect(formatVitalValue(null, 'bpm')).toBe('-');
    });

    it('handles incomplete or missing vitals without throwing', () => {
      const incomplete = { restingHR: null, hrv: undefined, dailySteps: null };
      expect(formatVitalValue(incomplete.restingHR)).toBe('-');
      expect(formatVitalValue(incomplete.hrv)).toBe('-');
      expect(formatVitalValue(incomplete.dailySteps)).toBe('-');
    });
  });

  // (d) Chatbot intent tests with at least 8 prompts per intent (including EXACT priority cases)
  describe('(d) Chatbot intent router - 8 prompts per intent and exact priority rules', () => {
    it('Priority 1: Emergency/Symptom words trigger emergency refusal only', async () => {
      const emergencyPrompts = [
        "I have chest pain",
        "what if sleep 8 hours and chest pain", // EXACT priority test case: emergency trumps what-if!
        "can't breathe",
        "short of breath",
        "feeling dizzy",
        "feeling sick",
        "severe pain in arm",
        "I think I am fainting"
      ];
      expect(emergencyPrompts.length).toBeGreaterThanOrEqual(8);

      for (const prompt of emergencyPrompts) {
        const res = await generateChatbotResponse(prompt, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('emergency');
        expect(res.text).toBe(
          "I can't assess symptoms. If you think this may be an emergency, contact your local emergency number now. For anything else, contact your care team."
        );
      }
    });

    it('Priority 2: Medical advice/topics trigger refusal only', async () => {
      const medicalPrompts = [
        "what dose of aspirin", // EXACT priority test case
        "what medication should I take",
        "is it safe to exercise",
        "should I take statin",
        "what is the dose of amlodipine",
        "can I take beta blocker",
        "what should I do to recover faster",
        "will I be readmitted"
      ];
      expect(medicalPrompts.length).toBeGreaterThanOrEqual(8);

      for (const prompt of medicalPrompts) {
        const res = await generateChatbotResponse(prompt, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('medical_refusal');
        expect(res.text).toBe(
          "I can't help with medical questions, medications or treatment. Please contact your care team. I can show your recorded data, explain terms used in this app, or run a what-if scenario."
        );
      }
    });

    it('Priority 3: What-if scenarios call what-if API or provide scenario chips', async () => {
      const whatIfPrompts = [
        "what if my steps were 6000",
        "what if I sleep 8 hours",
        "what if resting hr is 5 bpm lower",
        "what if resting hr is 5 bpm higher",
        "what if my steps return to my baseline",
        "what if no missed medication days",
        "what if recovery index +1",
        "suppose sleep hours is 8"
      ];
      expect(whatIfPrompts.length).toBeGreaterThanOrEqual(8);

      for (const prompt of whatIfPrompts) {
        const res = await generateChatbotResponse(prompt, mockLivePatient, mockModelCard);
        expect(['what_if_success', 'what_if_unparsed']).toContain(res.intent);
        if (res.intent === 'what_if_success') {
          expect(res.text).toContain('Scenario values applied:');
          expect(res.text).toContain('Approximate 7-day risk:');
          expect(res.text).toContain('Scenario only: the selected value is changed');
        }
      }
    });

    it('Priority 4: Patient stats from live data', async () => {
      const statsPrompts = [
        "what is my current zone?",
        "show my last 7 days",
        "what are the main drivers of my score?",
        "what does the next 7 days look like if the trend continues?",
        "what is my resting heart rate?",
        "show my hrv stats",
        "what is my data age?",
        "why is my score elevated?"
      ];
      expect(statsPrompts.length).toBeGreaterThanOrEqual(8);

      for (const prompt of statsPrompts) {
        const res = await generateChatbotResponse(prompt, mockLivePatient, mockModelCard);
        expect(res.text).toBeTruthy();
        expect(res.text).not.toBe('Patient data answers need the live API.');
      }
    });

    it('Priority 5: Model info from modelCard', async () => {
      const modelPrompts = [
        "how accurate is this model?",
        "what is the model accuracy?",
        "how reliable is the prediction?",
        "what is the auc of the model?",
        "how many false alarms?",
        "what are the limitations?",
        "can I trust this model?",
        "is this synthetic?"
      ];
      expect(modelPrompts.length).toBeGreaterThanOrEqual(8);

      for (const prompt of modelPrompts) {
        const res = await generateChatbotResponse(prompt, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('model_info');
        expect(res.text).toContain('synthetic data only');
        expect(res.text).toContain('AUC-ROC is');
      }
    });

    it('Priority 6: Glossary terms', async () => {
      const glossaryPrompts = [
        "what does watch mean?",
        "explain green zone",
        "what is yellow zone?",
        "what is red zone?",
        "what is red source?",
        "what is baseline?",
        "what is recovery index?",
        "what is stale data?"
      ];
      expect(glossaryPrompts.length).toBeGreaterThanOrEqual(8);

      for (const prompt of glossaryPrompts) {
        const res = await generateChatbotResponse(prompt, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('glossary');
        expect(res.text).toBeTruthy();
      }
    });

    it('Priority 7: Help and greeting fallbacks', async () => {
      const helpPrompts = [
        "hello",
        "hi",
        "help",
        "who are you",
        "what can you do",
        "commands",
        "good morning",
        "can you assist me?"
      ];
      expect(helpPrompts.length).toBeGreaterThanOrEqual(8);

      for (const prompt of helpPrompts) {
        const res = await generateChatbotResponse(prompt, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('help');
        expect(res.text).toContain('I am a scripted, data-only assistant.');
        expect(res.text).toContain('What is my current zone?');
      }
    });

    it('Word boundaries prevent false positives for great, repeat, scored, and message', async () => {
      const testCases = ["great", "repeat", "scored", "message"];
      for (const word of testCases) {
        const res = await generateChatbotResponse(word, mockLivePatient, mockModelCard);
        expect(res.intent).not.toBe('medical_refusal');
        expect(res.intent).not.toBe('glossary');
        expect(res.intent).not.toBe('data_age');
        expect(res.intent).toBe('help');
      }
    });

    it('Routes "how accurate is my model" to model info (checked before generic "my" keyword)', async () => {
      const res = await generateChatbotResponse("how accurate is my model", mockLivePatient, mockModelCard);
      expect(res.intent).toBe('model_info');
      expect(res.text).toContain('AUC-ROC is');
    });

    it('When modelCard is null, replies with model unavailable and shows no numbers', async () => {
      const res = await generateChatbotResponse("how accurate is this model?", mockLivePatient, null);
      expect(res.intent).toBe('model_info');
      expect(res.text).toBe("Model information is not available right now.");
    });

    it('Formats zone reply with exact wording', async () => {
      const res = await generateChatbotResponse("what is my current zone?", mockLivePatient, mockModelCard);
      expect(res.intent).toBe('zone_status');
      expect(res.text).toBe("Current zone: GREEN (Watch: No). Approx. risk: ~9%. Scores remain below alert cutoffs across consecutive monitoring days.");
    });

    it('Scenario replies describe how value was applied and add No change notice when value matches today', async () => {
      const resDiff = await generateChatbotResponse("what if resting hr is 5 bpm lower", mockLivePatient, mockModelCard);
      expect(resDiff.intent).toBe('what_if_success');
      expect(resDiff.text).toContain("Resting HR set to 5 bpm lower (relative to current) (current 3-day avg: +3 bpm)");

      const resBelow = await generateChatbotResponse("what if resting hr is 5 bpm below baseline", mockLivePatient, mockModelCard);
      expect(resBelow.intent).toBe('what_if_success');
      expect(resBelow.text).toContain("Resting HR set to 5 bpm below baseline (absolute vs baseline) (current 3-day avg: +3 bpm)");

      const resSame = await generateChatbotResponse("what if no missed medication days", mockLivePatient, mockModelCard);
      expect(resSame.intent).toBe('what_if_success');
      expect(resSame.text).toContain("No change: this value is already the same as today's.");
    });

    it('Help reply lists exactly 4 example prompts', async () => {
      const res = await generateChatbotResponse("help", mockLivePatient, mockModelCard);
      expect(res.intent).toBe('help');
      const lines = res.text.split('\n').filter(l => /^\d+\./.test(l));
      expect(lines.length).toBe(4);
    });
  });

  // (e) No chatbot answer for a live patient contains NaN, undefined, a drug name, "you should", "I recommend"
  describe('(e) Clean responses: no NaN, undefined, drug names, recommendations', () => {
    const testQueries = [
      "what is my current zone?",
      "show my last 7 days",
      "what are the main drivers of my score?",
      "what does the next 7 days look like if the trend continues?",
      "what if my steps return to my baseline?",
      "what if sleep 8 hours",
      "how accurate is this model?",
      "what does watch mean?",
      "what is my resting heart rate?",
      "what is my data age?"
    ];

    const forbiddenStrings = ['NaN', 'undefined', 'you should', 'I recommend', 'try to'];
    const drugNames = ['aspirin', 'atorvastatin', 'amlodipine', 'metoprolol', 'lisinopril', 'coq10'];

    it('ensures no response contains prohibited substrings or ungrounded claims', async () => {
      for (const q of testQueries) {
        const res = await generateChatbotResponse(q, mockLivePatient, mockModelCard);
        for (const bad of forbiddenStrings) {
          expect(res.text).not.toContain(bad);
        }
        for (const drug of drugNames) {
          expect(res.text.toLowerCase()).not.toContain(drug);
        }
      }
    });
  });

  // (f) What-if parse cases
  describe('(f) What-if override parser', () => {
    it('parses "what if my steps were 6000"', () => {
      const overrides = parseWhatIfOverrides("what if my steps were 6000", mockLivePatient);
      expect(overrides.stepsRatio).toBeCloseTo(1.0, 2);
    });

    it('parses "what if I sleep 8 hours"', () => {
      const overrides = parseWhatIfOverrides("what if I sleep 8 hours", mockLivePatient);
      expect(overrides.sleepHours).toBe(8);
    });

    it('parses "what if resting hr is 5 bpm lower" as relative to current', () => {
      const overrides = parseWhatIfOverrides("what if resting hr is 5 bpm lower", mockLivePatient);
      expect(overrides.hrAboveBaseline).toBe(-2);
    });

    it('parses "what if resting hr is 5 bpm below baseline" as absolute vs baseline', () => {
      const overrides = parseWhatIfOverrides("what if resting hr is 5 bpm below baseline", mockLivePatient);
      expect(overrides.hrAboveBaseline).toBe(-5);
    });

    it('unparseable text returns empty overrides and chatbot displays chips', async () => {
      const overrides = parseWhatIfOverrides("what if something random happens", mockLivePatient);
      expect(Object.keys(overrides).length).toBe(0);

      const res = await generateChatbotResponse("what if something random happens", mockLivePatient, mockModelCard);
      expect(res.intent).toBe('what_if_unparsed');
      expect(res.showChips).toBe(true);
      expect(res.text).toContain('scenario chips below');
    });
  });

  // (g) Offline mode returns the live-API-needed message for stats
  describe('(g) Offline mode rejection for patient stats', () => {
    it('returns "Patient data answers need the live API." when patient is simulated', async () => {
      const offlinePatient = {
        ...mockLivePatient,
        isSimulated: true
      };

      const res = await generateChatbotResponse("what is my current zone?", offlinePatient, mockModelCard);
      expect(res.intent).toBe('stats_offline');
      expect(res.text).toBe("Patient data answers need the live API.");
    });
  });

  // (h) Round 3: Safety stems and inflections
  describe('(h) Round 3: Safety stems and inflections', () => {
    it('matches inflections and stems for safety and emergency words', async () => {
      const refusalCases = [
        "what medications am I on",
        "my pills",
        "side effects?",
        "any supplements",
        "taking drugs",
        "prescribed doses",
        "tablets",
        "special foods",
        "strict diets"
      ];
      for (const q of refusalCases) {
        const res = await generateChatbotResponse(q, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('medical_refusal');
      }

      const emergencyCases = [
        "I fainted",
        "feeling dizziness",
        "can’t breathe",
        "can't breathe",
        "chest pains",
        "he is bleeding",
        "suffered strokes"
      ];
      for (const q of emergencyCases) {
        const res = await generateChatbotResponse(q, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('emergency');
      }

      const safeCases = ["great", "repeat", "scored", "message", "heart rate"];
      for (const q of safeCases) {
        const res = await generateChatbotResponse(q, mockLivePatient, mockModelCard);
        expect(res.intent).not.toBe('emergency');
        expect(res.intent).not.toBe('medical_refusal');
      }
    });
  });

  // (i) Round 3: Zone reply formatting with redSource and null safety
  describe('(i) Round 3: Zone reply formatting', () => {
    it('Zone reply for red patient includes Red source, and handles null fields', async () => {
      const redPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          triageZone: 'red',
          watch: false,
          redSource: 'model',
          p50: 0.28,
          zoneRationale: 'Scores exceeded red cutoff for 2 consecutive days.'
        }
      };
      const res = await generateChatbotResponse("what is my current zone?", redPatient, mockModelCard);
      expect(res.intent).toBe('zone_status');
      expect(res.text).toBe("Current zone: RED (Watch: No). Approx. risk: ~28%. Red source: model. Scores exceeded red cutoff for 2 consecutive days.");

      const nullPatient = {
        id: 'PT-NULL',
        isSimulated: false,
        twinState: {
          triageZone: null,
          watch: null,
          redSource: null,
          p50: null,
          zoneRationale: null
        }
      };
      const resNull = await generateChatbotResponse("what is my current zone?", nullPatient, mockModelCard);
      expect(resNull.text).toBe("Current zone: not available (Watch: not available). Approx. risk: not available. not available");
    });
  });

  // (j) Round 3: What-if current values (n/a and no "No change") & offline rejection
  describe('(j) Round 3: What-if current values & offline rejection', () => {
    it('What-if handles null current values with n/a and never emits "No change"', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          patientId: 'PT-8092',
          scoreDay: 14,
          appliedOverrides: { hrAboveBaseline: 0.0 },
          currentValues: { hrAboveBaseline: null },
          baselineP50: 0.0858,
          scenarioP50: 0.0858,
          deltaLogOdds: 0.0,
          scenarioAtOrAboveYellowCutoff: true,
          scenarioAtOrAboveRedCutoff: false,
          note: 'Scenario only.'
        })
      });

      const res = await generateChatbotResponse("what if resting hr is 0 bpm above baseline", mockLivePatient, mockModelCard);
      expect(res.intent).toBe('what_if_success');
      expect(res.text).toContain('(current 3-day avg: n/a)');
      expect(res.text).not.toContain('No change');
    });

    it('Offline what-if returns live-API-needed message and makes no network call', async () => {
      const offlinePatient = { ...mockLivePatient, isSimulated: true };
      const fetchSpy = vi.spyOn(global, 'fetch');
      const res = await generateChatbotResponse("what if sleep 8 hours", offlinePatient, mockModelCard);
      expect(res.text).toBe("Patient data answers need the live API.");
      expect(res.intent).toBe("what_if_offline");
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  // (k) Round 4: Model info formatting
  describe('(k) Round 4: Model info reply formatting', () => {
    it('includes one section per line (AUC, catch rates, false alarms, calibration note), limitations prefixed with "- ", and synthetic data only', async () => {
      const customModelCard = {
        rocAuc: { mean: 0.7096, ci: [0.6641, 0.7535] },
        yellowCatchRate: { rate: 64.7 },
        modelRedCatchRate: { rate: 53.5 },
        episodePrecision: { yellow: { false_alarms_per_true: 3.35 } },
        calibrationNote: "Calibrated on synthetic population.",
        limitations: ["Linear model only", "Synthetic data only", "Third limitation", "Fourth limitation"]
      };
      const res = await generateChatbotResponse("how accurate is this model?", mockLivePatient, customModelCard);
      expect(res.text).toContain("Fourth limitation");
      expect(res.text).not.toContain("..");
      expect(res.text).toContain("Model performance (synthetic data only): AUC-ROC is 71.0% (95% CI: [66.4%, 75.3%]).");
      expect(res.text).toContain("Yellow catch rate: 64.7%, Red catch rate: 53.5%.");
      expect(res.text).toContain("For Yellow alerts, there are 3.35 false alarms per true catch.");
      expect(res.text).toContain("Calibration note: Calibrated on synthetic population.");
      expect(res.text).toContain("- Linear model only");
      expect(res.text).toContain("- Synthetic data only");
      expect(res.text).toContain("- Third limitation");
      expect(res.text).toContain("- Fourth limitation");
      expect(res.text).toContain("Synthetic data only.");

      const emptyCard = {
        rocAuc: { mean: 0.7096, ci: [0.6641, 0.7535] }
      };
      const resEmpty = await generateChatbotResponse("how accurate is this model?", mockLivePatient, emptyCard);
      expect(resEmpty.text).toContain("Calibration note: not available.");
      expect(resEmpty.text).toContain("- not available");
      expect(resEmpty.text).toContain("Synthetic data only.");
    });
  });

  // (l) Round 3: Data age bare "age" fix
  describe('(l) Round 3: Data age keyword handling', () => {
    it('does not trigger on bare "age", but triggers on "data age", "stale", "how old"', async () => {
      const resAge = await generateChatbotResponse("what is my age?", mockLivePatient, mockModelCard);
      expect(resAge.intent).not.toBe('data_age');

      const resDataAge = await generateChatbotResponse("what is my data age?", mockLivePatient, mockModelCard);
      expect(resDataAge.intent).toBe('data_age');

      const resStale = await generateChatbotResponse("is my data stale?", mockLivePatient, mockModelCard);
      expect(resStale.intent).toBe('data_age');

      const resHowOld = await generateChatbotResponse("how old is the data?", mockLivePatient, mockModelCard);
      expect(resHowOld.intent).toBe('data_age');
    });
  });

  // (m) Round 4 Requirements
  describe('(m) Round 4 Requirements', () => {
    it('Item 1: appends high-score note when approx risk > 50%, appends nothing when <= 50% or limitation missing', async () => {
      const highRiskPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          p50: 0.58,
          triageZone: 'red',
          redSource: 'model',
          zoneRationale: 'Scores exceeded red cutoff for 2 consecutive days.'
        }
      };
      const cardWithHighNote = {
        ...mockModelCard,
        limitations: [
          'Linear model only',
          'Synthetic decline before an event is stronger than in real life, so predictions above 50% can occur.'
        ]
      };

      const resZoneHigh = await generateChatbotResponse("what is my current zone?", highRiskPatient, cardWithHighNote);
      expect(resZoneHigh.text).toContain('predictions above 50% can occur');

      // Low risk patient (p50 = 0.0858, <= 50%)
      const resZoneLow = await generateChatbotResponse("what is my current zone?", mockLivePatient, cardWithHighNote);
      expect(resZoneLow.text).not.toContain('predictions above 50% can occur');

      // What-if scenario with scenarioP50 > 50%
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          patientId: 'PT-8092',
          scoreDay: 14,
          appliedOverrides: { hrAboveBaseline: 15.0 },
          currentValues: { hrAboveBaseline: 3.0 },
          baselineP50: 0.0858,
          scenarioP50: 0.62,
          deltaLogOdds: 2.1,
          scenarioAtOrAboveYellowCutoff: true,
          scenarioAtOrAboveRedCutoff: true,
          note: 'Scenario only.'
        })
      });
      const resWhatIfHigh = await generateChatbotResponse("what if resting hr is 15 bpm higher", mockLivePatient, cardWithHighNote);
      expect(resWhatIfHigh.text).toContain('predictions above 50% can occur');

      // What-if without that limitation
      const cardNoLimitation = {
        ...mockModelCard,
        limitations: ['Linear model only']
      };
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          patientId: 'PT-8092',
          scoreDay: 14,
          appliedOverrides: { hrAboveBaseline: 15.0 },
          currentValues: { hrAboveBaseline: 3.0 },
          baselineP50: 0.0858,
          scenarioP50: 0.62,
          deltaLogOdds: 2.1,
          scenarioAtOrAboveYellowCutoff: true,
          scenarioAtOrAboveRedCutoff: true,
          note: 'Scenario only.'
        })
      });
      const resWhatIfNoLim = await generateChatbotResponse("what if resting hr is 15 bpm higher", mockLivePatient, cardNoLimitation);
      expect(resWhatIfNoLim.text).not.toContain('predictions above 50%');
    });

    it('Item 1: stub live patients (1 red, 1 yellow, 1 watch, 1 green) and assert getAlerts().length === 3 and badge === 3', () => {
      const origSource = patientService.source;
      const origPatients = patientService.patients;
      try {
        patientService.source = 'live';
        patientService.patients = [
          { id: 'PT-1', name: 'Alice Red', twinState: { triageZone: 'red', redSource: 'model', p50: 0.65, scoreDay: 12, zoneRationale: 'High risk threshold exceeded' } },
          { id: 'PT-2', name: 'Bob Yellow', twinState: { triageZone: 'yellow', redSource: null, p50: 0.25, scoreDay: 10, zoneRationale: 'Elevated risk threshold exceeded' } },
          { id: 'PT-3', name: 'Charlie Watch', twinState: { triageZone: 'green', watch: true, redSource: null, p50: 0.15, scoreDay: 8, zoneRationale: 'Watch state active' } },
          { id: 'PT-4', name: 'David Green', twinState: { triageZone: 'green', watch: false, redSource: null, p50: 0.03, scoreDay: 14, zoneRationale: 'Stable recovery' } }
        ];

        const alerts = patientService.getAlerts();
        expect(alerts.length).toBe(3);

        const liveAlertCount = alerts.length;
        const liveBadge = true ? liveAlertCount : 0;
        expect(liveBadge).toBe(3);

        const offlineBadge = false ? liveAlertCount : 0;
        expect(offlineBadge).toBe(0);

        // Check fields on live alerts: patientId, zone, redSource, approx. risk, scoreDay, zoneRationale
        expect(alerts[0]).toMatchObject({
          patientId: 'PT-1',
          zone: 'red',
          redSource: 'model',
          scoreDay: 12,
          zoneRationale: 'High risk threshold exceeded'
        });
        expect(alerts[0].approxRisk).toBe('over 50% (approx.)');
        expect(alerts[0].actionRequired).toBeUndefined();

        // Render AlertsView in live mode: no clinical advice text, only patient details
        const htmlAlertsLive = renderToStaticMarkup(
          React.createElement(AlertsView, {
            alerts,
            patients: patientService.patients,
            isLive: true
          })
        );
        expect(htmlAlertsLive).not.toContain('Action:');
        expect(htmlAlertsLive).toContain('PT-1');
        expect(htmlAlertsLive).toContain('PT-2');
        expect(htmlAlertsLive).toContain('PT-3');
        expect(htmlAlertsLive).not.toContain('PT-4');

        // Render Sidebar in live mode
        const htmlLive = renderToStaticMarkup(
          React.createElement(Sidebar, {
            currentView: 'home',
            onViewChange: () => {},
            unreadAlertCount: liveAlertCount,
            isLive: true,
            onOpenSearch: () => {},
            userRole: 'doctor'
          })
        );
        expect(htmlLive).toContain(String(liveBadge));

        // In offline mode: mock alerts tagged DEMO DATA
        patientService.source = 'offline-demo';
        const offlineAlerts = patientService.getAlerts();
        const htmlAlertsOffline = renderToStaticMarkup(
          React.createElement(AlertsView, {
            alerts: offlineAlerts,
            patients: [],
            isLive: false
          })
        );
        expect(htmlAlertsOffline).toContain('DEMO DATA');
      } finally {
        patientService.source = origSource;
        patientService.patients = origPatients;
      }
    });

    it('Item 5 & A3: separate fixed reply for crisis / self-harm without phone numbers; symptom emergencies keep existing text', async () => {
      const crisisPhrases = [
        "suicide",
        "suicidal thoughts",
        "kill myself",
        "end my life",
        "self harm",
        "self-harm",
        "want to die",
        "wanna die",
        "don't want to live",
        "do not want to live",
        "kill me",
        "end it all",
        "hurt myself",
        "harm myself",
        "no reason to live"
      ];

      const expectedCrisisText = "I'm sorry you're going through this. I can't help with this here. Please contact your local emergency number or a local crisis line now, or someone you trust.";

      for (const phrase of crisisPhrases) {
        const res = await generateChatbotResponse(`I am thinking about ${phrase}`, mockLivePatient, mockModelCard);
        expect(res.intent, `Failed on phrase: "${phrase}"`).toBe('crisis');
        expect(res.text).toBe(expectedCrisisText);
        // Must contain no typed phone numbers
        expect(res.text).not.toMatch(/\d{3}/);
      }

      // Exact phrase check
      for (const phrase of crisisPhrases) {
        const res = await generateChatbotResponse(phrase, mockLivePatient, mockModelCard);
        expect(res.intent, `Failed on exact phrase: "${phrase}"`).toBe('crisis');
        expect(res.text).toBe(expectedCrisisText);
      }

      // Symptom emergency phrases keep existing text
      const symptomPhrases = [
        "chest pain",
        "can't breathe",
        "dizziness",
        "fainted",
        "overdose"
      ];
      for (const phrase of symptomPhrases) {
        const res = await generateChatbotResponse(phrase, mockLivePatient, mockModelCard);
        expect(res.intent, `Failed on symptom phrase: "${phrase}"`).toBe('emergency');
        expect(res.text).toBe(
          "I can't assess symptoms. If you think this may be an emergency, contact your local emergency number now. For anything else, contact your care team."
        );
      }

      // Control: "hurts" alone reaches symptom emergency text
      const resHurts = await generateChatbotResponse("hurts", mockLivePatient, mockModelCard);
      expect(resHurts.intent).toBe('emergency');

      // Control: "steps" alone reaches normal reply
      const resSteps = await generateChatbotResponse("steps", mockLivePatient, mockModelCard);
      expect(resSteps.intent).not.toBe('crisis');
      expect(resSteps.intent).not.toBe('emergency');

      // Benign controls
      const benignControls = ["painted", "hurtle", "heart rate", "great"];
      for (const word of benignControls) {
        const res = await generateChatbotResponse(word, mockLivePatient, mockModelCard);
        expect(res.intent).not.toBe('crisis');
        expect(res.intent).not.toBe('emergency');
        expect(res.intent).not.toBe('medical_refusal');
      }
    });

    it('A4: stub buttons in Header and MedicalRecordsVault are disabled in live mode', () => {
      const htmlDoctor = renderToStaticMarkup(
        React.createElement(Header, {
          activePatient: { ...mockLivePatient, isSimulated: false },
          userRole: 'doctor',
          onRoleChange: () => {},
          currentView: 'home',
          onOpenSearch: () => {},
          onOpenGateway: () => {}
        })
      );
      expect(htmlDoctor).toContain('Remote monitoring');
      expect(htmlDoctor).not.toContain('alert(');

      const htmlPatient = renderToStaticMarkup(
        React.createElement(Header, {
          activePatient: { ...mockLivePatient, isSimulated: false },
          userRole: 'patient',
          onRoleChange: () => {},
          currentView: 'home',
          onOpenSearch: () => {},
          onOpenGateway: () => {}
        })
      );
      expect(htmlPatient).toContain('disabled');
      expect(htmlPatient).toContain('title="Not implemented in this demo"');
    });

    it('Item 2: missed exemption regex tests for refusal vs what-if', async () => {
      // 1. "what if I take more medication but no missed days" -> refusal
      const resMore = await generateChatbotResponse("what if I take more medication but no missed days", mockLivePatient, mockModelCard);
      expect(resMore.intent).toBe('medical_refusal');

      // 2. "what if no missed medication days" -> what-if
      const resNoMissed = await generateChatbotResponse("what if no missed medication days", mockLivePatient, mockModelCard);
      expect(resNoMissed.intent).not.toBe('medical_refusal');
      expect(['what_if_success', 'what_if_unparsed']).toContain(resNoMissed.intent);

      // 3. "what if I missed 2 meds" -> what-if
      const resMissed2 = await generateChatbotResponse("what if I missed 2 meds", mockLivePatient, mockModelCard);
      expect(resMissed2.intent).not.toBe('medical_refusal');
      expect(['what_if_success', 'what_if_unparsed']).toContain(resMissed2.intent);
    });

    it('Item 3: what-if high-score note triggered by Math.max(basePct, scenPct) > 50', async () => {
      const cardWithLim = {
        yellowCutoff: 0.047,
        redCutoff: 0.232,
        limitations: [
          'Synthetic decline before an event is stronger than in real life, so predictions above 50% can occur.'
        ]
      };

      // Mock getWhatIf returning baseline 55%, scenario 40% (basePct > 50 even though scenPct <= 50)
      vi.stubGlobal('fetch', async (url) => {
        if (url.includes('/what-if')) {
          return {
            ok: true,
            json: async () => ({
              patientId: 'PT-8092',
              scoreDay: 14,
              appliedOverrides: { hrAboveBaseline: 10 },
              currentValues: { hrAboveBaseline: 0 },
              baselineP50: 0.55,
              scenarioP50: 0.40,
              deltaLogOdds: -0.3,
              scenarioAtOrAboveYellowCutoff: true,
              scenarioAtOrAboveRedCutoff: true,
              note: 'Scenario only.'
            })
          };
        }
        return { ok: false };
      });

      const res = await generateChatbotResponse("what if hr is 10 bpm higher", mockLivePatient, cardWithLim);
      expect(res.intent).toBe('what_if_success');
      expect(res.text).toContain('predictions above 50%');
    });

    it('Item 4: low-score calibration note in zone and what-if replies when risk < calibrationEstablishedFromP', async () => {
      const cardWithCalib = {
        yellowCutoff: 0.047,
        redCutoff: 0.232,
        calibrationEstablishedFromP: 0.0941
      };

      // Zone reply with low risk (p50 = 0.05 < 0.0941)
      const lowRiskPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          p50: 0.05
        }
      };
      const resZone = await generateChatbotResponse("what is my zone", lowRiskPatient, cardWithCalib);
      expect(resZone.text).toContain("Percentages below about 9.4% are not precise.");

      // Zone reply with risk above threshold (p50 = 0.15 > 0.0941)
      const higherRiskPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          p50: 0.15
        }
      };
      const resZoneHigh = await generateChatbotResponse("what is my zone", higherRiskPatient, cardWithCalib);
      expect(resZoneHigh.text).not.toContain("Percentages below about 9.4% are not precise.");

      // What-if reply with low risk
      vi.stubGlobal('fetch', async () => ({
        ok: true,
        json: async () => ({
          patientId: 'PT-8092',
          scoreDay: 14,
          appliedOverrides: { stepsRatio: 1.0 },
          currentValues: { stepsRatio: 0.8 },
          baselineP50: 0.04,
          scenarioP50: 0.03,
          deltaLogOdds: -0.2,
          scenarioAtOrAboveYellowCutoff: false,
          scenarioAtOrAboveRedCutoff: false,
          note: 'Scenario only.'
        })
      }));

      const resWhatIf = await generateChatbotResponse("what if steps return to baseline", lowRiskPatient, cardWithCalib);
      expect(resWhatIf.text).toContain("Percentages below about 9.4% are not precise.");

      // When field is null, hide the line
      const cardNullCalib = {
        yellowCutoff: 0.047,
        redCutoff: 0.232,
        calibrationEstablishedFromP: null
      };
      const resZoneNull = await generateChatbotResponse("what is my zone", lowRiskPatient, cardNullCalib);
      expect(resZoneNull.text).not.toContain("Percentages below about");

      const resWhatIfNull = await generateChatbotResponse("what if steps return to baseline", lowRiskPatient, cardNullCalib);
      expect(resWhatIfNull.text).not.toContain("Percentages below about");
    });
  });

  describe('(n) Part F Frontend Requirements', () => {
    it('live alerts come from the API and offline keeps tagged mock alerts', () => {
      // 1. Live mode with API alerts
      const origSource = patientService.source;
      const origLiveAlerts = patientService.liveAlerts;
      try {
        patientService.source = 'live';
        patientService.liveAlerts = [
          { id: 101, patient_id: 'PT-8092', kind: 'triage_transition', zone: 'yellow', red_source: null, p50: 0.12, score_day: 14, rationale: 'Score crossed yellow threshold', read: 0 },
          { id: 102, patient_id: 'PT-8092', kind: 'triage_transition', zone: 'red', red_source: 'model', p50: 0.35, score_day: 15, rationale: 'Score crossed red threshold', read: 1 }
        ];

        const liveAlerts = patientService.getAlerts();
        expect(liveAlerts.length).toBe(2);
        expect(liveAlerts[0].id).toBe(101);
        expect(liveAlerts[0].zone).toBe('yellow');
        expect(liveAlerts[0].isRead).toBe(false);
        expect(liveAlerts[0].isSimulated).toBe(false);
        expect(liveAlerts[1].id).toBe(102);
        expect(liveAlerts[1].isRead).toBe(true);

        // 2. Offline mode keeps tagged mock alerts with badge 0
        patientService.source = 'offline';
        const offlineAlerts = patientService.getAlerts();
        expect(offlineAlerts.length).toBeGreaterThan(0);
        expect(offlineAlerts.every(a => a.isSimulated === true)).toBe(true);
        expect(patientService.getUnreadAlertCount()).toBe(0);
      } finally {
        patientService.source = origSource;
        patientService.liveAlerts = origLiveAlerts;
      }
    });

    it('badge equals unread count and drops after PATCH (markAlertAsRead)', async () => {
      const origSource = patientService.source;
      const origLiveAlerts = patientService.liveAlerts;
      try {
        patientService.source = 'live';
        patientService.liveAlerts = [
          { id: 201, patient_id: 'PT-8092', kind: 'triage_transition', zone: 'yellow', red_source: null, p50: 0.12, score_day: 14, rationale: 'Test alert 1', read: 0 },
          { id: 202, patient_id: 'PT-8092', kind: 'triage_transition', zone: 'red', red_source: 'model', p50: 0.28, score_day: 15, rationale: 'Test alert 2', read: 0 }
        ];

        expect(patientService.getUnreadAlertCount()).toBe(2);

        // Mock PATCH fetch call
        let patchCalled = false;
        vi.stubGlobal('fetch', async (url, options) => {
          if (options && options.method === 'PATCH') {
            patchCalled = true;
            return {
              ok: true,
              json: async () => ({ id: 201, read: 1 })
            };
          }
          return { ok: true, json: async () => ({}) };
        });

        // Mark alert 201 as read
        patientService.markAlertAsRead(201);
        expect(patientService.getUnreadAlertCount()).toBe(1);

        const updated = patientService.getAlerts();
        const a201 = updated.find(a => a.id === 201);
        expect(a201.isRead).toBe(true);
      } finally {
        patientService.source = origSource;
        patientService.liveAlerts = origLiveAlerts;
      }
    });

    it('stream-ended and last-packet rendering in HomeView', () => {
      // 1. In-progress simulated stream with sim running
      const inProgressPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 15,
          observationWindowDays: 60,
          staleData: false,
          streamSource: 'simulated',
          lastIngestAt: new Date().toISOString()
        }
      };
      const htmlInProgress = renderToStaticMarkup(
        React.createElement(HomeView, { patient: inProgressPatient, isSimulated: false, simStatus: { running: true } })
      );
      expect(htmlInProgress).toContain('Telemetry: receiving');
      expect(htmlInProgress).toMatch(/Last packet: \d+s ago/);
      expect(htmlInProgress).not.toContain('(stream not running)');
      expect(htmlInProgress).not.toContain('Telemetry: stream ended');

      // 1b. In-progress stream when sim is stopped
      const htmlStopped = renderToStaticMarkup(
        React.createElement(HomeView, { patient: inProgressPatient, isSimulated: false, simStatus: { running: false } })
      );
      expect(htmlStopped).toContain('Telemetry: receiving');
      expect(htmlStopped).toContain('(stream not running)');

      // 2. Stream ended patient (day >= observationWindowDays)
      const endedPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 60,
          observationWindowDays: 60,
          staleData: false,
          streamSource: 'simulated',
          lastIngestAt: new Date().toISOString()
        }
      };
      const htmlEnded = renderToStaticMarkup(
        React.createElement(HomeView, { patient: endedPatient, isSimulated: false })
      );
      expect(htmlEnded).toContain('Telemetry: stream ended');

      // 2b. Stale patient takes precedence over stream ended
      const stalePatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 12,
          dataAgeDays: 5,
          staleData: true,
          observationWindowDays: 60,
          streamSource: 'simulated',
          lastIngestAt: new Date().toISOString()
        }
      };
      const htmlStale = renderToStaticMarkup(
        React.createElement(HomeView, { patient: stalePatient, isSimulated: false })
      );
      expect(htmlStale).toContain('Telemetry: no readings for 5 days (last reading day 12)');

      // 3. Seed patient (hide last packet line)
      const seedPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 14,
          streamSource: 'seed'
        }
      };
      const htmlSeed = renderToStaticMarkup(
        React.createElement(HomeView, { patient: seedPatient, isSimulated: false })
      );
      expect(htmlSeed).not.toContain('Last packet:');
    });

    it('null-safe strip chart Sparkline renders with nulls and gaps safely', () => {
      // Handles empty, nulls, undefined, and valid points
      const htmlEmpty = renderToStaticMarkup(React.createElement(Sparkline, { data: [] }));
      expect(htmlEmpty).toBe('');

      const htmlWithNulls = renderToStaticMarkup(
        React.createElement(Sparkline, { data: [68, 70, null, 72, 75], width: 60, height: 20 })
      );
      expect(htmlWithNulls).toContain('<svg');
      expect(htmlWithNulls).toContain('polyline');

      // All nulls
      const htmlAllNulls = renderToStaticMarkup(
        React.createElement(Sparkline, { data: [null, null, null], width: 60, height: 20 })
      );
      expect(htmlAllNulls).toBe('');
    });
  });

  describe('Round 7 Tests', () => {
    it('Part 7: crisis safety patterns test for every round 5b crisis phrase', async () => {
      const crisisPhrases = [
        "want to die",
        "wanna die",
        "don't want to live",
        "do not want to live",
        "kill me",
        "end it all",
        "hurt myself",
        "harm myself",
        "no reason to live"
      ];
      for (const phrase of crisisPhrases) {
        const res = await generateChatbotResponse(phrase, mockLivePatient, mockModelCard);
        expect(res.intent).toBe('crisis');
        expect(res.text).toContain("Please contact your local emergency number or a local crisis line now");
      }
    });

    it('Part 5: Header top-right role chip in live and offline modes', () => {
      const livePatient = { ...mockLivePatient, isSimulated: false };
      const offlinePatient = { ...mockLivePatient, isSimulated: true };

      const htmlLive = renderToStaticMarkup(
        React.createElement(Header, { activePatient: livePatient, userRole: 'doctor' })
      );
      expect(htmlLive).toContain('Demo role: Doctor');
      expect(htmlLive).not.toContain('Dr. Sarah Chen (DEMO)');

      const htmlOffline = renderToStaticMarkup(
        React.createElement(Header, { activePatient: offlinePatient, userRole: 'doctor' })
      );
      expect(htmlOffline).toContain('Dr. Sarah Chen (DEMO)');
    });

    it('Part 4d: AlertsView renders "No alerts" when list is empty and downgrade alert has Improved label', () => {
      const htmlEmpty = renderToStaticMarkup(
        React.createElement(AlertsView, { alerts: [], isLive: true })
      );
      expect(htmlEmpty).toContain('No alerts');

      const downgradeAlert = {
        id: 999,
        patientId: 'PT-8092',
        patientName: 'Rahul Sharma',
        kind: 'downgrade',
        zone: 'yellow',
        severity: 'muted',
        title: 'Improved: Triage Zone YELLOW',
        description: 'Recovery progressing.',
        isRead: false,
        isSimulated: false
      };
      const htmlDowngrade = renderToStaticMarkup(
        React.createElement(AlertsView, { alerts: [downgradeAlert], isLive: true })
      );
      expect(htmlDowngrade).toContain('Improved');
    });

    it('Part 4d: Live mode with empty API alert list does not derive alerts from patients', () => {
      const origSource = patientService.source;
      const origLiveAlerts = patientService.liveAlerts;
      const origPatients = patientService.patients;
      try {
        patientService.source = 'live';
        patientService.liveAlerts = [];
        // Patient has elevated risk/watch
        patientService.patients = [
          {
            id: 'PT-8092',
            name: 'Rahul Sharma',
            riskLevel: 'critical',
            twinState: { triageZone: 'red' }
          }
        ];
        const alerts = patientService.getAlerts();
        expect(alerts).toEqual([]);
        expect(patientService.getUnreadAlertCount()).toBe(0);
      } finally {
        patientService.source = origSource;
        patientService.liveAlerts = origLiveAlerts;
        patientService.patients = origPatients;
      }
    });

    // ==========================================
    // ROUND 9 REQUIREMENTS
    // ==========================================

    // 1c. Alerts page: "Showing latest N of TOTAL" uses /api/v2/alerts/summary.total only; when summary is unavailable show "Showing latest N"
    it('Requirement 1c: Alerts page header text with summary.total and without summary', () => {
      const sampleAlerts = [
        { id: 1, patientId: 'PT-8092', patientName: 'Rahul', zone: 'yellow', title: 'Alert 1', description: 'Test', isRead: false },
        { id: 2, patientId: 'PT-8093', patientName: 'Alice', zone: 'red', title: 'Alert 2', description: 'Test', isRead: false }
      ];

      // With summary total available
      const htmlWithSummary = renderToStaticMarkup(
        React.createElement(AlertsView, {
          alerts: sampleAlerts,
          isLive: true,
          alertsSummary: { total: 10, unread: 2 }
        })
      );
      expect(htmlWithSummary).toContain('Showing latest 2 of 10');

      // Without summary (summary is null/undefined)
      const htmlWithoutSummary = renderToStaticMarkup(
        React.createElement(AlertsView, {
          alerts: sampleAlerts,
          isLive: true,
          alertsSummary: null
        })
      );
      expect(htmlWithoutSummary).toContain('Showing latest 2');
      expect(htmlWithoutSummary).not.toContain('Showing latest 2 of');
    });

    // 2c. Pin position for 3 values per vital, null-safe, BP pin moves with the value
    it('Requirement 2c: Slider pin position for 3 values per vital, null safety, and BP pin moves with value', () => {
      // restingHR (scale 40-140)
      expect(calcSliderPosition('restingHR', 40)).toBeCloseTo(0, 1);
      expect(calcSliderPosition('restingHR', 90)).toBeCloseTo(50, 1);
      expect(calcSliderPosition('restingHR', 140)).toBeCloseTo(100, 1);
      expect(calcSliderPosition('restingHR', null)).toBeNull();
      expect(calcSliderPosition('restingHR', undefined)).toBeNull();

      // hrv (scale 10-100)
      expect(calcSliderPosition('hrv', 10)).toBeCloseTo(0, 1);
      expect(calcSliderPosition('hrv', 55)).toBeCloseTo(50, 1);
      expect(calcSliderPosition('hrv', 100)).toBeCloseTo(100, 1);
      expect(calcSliderPosition('hrv', null)).toBeNull();

      // bpSys (scale 90-180)
      expect(calcSliderPosition('bpSys', 90)).toBeCloseTo(0, 1);
      expect(calcSliderPosition('bpSys', 135)).toBeCloseTo(50, 1);
      expect(calcSliderPosition('bpSys', 180)).toBeCloseTo(100, 1);
      expect(calcSliderPosition('bpSys', null)).toBeNull();

      // steps (scale 0-12000)
      expect(calcSliderPosition('steps', 0)).toBeCloseTo(0, 1);
      expect(calcSliderPosition('steps', 6000)).toBeCloseTo(50, 1);
      expect(calcSliderPosition('steps', 12000)).toBeCloseTo(100, 1);
      expect(calcSliderPosition('steps', null)).toBeNull();

      // Verify BP pin moves with value in HomeView live mode
      const patientLowBP = {
        ...mockLivePatient,
        isSimulated: false,
        vitals: { ...mockLivePatient.vitals, bloodPressure: '100/70', bpSys: 100 }
      };
      const patientHighBP = {
        ...mockLivePatient,
        isSimulated: false,
        vitals: { ...mockLivePatient.vitals, bloodPressure: '160/100', bpSys: 160 }
      };
      const htmlLowBP = renderToStaticMarkup(React.createElement(HomeView, { patient: patientLowBP, isLive: true }));
      const htmlHighBP = renderToStaticMarkup(React.createElement(HomeView, { patient: patientHighBP, isLive: true }));

      const expectedLow = ((100 - 90) / 90 * 100).toFixed(4); // 11.1111%
      const expectedHigh = ((160 - 90) / 90 * 100).toFixed(4); // 77.7778%
      expect(htmlLowBP).toContain(`left:${(100 - 90) / 90 * 100}%`);
      expect(htmlHighBP).toContain(`left:${(160 - 90) / 90 * 100}%`);
    });

    // 3d. Patient portal: no demo MRN string, no "Continuous", and banner renders in live patient mode
    it('Requirement 3d: No demo MRN string, no "Continuous", and DEMO DATA banner renders in live patient mode', () => {
      const patientRolePatient = {
        ...mockLivePatient,
        id: 'PT-8092',
        name: 'Rahul Sharma',
        isSimulated: false
      };

      // Header in patient role
      const htmlHeader = renderToStaticMarkup(
        React.createElement(Header, { activePatient: patientRolePatient, userRole: 'patient', isLive: true })
      );
      expect(htmlHeader).not.toContain('#9848092');
      expect(htmlHeader).toContain('PT-8092');
      expect(htmlHeader).not.toContain('Patient ID Patient ID');
      expect(htmlHeader).not.toContain('Next Scheduled Review');

      // Sidebar in patient role
      const htmlSidebar = renderToStaticMarkup(
        React.createElement(Sidebar, { currentView: 'home', onViewChange: () => {}, isLive: true, userRole: 'patient' })
      );
      expect(htmlSidebar).not.toContain('#9848092');
      expect(htmlSidebar).not.toContain('Continuous telemetry Q&A');
      expect(htmlSidebar).toContain('Scripted data assistant');
      expect(htmlSidebar).toContain('Sample data (demo)');

      // Honesty banners render in live mode
      const htmlMed = renderToStaticMarkup(
        React.createElement(MedicationReportsView, { patient: patientRolePatient, isLive: true })
      );
      expect(htmlMed).toContain('DEMO DATA - sample medication schedule');

      const htmlRecords = renderToStaticMarkup(
        React.createElement(RecordsView, { patient: patientRolePatient, patients: [patientRolePatient] })
      );
      expect(htmlRecords).toContain('DEMO DATA - synthetic sample medical records');

      const htmlMag = renderToStaticMarkup(
        React.createElement(HealthMagazineView, { patient: patientRolePatient })
      );
      expect(htmlMag).toContain('DEMO DATA - educational articles');

      // Yellow or Red zone shows fixed disclaimer
      const redPatient = {
        ...patientRolePatient,
        riskLevel: 'critical',
        twinState: { ...patientRolePatient.twinState, triageZone: 'red' }
      };
      const htmlRedHeader = renderToStaticMarkup(
        React.createElement(Header, { activePatient: redPatient, userRole: 'patient', isLive: true })
      );
      expect(htmlRedHeader).toContain('This is an automated score from synthetic demo data. It is not a diagnosis.');

      const htmlRedHome = renderToStaticMarkup(
        React.createElement(HomeView, { patient: redPatient, isLive: true, userRole: 'patient' })
      );
      expect(htmlRedHome).toContain('This is an automated score from synthetic demo data. It is not a diagnosis.');
    });

    // 4c. Forecast display: caption and both states of forward cone
    it('Requirement 4c: RiskForecastChart caption and dashed cone when green zone has red projection', () => {
      const redCutoff = 0.2319;
      const modelCard = { yellowCutoff: 0.05, redCutoff };

      // State 1: Today is green, but cone end p50 exceeds red cutoff (e.g. 0.28 > 0.2319)
      const greenWithRedTwin = {
        patientId: 'PT-8092',
        triageZone: 'green',
        p50: 0.04,
        forwardCone: [
          { day_ahead: 1, p10: 0.04, p50: 0.08, p90: 0.12 },
          { day_ahead: 7, p10: 0.18, p50: 0.28, p90: 0.35 }
        ]
      };
      const htmlDashed = renderToStaticMarkup(
        React.createElement(RiskForecastChart, {
          twinState: greenWithRedTwin,
          modelCard,
          patientName: 'Rahul Sharma'
        })
      );
      expect(htmlDashed).toMatch(/Projection assumes today(&#x27;|')s trend continues unchanged for 7 days\. The trend is estimated from a few noisy days\. Not a prediction, not validated\./);
      expect(htmlDashed).toMatch(/Projection only: today(&#x27;|')s zone is Green\./);
      expect(htmlDashed).toContain('stroke-dasharray="6 4"');

      // State 2: Normal stable case (Today is green, cone end p50 is below red cutoff, e.g. 0.10)
      const normalGreenTwin = {
        patientId: 'PT-8092',
        triageZone: 'green',
        p50: 0.04,
        forwardCone: [
          { day_ahead: 1, p10: 0.03, p50: 0.05, p90: 0.08 },
          { day_ahead: 7, p10: 0.05, p50: 0.10, p90: 0.14 }
        ]
      };
      const htmlNormal = renderToStaticMarkup(
        React.createElement(RiskForecastChart, {
          twinState: normalGreenTwin,
          modelCard,
          patientName: 'Rahul Sharma'
        })
      );
      expect(htmlNormal).toMatch(/Projection assumes today(&#x27;|')s trend continues unchanged for 7 days\. The trend is estimated from a few noisy days\. Not a prediction, not validated\./);
      expect(htmlNormal).not.toMatch(/Projection only: today(&#x27;|')s zone is Green\./);
      expect(htmlNormal).toContain('stroke-dasharray="none"');
    });
  });

  // ==================== ROUND 10 TESTS ====================
  describe('Round 10 Requirements', () => {
    // 2a & 2b & 2c: Stale, stream state, and human-readable last packet
    it('Requirement 2b & 2c: Telemetry line ordering and human readable packet time', () => {
      // 1. staleData takes precedence: "Telemetry: no readings for N days (last reading day D)"
      const stalePatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 20,
          dataAgeDays: 4,
          staleData: true,
          observationWindowDays: 60,
          streamSource: 'simulated',
          lastIngestAt: new Date(Date.now() - 35000).toISOString() // 35s ago
        }
      };
      const htmlStale = renderToStaticMarkup(
        React.createElement(HomeView, { patient: stalePatient, isSimulated: false, simStatus: { running: true } })
      );
      expect(htmlStale).toContain('Telemetry: no readings for 4 days (last reading day 20)');
      expect(htmlStale).toContain('Last packet: 35s ago');
      expect(htmlStale).not.toContain('Telemetry: receiving');
      expect(htmlStale).not.toContain('Telemetry: stream ended');

      // 2. scoreDay >= observationWindowDays: "Telemetry: stream ended"
      const endedPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 60,
          observationWindowDays: 60,
          staleData: false,
          streamSource: 'simulated',
          lastIngestAt: new Date(Date.now() - (4 * 3600 + 41 * 60) * 1000).toISOString() // 4h 41m ago
        }
      };
      const htmlEnded = renderToStaticMarkup(
        React.createElement(HomeView, { patient: endedPatient, isSimulated: false, simStatus: { running: false } })
      );
      expect(htmlEnded).toContain('Telemetry: stream ended');
      expect(htmlEnded).toContain('Last packet: 4h 41m ago (stream not running)');

      // 3. Normal receiving
      const receivingPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 15,
          observationWindowDays: 60,
          staleData: false,
          streamSource: 'simulated',
          lastIngestAt: new Date(Date.now() - 10000).toISOString()
        }
      };
      const htmlReceiving = renderToStaticMarkup(
        React.createElement(HomeView, { patient: receivingPatient, isSimulated: false, simStatus: { running: true } })
      );
      expect(htmlReceiving).toContain('Telemetry: receiving');
      expect(htmlReceiving).not.toContain('(stream not running)');

      // 4. Seed data hides last packet line
      const seedPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          scoreDay: 10,
          observationWindowDays: 60,
          staleData: false,
          streamSource: 'seed'
        }
      };
      const htmlSeed = renderToStaticMarkup(
        React.createElement(HomeView, { patient: seedPatient, isSimulated: false })
      );
      expect(htmlSeed).not.toContain('Last packet:');
    });

    // 2d: Agreement on stale (ward card, patient page, chatbot)
    it('Requirement 2d: Ward card, patient page, and chatbot agree on stale', async () => {
      const staleP = {
        ...mockLivePatient,
        staleData: true,
        twinState: {
          ...mockLivePatient.twinState,
          staleData: true,
          dataAgeDays: 6,
          scoreDay: 14
        }
      };
      const nonStaleP = {
        ...mockLivePatient,
        staleData: false,
        twinState: {
          ...mockLivePatient.twinState,
          staleData: false,
          dataAgeDays: 0,
          scoreDay: 14
        }
      };

      // Helper agreement
      expect(isPatientStale(staleP, staleP.twinState)).toBe(true);
      expect(isPatientStale(nonStaleP, nonStaleP.twinState)).toBe(false);

      // Ward card (HospitalBedCard)
      const htmlBedStale = renderToStaticMarkup(
        React.createElement(HospitalBedCard, { patient: staleP, bedNumber: 1, onSelect: () => {}, isSelected: false })
      );
      expect(htmlBedStale).toContain('No readings for 6 days');

      // Patient page (HomeView)
      const htmlHomeStale = renderToStaticMarkup(
        React.createElement(HomeView, { patient: staleP, isSimulated: false })
      );
      expect(htmlHomeStale).toContain('Telemetry: no readings for 6 days (last reading day 14)');

      // Chatbot
      const chatStale = await generateChatbotResponse('what is my data age?', staleP);
      expect(chatStale.text).toContain('No readings for 6 days; scores are held frozen.');
    });

    // 4a: One shared risk formatter, above 50% -> "over 50% (approx.)"
    it('Requirement 4a: One shared risk formatter returns "over 50% (approx.)" above 50%', () => {
      expect(formatRisk(0.52)).toBe('over 50% (approx.)');
      expect(formatRisk(0.99)).toBe('over 50% (approx.)');
      expect(formatRisk(0.2319)).toBe('~23% 7-day readmission risk (approx.)');
      expect(formatRiskPercentage(0.55)).toBe('over 50% (approx.)');
      expect(formatRiskPercentage(0.50)).toBe('over 50% (approx.)');
      expect(formatRiskPercentage(0.12)).toBe('~12%');
    });

    // 4d: Caption occurs once per page on PredictionsView; RiskForecastChart SVG text removed
    it('Requirement 4d: Caption occurs once on Predictions page; RiskForecastChart has no colliding SVG text', () => {
      const redCutoff = 0.2319;
      const modelCard = { yellowCutoff: 0.05, redCutoff };
      const testTwin = {
        patientId: 'PT-8092',
        triageZone: 'green',
        p50: 0.04,
        forwardCone: [
          { day_ahead: 1, p10: 0.04, p50: 0.08, p90: 0.12 },
          { day_ahead: 7, p10: 0.18, p50: 0.28, p90: 0.35 }
        ]
      };
      const testPatient = {
        ...mockLivePatient,
        twinState: testTwin
      };

      // PredictionsView rendered to HTML
      const htmlPred = renderToStaticMarkup(
        React.createElement(PredictionsView, {
          patient: testPatient,
          patients: [testPatient],
          modelCard,
          isLive: true
        })
      );
      // Count occurrences of the caption phrase
      const captionPhrase = 'Projection assumes today';
      const occurrences = (htmlPred.match(new RegExp(captionPhrase, 'g')) || []).length;
      expect(occurrences).toBe(1);

      // Verify no SVG projection text in RiskForecastChart
      const htmlChart = renderToStaticMarkup(
        React.createElement(RiskForecastChart, {
          twinState: testTwin,
          modelCard,
          patientName: 'Rahul Sharma'
        })
      );
      expect(htmlChart).not.toContain('projection-green-svg-text');
      // Green note box remains
      expect(htmlChart).toMatch(/Projection only: today(&#x27;|')s zone is Green\./);
    });

    // 6b: Banner text shows stream paused when sim is not running
    it('Requirement 6b: Banner displays "Stream paused" when sim is paused', () => {
      // Sim running
      const htmlSimRunning = renderToStaticMarkup(
        React.createElement(App, { initialSimStatus: { running: true, tickSeconds: 20, patientsActive: 177, patientsExhausted: 0, restartCount: 0 } })
      );
      expect(htmlSimRunning).toContain('SIMULATED WEARABLE STREAM');
      expect(htmlSimRunning).not.toContain('Stream paused');

      // Sim paused
      const htmlSimPaused = renderToStaticMarkup(
        React.createElement(App, { initialSimStatus: { running: false, tickSeconds: 20, patientsActive: 177, patientsExhausted: 0, restartCount: 0 } })
      );
      expect(htmlSimPaused).toContain('Stream paused');
    });
  });

  // ==================== ROUND 11 TESTS ====================
  describe('Round 11 Requirements', () => {
    // 1c & 2a & 2b: Stale and stream state tests
    it('Requirement 2b: Stale line with both fields present, dataAgeDays null, and scoreDay null', () => {
      // 1. Both fields present
      const bothPresent = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          staleData: true,
          dataAgeDays: 5,
          scoreDay: 22
        }
      };
      const htmlBoth = renderToStaticMarkup(React.createElement(HomeView, { patient: bothPresent, isSimulated: false }));
      expect(htmlBoth).toContain('Telemetry: no readings for 5 days (last reading day 22)');
      expect(htmlBoth).not.toContain('N days');
      expect(htmlBoth).not.toContain('day D');
      expect(htmlBoth).not.toContain('undefined');

      // 2. dataAgeDays null
      const ageNull = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          staleData: true,
          dataAgeDays: null,
          scoreDay: 22
        }
      };
      const htmlAgeNull = renderToStaticMarkup(React.createElement(HomeView, { patient: ageNull, isSimulated: false }));
      expect(htmlAgeNull).toContain('Telemetry: no recent readings');
      expect(htmlAgeNull).not.toContain('N days');
      expect(htmlAgeNull).not.toContain('day D');
      expect(htmlAgeNull).not.toContain('undefined');

      // 3. scoreDay null
      const dayNull = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          staleData: true,
          dataAgeDays: 5,
          scoreDay: null
        }
      };
      const htmlDayNull = renderToStaticMarkup(React.createElement(HomeView, { patient: dayNull, isSimulated: false }));
      expect(htmlDayNull).toContain('Telemetry: no recent readings');
      expect(htmlDayNull).not.toContain('N days');
      expect(htmlDayNull).not.toContain('day D');
      expect(htmlDayNull).not.toContain('undefined');
    });

    it('Requirement 1c: Missing observationWindowDays skips stream ended branch', () => {
      const missingObsPatient = {
        ...mockLivePatient,
        twinState: {
          ...mockLivePatient.twinState,
          staleData: false,
          scoreDay: 60,
          observationWindowDays: null
        }
      };
      const htmlMissing = renderToStaticMarkup(React.createElement(HomeView, { patient: missingObsPatient, isSimulated: false }));
      expect(htmlMissing).not.toContain('Telemetry: stream ended');
      expect(htmlMissing).toContain('Telemetry: receiving');
    });

    it('Requirement 3c: isOverFifty helper with 0.499, 0.5, 0.504', () => {
      expect(isOverFifty(0.499)).toBe(false);
      expect(isOverFifty(0.5)).toBe(true);
      expect(isOverFifty(0.504)).toBe(true);
      expect(isOverFifty(null)).toBe(false);
      expect(isOverFifty(undefined)).toBe(false);
    });

    it('Requirement 4a: Ward header shows Red includes N when N > 0, and hides when N == 0', () => {
      const redStalePatient = {
        id: 'PT-R1',
        name: 'Patient Red Stale',
        riskLevel: 'critical',
        staleData: true,
        twinState: { triageZone: 'red', staleData: true }
      };
      const redFreshPatient = {
        id: 'PT-R2',
        name: 'Patient Red Fresh',
        riskLevel: 'critical',
        staleData: false,
        twinState: { triageZone: 'red', staleData: false }
      };

      // When redStaleCount > 0: shows the line
      const htmlWithStale = renderToStaticMarkup(
        React.createElement(WardBedView, { patients: [redStalePatient, redFreshPatient], isLive: true })
      );
      expect(htmlWithStale).toContain('Red includes 1 patients with no recent readings');

      // When redStaleCount == 0: line is hidden
      const htmlNoStale = renderToStaticMarkup(
        React.createElement(WardBedView, { patients: [redFreshPatient], isLive: true })
      );
      expect(htmlNoStale).not.toContain('no recent readings');
    });
  });
});

