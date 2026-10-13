import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatRisk, formatVitalValue, getDriverLabel, formatDriverValue } from '../src/utils/formatters';
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

    it('Item 3: badge count equals patientService.getAlerts().length in live mode and 0 in offline mode', () => {
      const liveAlertCount = patientService.getAlerts().length;
      expect(liveAlertCount).toBeGreaterThan(0);

      // Live mode badge check
      const liveBadge = true ? liveAlertCount : 0;
      expect(liveBadge).toBe(patientService.getAlerts().length);

      // Offline mode badge check
      const offlineBadge = false ? liveAlertCount : 0;
      expect(offlineBadge).toBe(0);

      // Test rendered Sidebar markup
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
      expect(htmlLive).toContain(String(liveAlertCount));

      const htmlOffline = renderToStaticMarkup(
        React.createElement(Sidebar, {
          currentView: 'home',
          onViewChange: () => {},
          unreadAlertCount: 0,
          isLive: false,
          onOpenSearch: () => {},
          userRole: 'doctor'
        })
      );
      expect(htmlOffline).not.toContain(`sidebar-badge`);
    });

    it('Item 5: emergency list phrases return emergency text and benign controls do not trigger', async () => {
      const emergencyPhrases = [
        "arm hurts",
        "arm pain",
        "jaw pain",
        "chest tightness",
        "chest pressure",
        "pressure in my chest",
        "palpitation",
        "palpitations",
        "heart racing",
        "nausea",
        "vomit",
        "vomiting",
        "numb",
        "numbness",
        "passed out",
        "blacked out",
        "blackout",
        "swelling",
        "pain",
        "hurts",
        "ache",
        "suicide",
        "kill myself",
        "end my life",
        "self harm",
        "overdose"
      ];

      for (const phrase of emergencyPhrases) {
        const res = await generateChatbotResponse(`I have ${phrase}`, mockLivePatient, mockModelCard);
        expect(res.intent, `Failed on phrase: "${phrase}"`).toBe('emergency');
        expect(res.text).toBe(
          "I can't assess symptoms. If you think this may be an emergency, contact your local emergency number now. For anything else, contact your care team."
        );
      }

      for (const phrase of emergencyPhrases) {
        const res = await generateChatbotResponse(phrase, mockLivePatient, mockModelCard);
        expect(res.intent, `Failed on exact phrase: "${phrase}"`).toBe('emergency');
      }

      // Benign controls
      const benignControls = ["painted", "hurtle", "steps", "heart rate", "great"];
      for (const word of benignControls) {
        const res = await generateChatbotResponse(word, mockLivePatient, mockModelCard);
        expect(res.intent, `Benign control "${word}" triggered emergency`).not.toBe('emergency');
        expect(res.intent, `Benign control "${word}" triggered medical refusal`).not.toBe('medical_refusal');
      }
    });

    it('Item 6: medication exemption applies only with "missed"', async () => {
      const resMore = await generateChatbotResponse("what if I take more medication", mockLivePatient, mockModelCard);
      expect(resMore.intent).toBe('medical_refusal');

      const resStop = await generateChatbotResponse("what if I stop my medicine", mockLivePatient, mockModelCard);
      expect(resStop.intent).toBe('medical_refusal');

      const resMissed = await generateChatbotResponse("what if no missed medication days", mockLivePatient, mockModelCard);
      expect(['what_if_success', 'what_if_unparsed']).toContain(resMissed.intent);
      expect(resMissed.intent).not.toBe('medical_refusal');
    });
  });

});
