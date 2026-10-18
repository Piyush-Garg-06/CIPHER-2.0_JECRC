// Clinical and Wearable Mock Dataset for Cardiovascular Digital Twin
export const PATIENTS = [
  {
    id: "PT-8092",
    name: "Rahul Sharma",
    age: 52,
    gender: "Male",
    bloodGroup: "B+",
    weight: "78 kg",
    height: "176 cm",
    bmi: 25.2,
    riskLevel: "elevated", // 'stable' | 'elevated' | 'critical'
    riskScore: 0.042, // Normalized display score
    riskPercentage: 68,
    riskTrend: "increasing", // 'increasing' | 'stable' | 'decreasing'
    riskTrendValue: "+18%",
    lastUpdated: "2 min ago",
    lastSyncTimestamp: "2026-10-07 23:18:42 UTC",
    isSimulated: true,
    
    summaryText: "Risk increased primarily due to declining HRV (-18%) and reduced physical activity over the last 7 days with concurrent nocturnal sleep fragmentation.",
    clinicalHeadline: "Elevated predicted cardiovascular risk — autonomic recovery deficit detected.",

    vitals: {
      heartRate: 82,
      restingHR: 76,
      hrv: 42,
      hrvBaseline: 58,
      hrvChange7d: -18,
      bloodPressure: "138/88",
      bpCategory: "Stage 1 Hypertension",
      spo2: 97,
      respiratoryRate: 16,
      dailySteps: 3420,
      stepsBaseline: 7500,
      stepsChange7d: -42,
      activeMinutes: 18,
      sleepDisruptionScore: 68, // 0-100
      sleepHours: "5h 42m",
      deepSleepPercent: 12,
      bodyTemp: "36.8 °C",
      arterialStiffnessIndex: "8.4 m/s (Elevated)"
    },

    sparkline: [42, 45, 48, 50, 52, 58, 62, 65, 68],

    // Observed (14 days past) vs Predicted (14 days future) Risk Trajectory
    riskTrajectory: [
      { day: "D-14", observed: 0.18, expected: 0.16, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-12", observed: 0.19, expected: 0.16, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-10", observed: 0.22, expected: 0.17, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-8",  observed: 0.28, expected: 0.17, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-6",  observed: 0.36, expected: 0.18, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-4",  observed: 0.48, expected: 0.18, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-2",  observed: 0.59, expected: 0.18, predicted: null, lowerCI: null, upperCI: null },
      { day: "Today", observed: 0.68, expected: 0.18, predicted: 0.68, lowerCI: 0.62, upperCI: 0.74 },
      { day: "D+2",  observed: null, expected: 0.19, predicted: 0.72, lowerCI: 0.64, upperCI: 0.80 },
      { day: "D+4",  observed: null, expected: 0.19, predicted: 0.76, lowerCI: 0.67, upperCI: 0.85 },
      { day: "D+6",  observed: null, expected: 0.20, predicted: 0.79, lowerCI: 0.69, upperCI: 0.89 },
      { day: "D+8",  observed: null, expected: 0.20, predicted: 0.82, lowerCI: 0.71, upperCI: 0.93 },
      { day: "D+10", observed: null, expected: 0.20, predicted: 0.85, lowerCI: 0.73, upperCI: 0.97 },
      { day: "D+14", observed: null, expected: 0.21, predicted: 0.88, lowerCI: 0.75, upperCI: 1.00 }
    ],

    // Explainable AI Factor Contributions
    explainabilityFactors: [
      {
        id: "f1",
        factor: "HRV 7-Day Decline",
        contribution: 38,
        direction: "risk_increase",
        metric: "-18% vs Baseline (42 ms vs 58 ms)",
        category: "Autonomic Nervous System",
        description: "Significant decrease in parasympathetic tone and heart rate variability during nocturnal recovery."
      },
      {
        id: "f2",
        factor: "Physical Activity Drop",
        contribution: 26,
        direction: "risk_increase",
        metric: "3,420 steps/day (-42% deficit)",
        category: "Mobility & Lifestyle",
        description: "Prolonged sedentary duration and sharp drop in cardiovascular exertion below patient baseline."
      },
      {
        id: "f3",
        factor: "Sleep Fragmentation & REM Deficit",
        contribution: 18,
        direction: "risk_increase",
        metric: "68/100 Disruption (Deep sleep: 12%)",
        category: "Circadian Recovery",
        description: "Frequent micro-awakenings and elevated nocturnal heart rate (avg 72 BPM vs baseline 56 BPM)."
      },
      {
        id: "f4",
        factor: "Blood Pressure Elevation",
        contribution: 12,
        direction: "risk_increase",
        metric: "138/88 mmHg (Stage 1)",
        category: "Hemodynamics",
        description: "Sustained mild elevation above normal target (<120/80 mmHg)."
      },
      {
        id: "f5",
        factor: "Cardiovascular Medical History",
        contribution: 6,
        direction: "risk_increase",
        metric: "Prior HTN + Family CAD",
        category: "EHR Clinical History",
        description: "Baseline risk coefficient elevated due to first-degree maternal myocardial infarction history."
      }
    ],

    // Anatomical Hotspots Detailed Data
    hotspots: {
      heart: {
        name: "Cardiovascular Engine",
        status: "elevated",
        title: "Cardiac Rhythm & Autonomic State",
        metrics: [
          { label: "Heart Rate", value: "82 BPM", status: "elevated" },
          { label: "Resting HR", value: "76 BPM", status: "elevated" },
          { label: "HRV (rMSSD)", value: "42 ms", status: "elevated", note: "↓ 18% 7d" },
          { label: "QTc Interval", value: "418 ms", status: "stable" },
          { label: "Arrhythmia Burden", value: "0.2% PACs", status: "stable" }
        ],
        findings: "Sinus rhythm with mild resting tachycardia. Nighttime non-dipping pattern detected on continuous photoplethysmography.",
        recommendation: "Continuous Holter review recommended. Evaluate antihypertensive titration."
      },
      brain: {
        name: "Autonomic Nervous System & Sleep",
        status: "elevated",
        title: "Neuro-Cardiovascular Regulatory Balance",
        metrics: [
          { label: "Sympathovagal Balance (LF/HF)", value: "2.8", status: "elevated" },
          { label: "Sleep Disruption Score", value: "68 / 100", status: "elevated" },
          { label: "Deep Sleep Proportion", value: "12%", status: "elevated" },
          { label: "Stress Index", value: "High (74/100)", status: "elevated" }
        ],
        findings: "Predominance of sympathetic drive during rest cycles with inadequate parasympathetic recovery surge.",
        recommendation: "Screen for obstructive sleep apnea (OSA) or acute stress-mediated autonomic dysregulation."
      },
      lungs: {
        name: "Pulmonary & Oxygenation Efficiency",
        status: "stable",
        title: "Respiratory Gas Exchange",
        metrics: [
          { label: "SpO2 (Pulse Oximetry)", value: "97%", status: "stable" },
          { label: "Respiratory Rate", value: "16 br/min", status: "stable" },
          { label: "Hypoxic Index (ODI)", value: "3.2 / hr", status: "stable" }
        ],
        findings: "No significant desaturation events detected during sleep or daytime monitoring.",
        recommendation: "Maintain routine pulmonary wearable tracking."
      },
      vascular: {
        name: "Vascular & Arterial Hemodynamics",
        status: "elevated",
        title: "Pulse Wave Velocity & Resistance",
        metrics: [
          { label: "Blood Pressure", value: "138/88 mmHg", status: "elevated" },
          { label: "Pulse Pressure", value: "50 mmHg", status: "elevated" },
          { label: "Brachial-Ankle PWV", value: "8.4 m/s", status: "elevated" },
          { label: "Endothelial Function", value: "Borderline", status: "elevated" }
        ],
        findings: "Mild arterial stiffness progression consistent with untreated stage 1 systolic elevation.",
        recommendation: "Ambulatory 24-hour BP monitoring (ABPM) recommended."
      },
      activity: {
        name: "Musculoskeletal & Exertion Tracker",
        status: "elevated",
        title: "Continuous Biomechanical Activity",
        metrics: [
          { label: "Daily Step Count", value: "3,420 steps", status: "elevated", note: "42% below baseline" },
          { label: "Active Zone Minutes", value: "18 mins", status: "elevated" },
          { label: "Sedentary Time", value: "11.2 hrs/day", status: "elevated" },
          { label: "VO2 Max Estimate", value: "34 mL/kg/min", status: "stable" }
        ],
        findings: "Significant reduction in weekly physical output coinciding with fatigue reports.",
        recommendation: "Encourage gradual cardiac rehabilitation target (5,000+ steps/day)."
      },
      medication: {
        name: "Metabolic & Pharmacological Ledger",
        status: "stable",
        title: "Active Regimen & Adherence",
        metrics: [
          { label: "Amlodipine 5mg", value: "1x Daily (Adherence: 92%)", status: "stable" },
          { label: "Atorvastatin 20mg", value: "1x Nightly (Adherence: 88%)", status: "stable" },
          { label: "HbA1c", value: "5.7% (Normal)", status: "stable" },
          { label: "eGFR", value: "88 mL/min (Preserved)", status: "stable" }
        ],
        findings: "Pharmacotherapy adherence stable; no reported adverse drug events.",
        recommendation: "Review dosage optimization during upcoming clinical consultation."
      }
    },

    // Chronological Health Timeline Events
    timeline: [
      {
        id: "t1",
        date: "Sep 12, 2026",
        time: "09:30 AM",
        type: "ehr",
        title: "Routine Cardiology Outpatient Checkup",
        description: "Patient reported mild intermittent fatigue. Resting ECG normal sinus rhythm. Continued baseline statin and calcium channel blocker.",
        severity: "stable"
      },
      {
        id: "t2",
        date: "Sep 16, 2026",
        time: "11:45 PM",
        type: "wearable",
        title: "Activity Volume Dropped Below 4,000 Steps",
        description: "Daily steps declined by 42% relative to rolling 30-day baseline (3,420 vs 7,500 steps). Sedentary duration increased to 11.2 hours.",
        severity: "elevated"
      },
      {
        id: "t3",
        date: "Sep 18, 2026",
        time: "06:15 AM",
        type: "wearable",
        title: "Nocturnal HRV Decline Detected",
        description: "7-day rolling rMSSD HRV dropped from 58 ms to 42 ms (-18%). Elevated non-dipping nighttime heart rate observed.",
        severity: "elevated"
      },
      {
        id: "t4",
        date: "Sep 19, 2026",
        time: "08:00 AM",
        type: "prediction",
        title: "Digital Twin Cardiovascular Risk Shift: STABLE → ELEVATED",
        description: "Multi-factor ML risk index crossed clinical attention threshold (0.68 score, +18% 7-day velocity).",
        severity: "elevated"
      },
      {
        id: "t5",
        date: "Sep 20, 2026",
        time: "02:15 PM",
        type: "alert",
        title: "Care Team Early Warning Dispatched",
        description: "Automated decision-support notification routed to Dr. Sarah Chen (Cardiology Lead) for review.",
        severity: "elevated"
      }
    ],

    // Medical Records Vault Documents
    records: [
      {
        id: "rec-101",
        title: "24-Hour Ambulatory Holter ECG Analysis",
        category: "Clinical Reports",
        date: "Sep 14, 2026",
        facility: "Metro Heart Institute",
        doctor: "Dr. A. Verma, FACC",
        fileType: "PDF Report",
        summary: "Sinus rhythm with average HR of 78 BPM. 14 isolated premature atrial complexes. No sustained ventricular tachycardia or ischemic ST depressions.",
        tags: ["ECG", "Holter", "Electrophysiology"],
        content: `PATIENT: Rahul Sharma | ID: PT-8092 | DOB: 14-Aug-1974
RECORDING DURATION: 23 hrs 48 mins
MIN HR: 54 BPM (04:12 AM) | MAX HR: 114 BPM (06:45 PM) | AVG HR: 78 BPM
FINDINGS:
1. Baseline rhythm is Normal Sinus Rhythm.
2. Low burden supraventricular ectopy (<0.2%).
3. Autonomic spectral power demonstrates diminished high-frequency (HF) nocturnal surge, indicating reduced parasympathetic modulation.
CONCLUSION: Recommend autonomic tracking and blood pressure monitoring.`
      },
      {
        id: "rec-102",
        title: "Comprehensive Lipid & Metabolic Panel",
        category: "Lab Reports",
        date: "Sep 10, 2026",
        facility: "Quest Diagnostics Central Lab",
        doctor: "Dr. Sarah Chen, MD",
        fileType: "Lab Data",
        summary: "Total Cholesterol: 194 mg/dL, LDL-C: 112 mg/dL, HDL-C: 44 mg/dL, Triglycerides: 168 mg/dL, hs-CRP: 2.1 mg/L (Borderline inflammatory index).",
        tags: ["Lipids", "Biomarkers", "Metabolic"],
        content: `LAB RESULTS:
- Total Cholesterol: 194 mg/dL (Desirable: <200)
- LDL Cholesterol: 112 mg/dL (Target for moderate risk: <100)
- HDL Cholesterol: 44 mg/dL (Optimal: >40)
- Triglycerides: 168 mg/dL (Borderline high: 150-199)
- Fasting Glucose: 98 mg/dL (Normal: 70-99)
- High-Sensitivity CRP (hs-CRP): 2.1 mg/L (Average cardiovascular risk: 1.0-3.0)
- Serum Creatinine: 0.98 mg/dL | eGFR: 88 mL/min/1.73m²`
      },
      {
        id: "rec-103",
        title: "Transthoracic Echocardiogram (TTE)",
        category: "Imaging",
        date: "Aug 02, 2026",
        facility: "Advanced Cardiac Imaging Center",
        doctor: "Dr. K. Patel, MD",
        fileType: "Imaging Summary",
        summary: "Left Ventricular Ejection Fraction (LVEF): 58%. Mild concentric left ventricular hypertrophy. Grade 1 diastolic dysfunction.",
        tags: ["Echo", "Ultrasound", "LVEF"],
        content: `ECHOCARDIOGRAPHIC MEASUREMENTS:
- Left Ventricular Internal Diameter (Diastole): 4.8 cm
- Interventricular Septal Thickness: 1.2 cm (Mild LVH)
- Left Ventricular Ejection Fraction (LVEF): 58% (Preserved systolic function)
- Mitral E/A Ratio: 0.82 with E/e' of 9.4 (Grade 1 Diastolic Relaxation Abnormality)
- Aortic Valve: Trileaflet, no stenosis, trace regurgitation
- Pericardial Space: No effusion`
      },
      {
        id: "rec-104",
        title: "Cardiology Clinical Consultation Note",
        category: "Doctor Notes",
        date: "Jul 18, 2026",
        facility: "Cardiovascular Outpatient Clinic",
        doctor: "Dr. Sarah Chen, MD",
        fileType: "Clinical Note",
        summary: "Discussion of cardiovascular risk profile and wearable sync onboarding. Patient initiated on Amlodipine 5mg QD and Atorvastatin 20mg QHS.",
        tags: ["Consultation", "Care Plan"],
        content: `ASSESSMENT & PLAN:
52-year-old male with Stage 1 Hypertension and moderate Framingham risk score.
1. Blood Pressure: Suboptimally controlled at 138/88. Start Amlodipine 5mg daily.
2. Dyslipidemia: Continue Atorvastatin 20mg nightly.
3. Lifestyle: Target 30 mins moderate aerobic exercise 5x/week.
4. Digital Twin: Connected continuous photoplethysmography (PPG) wearable to track autonomic HRV trends.`
      }
    ]
  },

  {
    id: "PT-4421",
    name: "Eleanor Vance",
    age: 67,
    gender: "Female",
    bloodGroup: "A-",
    weight: "64 kg",
    height: "162 cm",
    bmi: 24.4,
    riskLevel: "critical",
    riskScore: 0.084,
    riskPercentage: 84,
    riskTrend: "increasing",
    riskTrendValue: "+32%",
    lastUpdated: "Just now",
    lastSyncTimestamp: "2026-10-07 23:19:10 UTC",
    isSimulated: true,

    summaryText: "Critical acute autonomic collapse with severe HRV reduction (-34%), nocturnal resting tachycardia (avg 94 BPM), and elevated inflammatory biomarkers.",
    clinicalHeadline: "High-risk cardiovascular alert — Immediate clinical review & telemetry recommended.",

    vitals: {
      heartRate: 104,
      restingHR: 94,
      hrv: 22,
      hrvBaseline: 48,
      hrvChange7d: -34,
      bloodPressure: "156/96",
      bpCategory: "Stage 2 Hypertension",
      spo2: 94,
      respiratoryRate: 20,
      dailySteps: 1890,
      stepsBaseline: 5200,
      stepsChange7d: -64,
      activeMinutes: 6,
      sleepDisruptionScore: 84,
      sleepHours: "4h 15m",
      deepSleepPercent: 6,
      bodyTemp: "37.2 °C",
      arterialStiffnessIndex: "11.2 m/s (High Risk)"
    },

    sparkline: [55, 58, 62, 70, 74, 78, 82, 84, 88],

    riskTrajectory: [
      { day: "D-14", observed: 0.32, expected: 0.30, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-10", observed: 0.40, expected: 0.30, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-6",  observed: 0.58, expected: 0.31, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-2",  observed: 0.74, expected: 0.31, predicted: null, lowerCI: null, upperCI: null },
      { day: "Today", observed: 0.84, expected: 0.32, predicted: 0.84, lowerCI: 0.79, upperCI: 0.91 },
      { day: "D+2",  observed: null, expected: 0.32, predicted: 0.89, lowerCI: 0.82, upperCI: 0.95 },
      { day: "D+6",  observed: null, expected: 0.33, predicted: 0.93, lowerCI: 0.85, upperCI: 0.98 },
      { day: "D+14", observed: null, expected: 0.34, predicted: 0.96, lowerCI: 0.88, upperCI: 1.00 }
    ],

    explainabilityFactors: [
      {
        id: "f1",
        factor: "Acute Autonomic Tone Collapse (HRV)",
        contribution: 44,
        direction: "risk_increase",
        metric: "22 ms (-34% severe suppression)",
        category: "Autonomic Nervous System",
        description: "Severe depression in heart rate variability reflecting sympathetic overactivity and diminished vagal protection."
      },
      {
        id: "f2",
        factor: "Resting Tachycardia & Arrhythmia Bursts",
        contribution: 24,
        direction: "risk_increase",
        metric: "Resting HR: 94 BPM (Peak 104 BPM)",
        category: "Hemodynamics",
        description: "Inappropriate sustained sinus tachycardia during quiescent sleep intervals."
      },
      {
        id: "f3",
        factor: "Prior Transient Ischemic Attack (TIA)",
        contribution: 18,
        direction: "risk_increase",
        metric: "2024 TIA + High hs-CRP (4.8 mg/L)",
        category: "Clinical History",
        description: "Established vascular vulnerability with active systemic inflammatory biomarker elevation."
      },
      {
        id: "f4",
        factor: "Stage 2 Hypertensive Excursion",
        contribution: 14,
        direction: "risk_increase",
        metric: "156/96 mmHg",
        category: "Hemodynamics",
        description: "Marked elevation above clinical safety thresholds."
      }
    ],

    hotspots: {
      heart: {
        name: "Cardiovascular Engine",
        status: "critical",
        title: "Tachycardic & High-Vulnerability State",
        metrics: [
          { label: "Heart Rate", value: "104 BPM", status: "critical" },
          { label: "Resting HR", value: "94 BPM", status: "critical" },
          { label: "HRV (rMSSD)", value: "22 ms", status: "critical", note: "↓ 34% severe" },
          { label: "QTc Interval", value: "442 ms", status: "elevated" },
          { label: "PAC/PVC Density", value: "3.4%", status: "elevated" }
        ],
        findings: "Sustained resting sinus tachycardia. Elevated premature beat density with blunted baroreflex sensitivity.",
        recommendation: "Immediate cardiology review. Consider 12-lead ECG and urgent telemetry evaluation."
      },
      brain: {
        name: "Autonomic Nervous System & Cerebrovascular",
        status: "critical",
        title: "Severe Sympathetic Hyperarousal",
        metrics: [
          { label: "LF/HF Ratio", value: "4.6", status: "critical" },
          { label: "Sleep Disruption", value: "84 / 100", status: "critical" },
          { label: "Prior Cerebrovascular Event", value: "TIA (2024)", status: "critical" }
        ],
        findings: "Autonomic decompensation with near-complete loss of nocturnal parasympathetic recovery.",
        recommendation: "Evaluate for acute systemic stressor, infection, or occult atrial arrhythmia."
      },
      lungs: {
        name: "Pulmonary & Respiratory",
        status: "elevated",
        title: "Subtle Tachypnea & Borderline SpO2",
        metrics: [
          { label: "SpO2", value: "94%", status: "elevated" },
          { label: "Respiratory Rate", value: "20 br/min", status: "elevated" }
        ],
        findings: "Mild nocturnal desaturations down to 91% noted.",
        recommendation: "Assess for fluid overload or early heart failure symptoms."
      },
      vascular: {
        name: "Vascular & Arterial Hemodynamics",
        status: "critical",
        title: "Severe Arterial Stiffness & HTN Excursion",
        metrics: [
          { label: "Blood Pressure", value: "156/96 mmHg", status: "critical" },
          { label: "Pulse Wave Velocity", value: "11.2 m/s", status: "critical" }
        ],
        findings: "High-risk vascular load with elevated cardiac afterload.",
        recommendation: "Prompt antihypertensive adjustment and telemetry."
      },
      activity: {
        name: "Activity Tracker",
        status: "critical",
        title: "Severe Mobility Impairment",
        metrics: [
          { label: "Daily Steps", value: "1,890 steps", status: "critical" },
          { label: "Active Minutes", value: "6 mins", status: "critical" }
        ],
        findings: "Marked decline in physical capacity over 72 hours.",
        recommendation: "Clinical evaluation for exertional dyspnea or acute decompensation."
      },
      medication: {
        name: "Medications Ledger",
        status: "elevated",
        title: "Cardiovascular Pharmacotherapy",
        metrics: [
          { label: "Losartan 50mg", value: "1x Daily", status: "stable" },
          { label: "Aspirin 81mg", value: "1x Daily", status: "stable" },
          { label: "Metoprolol 25mg", value: "1x Daily", status: "elevated", note: "Possible under-dosing" }
        ],
        findings: "Current beta-blocker dose may be insufficient for rate control.",
        recommendation: "Review dose titration with attending cardiologist."
      }
    },

    timeline: [
      {
        id: "t1",
        date: "Sep 20, 2026",
        time: "03:10 PM",
        type: "prediction",
        title: "CRITICAL Cardiovascular Trajectory Warning",
        description: "ML Risk model triggered Critical Threshold (Score: 0.84). High risk of decompensation within 14 days.",
        severity: "critical"
      },
      {
        id: "t2",
        date: "Sep 20, 2026",
        time: "03:12 PM",
        type: "alert",
        title: "Urgent Escalation: On-Call Cardiologist Paged",
        description: "Protocol Alpha-3 activated. Patient care team alerted for immediate clinical contact.",
        severity: "critical"
      }
    ],

    records: [
      {
        id: "rec-201",
        title: "Cardiac Biomarker & Troponin Panel",
        category: "Lab Reports",
        date: "Sep 18, 2026",
        facility: "University Hospital Pathology",
        doctor: "Dr. Sarah Chen, MD",
        fileType: "Lab Data",
        summary: "High-Sensitivity Troponin I: 18 ng/L (Borderline elevated), hs-CRP: 4.8 mg/L (High risk), NT-proBNP: 420 pg/mL.",
        tags: ["Troponin", "Biomarkers", "BNP"],
        content: `CRITICAL LAB FINDINGS:
- High-Sensitivity Cardiac Troponin I (hs-cTnI): 18 ng/L (Normal reference: <14 ng/L)
- NT-proBNP: 420 pg/mL (Upper normal: 300 pg/mL for age group)
- hs-CRP: 4.8 mg/L (Indicates active vascular inflammatory burden)
- Serum Potassium: 4.2 mmol/L | Sodium: 139 mmol/L`
      }
    ]
  },

  {
    id: "PT-1109",
    name: "David Miller",
    age: 44,
    gender: "Male",
    bloodGroup: "O+",
    weight: "72 kg",
    height: "179 cm",
    bmi: 22.5,
    riskLevel: "stable",
    riskScore: 0.012,
    riskPercentage: 12,
    riskTrend: "stable",
    riskTrendValue: "-2%",
    lastUpdated: "5 min ago",
    lastSyncTimestamp: "2026-10-07 23:15:00 UTC",
    isSimulated: true,

    summaryText: "All physiological parameters within optimal autonomic recovery baseline. Consistent aerobic activity and healthy circadian sleep architecture.",
    clinicalHeadline: "Stable cardiovascular profile — routine continuous monitoring active.",

    vitals: {
      heartRate: 64,
      restingHR: 58,
      hrv: 68,
      hrvBaseline: 65,
      hrvChange7d: +4,
      bloodPressure: "118/76",
      bpCategory: "Optimal Blood Pressure",
      spo2: 99,
      respiratoryRate: 14,
      dailySteps: 8740,
      stepsBaseline: 8500,
      stepsChange7d: +3,
      activeMinutes: 48,
      sleepDisruptionScore: 18,
      sleepHours: "7h 35m",
      deepSleepPercent: 24,
      bodyTemp: "36.6 °C",
      arterialStiffnessIndex: "6.2 m/s (Optimal)"
    },

    sparkline: [15, 14, 16, 13, 14, 12, 11, 13, 12],

    riskTrajectory: [
      { day: "D-14", observed: 0.14, expected: 0.13, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-8",  observed: 0.13, expected: 0.13, predicted: null, lowerCI: null, upperCI: null },
      { day: "Today", observed: 0.12, expected: 0.12, predicted: 0.12, lowerCI: 0.08, upperCI: 0.17 },
      { day: "D+6",  observed: null, expected: 0.12, predicted: 0.11, lowerCI: 0.07, upperCI: 0.16 },
      { day: "D+14", observed: null, expected: 0.11, predicted: 0.11, lowerCI: 0.06, upperCI: 0.15 }
    ],

    explainabilityFactors: [
      {
        id: "f1",
        factor: "Healthy Autonomic Modulation (HRV)",
        contribution: 40,
        direction: "risk_decrease",
        metric: "68 ms (+4% above baseline)",
        category: "Autonomic System",
        description: "Robust parasympathetic nocturnal recovery and high vagal tone."
      },
      {
        id: "f2",
        factor: "Consistent Daily Aerobic Volume",
        contribution: 30,
        direction: "risk_decrease",
        metric: "8,740 steps/day (48 active mins)",
        category: "Mobility",
        description: "Optimal cardiorespiratory fitness profile."
      },
      {
        id: "f3",
        factor: "Normotensive Hemodynamics",
        contribution: 30,
        direction: "risk_decrease",
        metric: "118/76 mmHg",
        category: "Hemodynamics",
        description: "Excellent vascular elasticity and low pulse pressure."
      }
    ],

    hotspots: {
      heart: {
        name: "Cardiovascular Engine",
        status: "stable",
        title: "Normal Sinus Rhythm & Optimal Vagal Tone",
        metrics: [
          { label: "Heart Rate", value: "64 BPM", status: "stable" },
          { label: "Resting HR", value: "58 BPM", status: "stable" },
          { label: "HRV (rMSSD)", value: "68 ms", status: "stable" }
        ],
        findings: "Optimal physiological recovery markers. No ectopic rhythms detected.",
        recommendation: "Continue standard continuous wearable telemetry."
      },
      brain: {
        name: "Autonomic System & Sleep",
        status: "stable",
        title: "Restorative Sleep Architecture",
        metrics: [
          { label: "Deep Sleep Proportion", value: "24%", status: "stable" },
          { label: "Sleep Quality Index", value: "92 / 100", status: "stable" }
        ],
        findings: "High quality nocturnal restoration.",
        recommendation: "Maintain sleep hygiene."
      },
      lungs: {
        name: "Pulmonary & Respiratory",
        status: "stable",
        title: "Optimal Oxygenation",
        metrics: [
          { label: "SpO2", value: "99%", status: "stable" },
          { label: "Respiratory Rate", value: "14 br/min", status: "stable" }
        ],
        findings: "Clear respiratory metrics.",
        recommendation: "Routine check."
      },
      vascular: {
        name: "Vascular System",
        status: "stable",
        title: "Optimal Elasticity",
        metrics: [
          { label: "Blood Pressure", value: "118/76 mmHg", status: "stable" },
          { label: "PWV", value: "6.2 m/s", status: "stable" }
        ],
        findings: "Arterial compliance within normal youth reference.",
        recommendation: "Routine check."
      },
      activity: {
        name: "Activity & Mobility",
        status: "stable",
        title: "High Aerobic Exertion",
        metrics: [
          { label: "Daily Steps", value: "8,740 steps", status: "stable" }
        ],
        findings: "High cardiovascular fitness level.",
        recommendation: "Continue regimen."
      },
      medication: {
        name: "Medication & Supplements",
        status: "stable",
        title: "Preventive Care",
        metrics: [
          { label: "Multivitamin", value: "Daily", status: "stable" }
        ],
        findings: "No prescription cardiovascular medications required.",
        recommendation: "Annual wellness check."
      }
    },

    timeline: [
      {
        id: "t1",
        date: "Sep 18, 2026",
        time: "08:00 AM",
        type: "wearable",
        title: "Cardiovascular Baseline Synchronization",
        description: "Optimal physiological parameters confirmed across all connected wearable streams.",
        severity: "stable"
      }
    ],

    records: [
      {
        id: "rec-301",
        title: "Annual Preventative Wellness Executive Health Screen",
        category: "Clinical Reports",
        date: "Jun 12, 2026",
        facility: "Apex Health Diagnostics",
        doctor: "Dr. Sarah Chen, MD",
        fileType: "PDF Report",
        summary: "Normal stress ECG, VO2 max 44 mL/kg/min, normal echocardiogram, zero coronary artery calcium score (CAC = 0).",
        tags: ["Wellness", "CAC Score", "Prevention"],
        content: `EXECUTIVE SUMMARY:
Zero coronary calcium score (CAC: 0). Stress treadmill test completed 12.8 METs without symptoms or ischemic ECG changes. Normal biomarker panel.`
      }
    ]
  },

  {
    id: "PT-6632",
    name: "Aisha Patel",
    age: 58,
    gender: "Female",
    bloodGroup: "O-",
    weight: "68 kg",
    height: "165 cm",
    bmi: 25.0,
    riskLevel: "elevated",
    riskScore: 0.054,
    riskPercentage: 54,
    riskTrend: "increasing",
    riskTrendValue: "+14%",
    lastUpdated: "12 min ago",
    lastSyncTimestamp: "2026-10-07 23:08:15 UTC",
    isSimulated: true,

    summaryText: "Reduced circadian HRV variability and elevated nocturnal resting heart rate with mild stage 1 hypertension elevation.",
    clinicalHeadline: "Elevated predicted cardiovascular risk — autonomic surveillance active.",

    vitals: {
      heartRate: 78,
      restingHR: 72,
      hrv: 38,
      hrvBaseline: 52,
      hrvChange7d: -14,
      bloodPressure: "132/84",
      bpCategory: "Stage 1 Hypertension",
      spo2: 98,
      respiratoryRate: 15,
      dailySteps: 4100,
      stepsBaseline: 6800,
      stepsChange7d: -28,
      activeMinutes: 22,
      sleepDisruptionScore: 58,
      sleepHours: "6h 10m",
      deepSleepPercent: 14,
      bodyTemp: "36.7 °C",
      arterialStiffnessIndex: "7.9 m/s"
    },

    sparkline: [35, 38, 42, 45, 48, 50, 52, 54, 54],

    riskTrajectory: [
      { day: "D-14", observed: 0.28, expected: 0.24, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-8",  observed: 0.38, expected: 0.25, predicted: null, lowerCI: null, upperCI: null },
      { day: "Today", observed: 0.54, expected: 0.25, predicted: 0.54, lowerCI: 0.48, upperCI: 0.61 },
      { day: "D+6",  observed: null, expected: 0.26, predicted: 0.62, lowerCI: 0.53, upperCI: 0.70 },
      { day: "D+14", observed: null, expected: 0.27, predicted: 0.67, lowerCI: 0.56, upperCI: 0.78 }
    ],

    explainabilityFactors: [
      {
        id: "f1",
        factor: "Nocturnal Heart Rate Elevation",
        contribution: 36,
        direction: "risk_increase",
        metric: "72 BPM (+10 BPM above nadir)",
        category: "Autonomic System",
        description: "Blunted nocturnal dip in resting pulse."
      },
      {
        id: "f2",
        factor: "HRV Suppression",
        contribution: 34,
        direction: "risk_increase",
        metric: "38 ms (-14% 7-day trend)",
        category: "Autonomic System",
        description: "Reduced parasympathetic reserve."
      },
      {
        id: "f3",
        factor: "Activity Deficit",
        contribution: 30,
        direction: "risk_increase",
        metric: "4,100 steps (-28% deficit)",
        category: "Mobility",
        description: "Drop in daily exertion volume."
      }
    ],

    hotspots: {
      heart: {
        name: "Cardiovascular Engine",
        status: "elevated",
        title: "Mild Autonomic Dysregulation",
        metrics: [
          { label: "Heart Rate", value: "78 BPM", status: "elevated" },
          { label: "Resting HR", value: "72 BPM", status: "elevated" },
          { label: "HRV", value: "38 ms", status: "elevated" }
        ],
        findings: "Elevated nocturnal pulse with reduced HRV recovery.",
        recommendation: "Follow-up telehealth consult."
      },
      brain: {
        name: "Autonomic & Sleep",
        status: "elevated",
        title: "Sleep Disruption",
        metrics: [{ label: "Sleep Disruption", value: "58 / 100", status: "elevated" }],
        findings: "Moderate nocturnal awakenings.",
        recommendation: "Review sleep hygiene."
      },
      lungs: {
        name: "Pulmonary",
        status: "stable",
        title: "Normal Ventilation",
        metrics: [{ label: "SpO2", value: "98%", status: "stable" }],
        findings: "Normal oxygen saturation.",
        recommendation: "Routine check."
      },
      vascular: {
        name: "Vascular",
        status: "elevated",
        title: "Stage 1 HTN",
        metrics: [{ label: "Blood Pressure", value: "132/84 mmHg", status: "elevated" }],
        findings: "Mild systolic elevation.",
        recommendation: "Monitor weekly home BP log."
      },
      activity: {
        name: "Activity",
        status: "elevated",
        title: "Reduced Mobility",
        metrics: [{ label: "Steps", value: "4,100 steps", status: "elevated" }],
        findings: "28% reduction in daily steps.",
        recommendation: "Cardio walking plan."
      },
      medication: {
        name: "Medications",
        status: "stable",
        title: "Active Regimen",
        metrics: [{ label: "Hydrochlorothiazide 12.5mg", value: "1x Daily", status: "stable" }],
        findings: "Adherence good.",
        recommendation: "Routine follow-up."
      }
    },

    timeline: [
      {
        id: "t1",
        date: "Sep 19, 2026",
        time: "10:15 AM",
        type: "prediction",
        title: "Cardiovascular Risk Score Elevated to 0.54",
        description: "7-day continuous wearable analysis flagged nocturnal tachycardia trends.",
        severity: "elevated"
      }
    ],

    records: [
      {
        id: "rec-401",
        title: "Standard 12-Lead Electrocardiogram",
        category: "Clinical Reports",
        date: "Aug 15, 2026",
        facility: "City Cardiology Center",
        doctor: "Dr. Sarah Chen, MD",
        fileType: "PDF Report",
        summary: "Normal sinus rhythm, heart rate 74 BPM, PR interval 156 ms, QRS duration 86 ms, no ST-T abnormalities.",
        tags: ["ECG", "Routine"],
        content: `STANDARD 12-LEAD ECG INTERPRETATION:
Normal sinus rhythm at 74 BPM. Normal axis. No ischemic ST changes.`
      }
    ]
  },

  {
    id: "PT-9938",
    name: "Marcus Thorne",
    age: 61,
    gender: "Male",
    bloodGroup: "AB+",
    weight: "82 kg",
    height: "182 cm",
    bmi: 24.8,
    riskLevel: "stable",
    riskScore: 0.019,
    riskPercentage: 19,
    riskTrend: "decreasing",
    riskTrendValue: "-8%",
    lastUpdated: "18 min ago",
    lastSyncTimestamp: "2026-10-07 23:01:00 UTC",
    isSimulated: true,

    summaryText: "Post-intervention stability; positive autonomic and hemodynamic response to lifestyle modification and ACE-inhibitor therapy.",
    clinicalHeadline: "Stable cardiovascular trajectory — post-rehab maintenance protocol.",

    vitals: {
      heartRate: 68,
      restingHR: 62,
      hrv: 61,
      hrvBaseline: 56,
      hrvChange7d: +8,
      bloodPressure: "122/80",
      bpCategory: "Normal Blood Pressure",
      spo2: 98,
      respiratoryRate: 15,
      dailySteps: 9200,
      stepsBaseline: 8000,
      stepsChange7d: +12,
      activeMinutes: 52,
      sleepDisruptionScore: 22,
      sleepHours: "7h 10m",
      deepSleepPercent: 21,
      bodyTemp: "36.6 °C",
      arterialStiffnessIndex: "6.8 m/s"
    },

    sparkline: [30, 28, 26, 24, 22, 21, 20, 19, 19],

    riskTrajectory: [
      { day: "D-14", observed: 0.32, expected: 0.30, predicted: null, lowerCI: null, upperCI: null },
      { day: "D-8",  observed: 0.24, expected: 0.23, predicted: null, lowerCI: null, upperCI: null },
      { day: "Today", observed: 0.19, expected: 0.19, predicted: 0.19, lowerCI: 0.14, upperCI: 0.24 },
      { day: "D+6",  observed: null, expected: 0.18, predicted: 0.17, lowerCI: 0.12, upperCI: 0.22 },
      { day: "D+14", observed: null, expected: 0.17, predicted: 0.16, lowerCI: 0.10, upperCI: 0.21 }
    ],

    explainabilityFactors: [
      {
        id: "f1",
        factor: "Positive Autonomic Rebound (HRV)",
        contribution: 45,
        direction: "risk_decrease",
        metric: "61 ms (+8% positive slope)",
        category: "Autonomic System",
        description: "Improved vagal tone following cardiac rehab completion."
      },
      {
        id: "f2",
        factor: "Excellent Mobility Adherence",
        contribution: 35,
        direction: "risk_decrease",
        metric: "9,200 steps/day",
        category: "Mobility",
        description: "Consistent daily aerobic exertion."
      },
      {
        id: "f3",
        factor: "Controlled Blood Pressure",
        contribution: 20,
        direction: "risk_decrease",
        metric: "122/80 mmHg",
        category: "Hemodynamics",
        description: "Well-tolerated Lisinopril therapy."
      }
    ],

    hotspots: {
      heart: {
        name: "Cardiovascular Engine",
        status: "stable",
        title: "Stable Sinus Rhythm",
        metrics: [
          { label: "Heart Rate", value: "68 BPM", status: "stable" },
          { label: "Resting HR", value: "62 BPM", status: "stable" },
          { label: "HRV", value: "61 ms", status: "stable" }
        ],
        findings: "Steady rhythm, excellent exercise tolerance.",
        recommendation: "Maintain routine follow-up in 3 months."
      },
      brain: {
        name: "Autonomic & Sleep",
        status: "stable",
        title: "Healthy Autonomic Tone",
        metrics: [{ label: "Sleep Quality", value: "88 / 100", status: "stable" }],
        findings: "Normal circadian restorative pattern.",
        recommendation: "Continue lifestyle habits."
      },
      lungs: {
        name: "Pulmonary",
        status: "stable",
        title: "Optimal Oxygenation",
        metrics: [{ label: "SpO2", value: "98%", status: "stable" }],
        findings: "Normal lung volumes and SpO2.",
        recommendation: "Routine check."
      },
      vascular: {
        name: "Vascular",
        status: "stable",
        title: "Controlled Hemodynamics",
        metrics: [{ label: "Blood Pressure", value: "122/80 mmHg", status: "stable" }],
        findings: "Optimal arterial compliance.",
        recommendation: "Continue Lisinopril 10mg."
      },
      activity: {
        name: "Activity",
        status: "stable",
        title: "High Aerobic Capacity",
        metrics: [{ label: "Steps", value: "9,200 steps", status: "stable" }],
        findings: "Excellent physical conditioning.",
        recommendation: "Continue daily walking & resistance."
      },
      medication: {
        name: "Medications",
        status: "stable",
        title: "Maintenance Pharmacotherapy",
        metrics: [{ label: "Lisinopril 10mg", value: "1x Daily", status: "stable" }],
        findings: "Good therapeutic response.",
        recommendation: "Annual renal panel."
      }
    },

    timeline: [
      {
        id: "t1",
        date: "Sep 15, 2026",
        time: "02:00 PM",
        type: "ehr",
        title: "Cardiac Rehabilitation Program Graduation",
        description: "Patient completed 12-week supervised cardiac wellness program with substantial functional improvement.",
        severity: "stable"
      }
    ],

    records: [
      {
        id: "rec-501",
        title: "Cardiac Rehab Functional Capacity Report",
        category: "Clinical Reports",
        date: "Sep 15, 2026",
        facility: "Metropolitan Wellness Institute",
        doctor: "Dr. Sarah Chen, MD",
        fileType: "PDF Report",
        summary: "Peak METs increased from 7.2 to 10.4. Resting HR reduced by 9 BPM. Excellent recovery index.",
        tags: ["Rehabilitation", "Exercise Physiology"],
        content: `REHABILITATION SUMMARY:
12-week maintenance protocol completed. Significant enhancement in heart rate recovery (HRR-1min: 28 BPM). Risk profile categorized as Low / Stable.`
      }
    ]
  }
];

// Demo Mode Simulation Steps (Judges Timeline Walkthrough)
export const DEMO_SIMULATION_STEPS = [
  {
    stepIndex: 0,
    dayLabel: "Day 1",
    title: "Baseline State • Optimal Recovery",
    riskLevel: "stable",
    riskScore: 0.012,
    riskPercentage: 12,
    heartRate: 64,
    hrv: 65,
    dailySteps: 8400,
    headline: "Patient baseline established. Autonomic tone and wearable vitals are within normal range.",
    actionPrompt: "Continuous baseline monitoring active. No intervention required."
  },
  {
    stepIndex: 1,
    dayLabel: "Day 5",
    title: "Activity Volume Drops Below Baseline",
    riskLevel: "stable",
    riskScore: 0.022,
    riskPercentage: 22,
    heartRate: 72,
    hrv: 58,
    dailySteps: 5100,
    headline: "Daily activity decreased by 38%. Sedentary intervals prolonged; sleep fragmentation onset.",
    actionPrompt: "Digital Twin flags subtle behavioral departure from expected baseline."
  },
  {
    stepIndex: 2,
    dayLabel: "Day 8",
    title: "Nocturnal HRV Suppression Detected",
    riskLevel: "elevated",
    riskScore: 0.038,
    riskPercentage: 38,
    heartRate: 76,
    hrv: 48,
    dailySteps: 4200,
    headline: "Rolling 7-day HRV dropped below clinical threshold. Non-dipping nighttime heart rate noted.",
    actionPrompt: "Sub-clinical autonomic imbalance detected prior to acute symptom onset."
  },
  {
    stepIndex: 3,
    dayLabel: "Day 10",
    title: "Multi-Factor Risk Curve Escalation",
    riskLevel: "elevated",
    riskScore: 0.051,
    riskPercentage: 51,
    heartRate: 80,
    hrv: 43,
    dailySteps: 3600,
    headline: "Wearable + EHR multi-factor ML model calculates 51% cardiovascular risk probability trajectory.",
    actionPrompt: "System identifies primary risk drivers: HRV decline (42%), activity drop (28%)."
  },
  {
    stepIndex: 4,
    dayLabel: "Day 12",
    title: "Amber Early Warning Threshold Triggered",
    riskLevel: "elevated",
    riskScore: 0.062,
    riskPercentage: 62,
    heartRate: 82,
    hrv: 39,
    dailySteps: 3200,
    headline: "Deviation from expected recovery exceeds 2.5 standard deviations. Clinical attention required.",
    actionPrompt: "Automated suggestion: Schedule expedited telehealth follow-up & review BP."
  },
  {
    stepIndex: 5,
    dayLabel: "Day 14",
    title: "High Risk Prediction & Clinical Care Loop",
    riskLevel: "critical",
    riskScore: 0.074,
    riskPercentage: 74,
    heartRate: 88,
    hrv: 31,
    dailySteps: 2800,
    headline: "High-risk cardiovascular event trajectory predicted without clinical intervention.",
    actionPrompt: "Care action loop dispatched to Dr. Sarah Chen. Early intervention prevents acute admission."
  }
];

// System-wide Global Alerts
export const INITIAL_ALERTS = [
  {
    id: "alt-1",
    patientId: "PT-4421",
    patientName: "Eleanor Vance",
    timestamp: "2 min ago",
    severity: "critical",
    title: "High-Risk Cardiovascular Prediction Generated",
    description: "Multi-parameter risk score jumped to 0.84 with acute HRV suppression (22 ms) and nocturnal tachycardia.",
    isRead: false,
    actionRequired: "Immediate Telemetry & Cardiology Escalation"
  },
  {
    id: "alt-2",
    patientId: "PT-8092",
    patientName: "Rahul Sharma",
    timestamp: "18 min ago",
    severity: "elevated",
    title: "7-Day Autonomic HRV Decline (-18%)",
    description: "Heart rate variability steadily declined from 58 ms to 42 ms with concurrent physical activity drop.",
    isRead: false,
    actionRequired: "Review Medication Adherence & Follow-Up"
  },
  {
    id: "alt-3",
    patientId: "PT-6632",
    patientName: "Aisha Patel",
    timestamp: "1 hr ago",
    severity: "elevated",
    title: "Resting Heart Rate Non-Dipping Pattern",
    description: "Nocturnal heart rate average remained elevated at 72 BPM over 3 consecutive nights.",
    isRead: true,
    actionRequired: "Review Sleep & Ambulatory BP"
  },
  {
    id: "alt-4",
    patientId: "PT-8092",
    patientName: "Rahul Sharma",
    timestamp: "3 hrs ago",
    severity: "stable",
    title: "Wearable Sync & Holter Report Linked",
    description: "Latest 24-hour ambulatory ECG report and biometric data successfully integrated into Digital Twin model.",
    isRead: true,
    actionRequired: "None (Synced)"
  }
];
