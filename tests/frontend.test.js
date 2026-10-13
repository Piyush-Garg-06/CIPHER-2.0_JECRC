import { describe, it, expect, beforeEach, vi } from 'vitest';
import { formatRisk, formatVitalValue, getDriverLabel, formatDriverValue } from '../src/utils/formatters';
import { 
  generateChatbotResponse, 
  parseWhatIfOverrides, 
  GLOSSARY,
  SUGGESTED_PROMPTS 
} from '../src/services/chatbotData';
import { fetchLivePatients } from '../src/services/patientService';

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
    rocAuc: { mean: 0.71, ci: [0.664, 0.754] },
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
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            patientId: 'PT-8092',
            scoreDay: 14,
            appliedOverrides: body.overrides || {},
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

  // (a) Live patients never contain mock-only fields
  describe('(a) Live patients isolation from mock-only fields', () => {
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

    it('parses "what if resting hr is 5 bpm lower"', () => {
      const overrides = parseWhatIfOverrides("what if resting hr is 5 bpm lower", mockLivePatient);
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

});
