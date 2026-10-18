// Medication, Lab Exams & Doctor Remarks Data
export const PATIENT_MEDICATIONS = {
  "PT-8092": {
    patientName: "Rahul Sharma",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 18, 2026",
    medications: [
      {
        id: "med-1",
        name: "Amlodipine Besylate",
        dosage: "5 mg",
        frequency: "Once Daily (Morning with breakfast)",
        timing: "08:00 AM",
        category: "Calcium Channel Blocker (Antihypertensive)",
        purpose: "Blood pressure regulation & vascular arterial resistance reduction",
        cautions: [
          "Do not skip morning dose even if BP feels normal",
          "Avoid grapefruit juice as it increases drug concentration",
          "Report any lower extremity or ankle swelling immediately"
        ],
        sideEffects: [
          { name: "Peripheral Edema (Ankle Swelling)", severity: "mild", callDoctor: true },
          { name: "Dizziness upon standing", severity: "mild", callDoctor: false },
          { name: "Flushing / Headache", severity: "rare", callDoctor: false }
        ],
        adherenceRate: 94
      },
      {
        id: "med-2",
        name: "Atorvastatin Calcium",
        dosage: "20 mg",
        frequency: "Once Daily (Night before sleep)",
        timing: "09:30 PM",
        category: "HMG-CoA Reductase Inhibitor (Statin)",
        purpose: "Plaque stabilization & LDL cholesterol reduction",
        cautions: [
          "Take consistently at bedtime for optimal hepatic lipid inhibition",
          "Avoid excessive alcohol consumption during therapy",
          "Notify care team if unexplained muscle pain or weakness occurs"
        ],
        sideEffects: [
          { name: "Myalgia (Muscle soreness)", severity: "moderate", callDoctor: true },
          { name: "Mild GI upset", severity: "mild", callDoctor: false },
          { name: "Elevated Liver Enzymes (AST/ALT)", severity: "rare", callDoctor: true }
        ],
        adherenceRate: 90
      },
      {
        id: "med-3",
        name: "CoQ10 (Ubiquinol) Supplement",
        dosage: "100 mg",
        frequency: "Once Daily (With lunch)",
        timing: "01:00 PM",
        category: "Cardiovascular Micronutrient",
        purpose: "Mitochondrial bioenergetics support alongside statin therapy",
        cautions: [
          "Take with dietary fats for optimal absorption",
          "Monitor for mild digestive sensitivity"
        ],
        sideEffects: [
          { name: "Mild stomach discomfort", severity: "rare", callDoctor: false }
        ],
        adherenceRate: 98
      }
    ],

    updatedReportSummary: [
      {
        id: "rep-1",
        examName: "24-Hour Ambulatory Holter ECG",
        date: "Sep 14, 2026",
        result: "Sinus rhythm (Avg 78 BPM). Nighttime non-dipping pulse observed.",
        status: "Elevated Concern",
        statusColor: "#b45309"
      },
      {
        id: "rep-2",
        examName: "Comprehensive Lipid & Biomarker Panel",
        date: "Sep 10, 2026",
        result: "Total Chol: 194 mg/dL, LDL-C: 112 mg/dL, hs-CRP: 2.1 mg/L (Borderline)",
        status: "Borderline",
        statusColor: "#b45309"
      },
      {
        id: "rep-3",
        examName: "Echocardiogram (LVEF)",
        date: "Aug 02, 2026",
        result: "LVEF 58% (Preserved). Mild left ventricular hypertrophy noted.",
        status: "Normal Preserved",
        statusColor: "#047857"
      },
      {
        id: "rep-4",
        examName: "Renal Function & eGFR Panel",
        date: "Jul 18, 2026",
        result: "Serum Creatinine 0.98 mg/dL, eGFR 88 mL/min (Normal preserved)",
        status: "Normal",
        statusColor: "#047857"
      }
    ],

    doctorRemarks: [
      {
        id: "rem-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 18, 2026",
        remark: "Patient's autonomic recovery is compromised with an 18% decline in nocturnal HRV over the past week. Amlodipine 5mg is maintaining daytime pressure below 140/90, but evening non-dipping pattern indicates high sympathetic tone. Maintain medication schedule strictly and follow 30-min walking routine."
      },
      {
        id: "rem-2",
        doctor: "Dr. Cam Williams, MD",
        role: "Attending Electrophysiologist",
        date: "Sep 15, 2026",
        remark: "No sustained tachyarrhythmias on Holter trace. PAC density remains below 0.2%. Prioritize sleep hygiene and avoid caffeine after 4 PM to support vagal restoration."
      }
    ]
  },

  "PT-4421": {
    patientName: "Eleanor Vance",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 22, 2026",
    medications: [
      {
        id: "med-vance-1",
        name: "Metoprolol Succinate ER",
        dosage: "50 mg",
        frequency: "Once Daily (Morning)",
        timing: "08:00 AM",
        category: "Beta-1 Selective Adrenergic Receptor Blocker",
        purpose: "Heart rate rate-control and nocturnal resting tachycardia suppression",
        cautions: [
          "Do not discontinue abruptly; may trigger rebound tachycardia",
          "Check pulse before administration; hold if HR < 55 BPM",
          "Report orthostatic dizziness or wheezing"
        ],
        sideEffects: [
          { name: "Bradycardia", severity: "moderate", callDoctor: true },
          { name: "Fatigue / Lethargy", severity: "mild", callDoctor: false },
          { name: "Cold extremities", severity: "mild", callDoctor: false }
        ],
        adherenceRate: 88
      },
      {
        id: "med-vance-2",
        name: "Lisinopril",
        dosage: "20 mg",
        frequency: "Once Daily (Morning with water)",
        timing: "08:30 AM",
        category: "ACE Inhibitor",
        purpose: "Blood pressure regulation & left ventricular cardiac remodeling protection",
        cautions: [
          "Avoid potassium supplements or high-potassium salt substitutes",
          "Monitor for persistent dry cough"
        ],
        sideEffects: [
          { name: "Persistent dry cough", severity: "mild", callDoctor: true },
          { name: "Dizziness", severity: "mild", callDoctor: false },
          { name: "Hyperkalemia", severity: "rare", callDoctor: true }
        ],
        adherenceRate: 92
      },
      {
        id: "med-vance-3",
        name: "Apixaban (Eliquis)",
        dosage: "5 mg",
        frequency: "Twice Daily (12h intervals)",
        timing: "09:00 AM / 09:00 PM",
        category: "Direct Oral Anticoagulant (DOAC)",
        purpose: "Secondary stroke prevention post-transient ischemic attack (TIA)",
        cautions: [
          "Take strictly on schedule without missing doses",
          "Report unusual bruising, bleeding gums, or dark stools immediately",
          "Avoid NSAIDs like ibuprofen without cardiology consult"
        ],
        sideEffects: [
          { name: "Epistaxis / Minor Bruising", severity: "mild", callDoctor: false },
          { name: "Gastrointestinal bleeding", severity: "rare", callDoctor: true }
        ],
        adherenceRate: 96
      }
    ],
    updatedReportSummary: [
      {
        id: "rep-vance-1",
        examName: "12-Lead Electrocardiogram & Telemetry",
        date: "Sep 22, 2026",
        result: "Sinus tachycardia at 104 BPM. Frequent premature atrial complexes.",
        status: "Critical Alert",
        statusColor: "#dc2626"
      },
      {
        id: "rep-vance-2",
        examName: "High-Sensitivity Cardiac Troponin I",
        date: "Sep 20, 2026",
        result: "18 ng/L (Upper normal <14 ng/L). Active myocardial micro-strain.",
        status: "Elevated Concern",
        statusColor: "#b45309"
      },
      {
        id: "rep-vance-3",
        examName: "Echocardiogram (TTE)",
        date: "Aug 15, 2026",
        result: "LVEF 52%. Left atrial enlargement (LAA 42mm). Diastolic dysfunction Grade II.",
        status: "Borderline",
        statusColor: "#b45309"
      }
    ],
    doctorRemarks: [
      {
        id: "rem-vance-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 22, 2026",
        remark: "Severe autonomic stress detected with nocturnal tachycardia (avg 94 BPM). Titrated Metoprolol to 50mg ER. Bed telemetry continuously active."
      }
    ]
  },

  "PT-1109": {
    patientName: "David Miller",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 10, 2026",
    medications: [
      {
        id: "med-miller-1",
        name: "Omega-3 Acid Ethyl Esters",
        dosage: "1000 mg",
        frequency: "Once Daily (With meal)",
        timing: "08:30 AM",
        category: "Cardiovascular Lipid Optimizer",
        purpose: "Endothelial protection & triglyceride baseline stabilization",
        cautions: [
          "Take with food to maximize fatty acid absorption"
        ],
        sideEffects: [
          { name: "Mild aftertaste", severity: "rare", callDoctor: false }
        ],
        adherenceRate: 98
      }
    ],
    updatedReportSummary: [
      {
        id: "rep-miller-1",
        examName: "Coronary Artery Calcium (CAC) CT Screen",
        date: "Jun 12, 2026",
        result: "Agatston Score: 0 (Zero detectable calcification). Low 10-year risk.",
        status: "Optimal Normal",
        statusColor: "#047857"
      },
      {
        id: "rep-miller-2",
        examName: "Cardiopulmonary Exercise Treadmill Testing",
        date: "Jun 12, 2026",
        result: "Peak VO2 44 mL/kg/min (118% predicted for age). No ST depression.",
        status: "Superior Fitness",
        statusColor: "#047857"
      }
    ],
    doctorRemarks: [
      {
        id: "rem-miller-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 10, 2026",
        remark: "Outstanding cardiovascular baseline. Autonomic HRV 68ms reflects high vagal resilience. Continue current 45-min daily aerobic routine."
      }
    ]
  },

  "PT-6632": {
    patientName: "Aisha Patel",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 15, 2026",
    medications: [
      {
        id: "med-patel-1",
        name: "Telmisartan",
        dosage: "40 mg",
        frequency: "Once Daily (Morning)",
        timing: "08:00 AM",
        category: "Angiotensin II Receptor Blocker (ARB)",
        purpose: "Vascular endothelial protection and blood pressure moderation",
        cautions: [
          "Ensure adequate hydration during hot weather",
          "Check BP weekly"
        ],
        sideEffects: [
          { name: "Lightheadedness", severity: "rare", callDoctor: false }
        ],
        adherenceRate: 93
      }
    ],
    updatedReportSummary: [
      {
        id: "rep-patel-1",
        examName: "24-Hour Ambulatory Blood Pressure Monitor",
        date: "Sep 11, 2026",
        result: "Average daytime BP: 132/84 mmHg. Preserved nocturnal dipping (12%).",
        status: "Mild Elevation",
        statusColor: "#b45309"
      }
    ],
    doctorRemarks: [
      {
        id: "rem-patel-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 15, 2026",
        remark: "Mild sympathetic overactivity noted during evening recovery. Steps dropped to 4,100. Target 6,500 steps daily."
      }
    ]
  },

  "PT-9938": {
    patientName: "Marcus Thorne",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 08, 2026",
    medications: [
      {
        id: "med-thorne-1",
        name: "Rosuvastatin",
        dosage: "10 mg",
        frequency: "Once Daily (Bedtime)",
        timing: "09:30 PM",
        category: "Statin",
        purpose: "Primary cardiovascular prevention",
        cautions: ["Take consistently before sleep"],
        sideEffects: [{ name: "Mild headache", severity: "rare", callDoctor: false }],
        adherenceRate: 95
      }
    ],
    updatedReportSummary: [
      {
        id: "rep-thorne-1",
        examName: "Cardiovascular Lipid Biomarkers",
        date: "Sep 05, 2026",
        result: "LDL-C: 78 mg/dL (Goal achieved <100), HDL: 54 mg/dL.",
        status: "Normal",
        statusColor: "#047857"
      }
    ],
    doctorRemarks: [
      {
        id: "rem-thorne-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 08, 2026",
        remark: "Patient's risk score remains low (19%). Autonomic HRV stable at 61ms."
      }
    ]
  },

  "PT-8006": {
    patientName: "Vikram Singhania",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 24, 2026",
    medications: [
      {
        id: "med-vik-1",
        name: "Carvedilol",
        dosage: "12.5 mg",
        frequency: "Twice Daily (With meals)",
        timing: "08:00 AM / 08:00 PM",
        category: "Non-Selective Beta & Alpha-1 Blocker",
        purpose: "Post-ischemic neurohormonal inhibition and afterload reduction",
        cautions: ["Must take with food to minimize postural hypotension risk"],
        sideEffects: [{ name: "Drowsiness", severity: "mild", callDoctor: false }],
        adherenceRate: 91
      },
      {
        id: "med-vik-2",
        name: "Sacubitril / Valsartan (Entresto)",
        dosage: "49/51 mg",
        frequency: "Twice Daily",
        timing: "08:30 AM / 08:30 PM",
        category: "ARNI",
        purpose: "Myocardial wall stress reduction and reverse remodeling",
        cautions: ["Do not take within 36h of an ACE inhibitor", "Monitor potassium"],
        sideEffects: [{ name: "Hypotension", severity: "moderate", callDoctor: true }],
        adherenceRate: 94
      }
    ],
    updatedReportSummary: [
      {
        id: "rep-vik-1",
        examName: "NT-proBNP Neurohormone Assay",
        date: "Sep 23, 2026",
        result: "890 pg/mL (Elevated). Active ventricular chamber volume overload.",
        status: "High Concern",
        statusColor: "#dc2626"
      }
    ],
    doctorRemarks: [
      {
        id: "rem-vik-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 24, 2026",
        remark: "Patient in Bed 06 is in critical yellow/red transition. Restrict sodium to 2g/day and monitor daily weight."
      }
    ]
  },

  "PT-8007": {
    patientName: "Anita Desai",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 19, 2026",
    medications: [
      {
        id: "med-anita-1",
        name: "Clopidogrel (Plavix)",
        dosage: "75 mg",
        frequency: "Once Daily",
        timing: "09:00 AM",
        category: "P2Y12 Antiplatelet",
        purpose: "Dual antiplatelet stent thrombosis prevention",
        cautions: ["Avoid missing doses", "Notify surgeon before dental procedures"],
        sideEffects: [{ name: "Bruising", severity: "mild", callDoctor: false }],
        adherenceRate: 97
      }
    ],
    updatedReportSummary: [
      {
        id: "rep-anita-1",
        examName: "Stent Patency Ultrasound Doppler",
        date: "Sep 18, 2026",
        result: "Patent coronary flow. No in-stent restenosis.",
        status: "Preserved Flow",
        statusColor: "#047857"
      }
    ],
    doctorRemarks: [
      {
        id: "rem-anita-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 19, 2026",
        remark: "Excellent adherence to antiplatelet therapy. Blood pressure 134/86."
      }
    ]
  },

  "PT-8008": {
    patientName: "Sunita Nair",
    prescribingDoctor: "Dr. Sarah Chen, MD (Cardiology Lead)",
    lastPrescriptionDate: "Sep 12, 2026",
    medications: [
      {
        id: "med-sunita-1",
        name: "Atorvastatin",
        dosage: "10 mg",
        frequency: "Once Daily (Night)",
        timing: "09:00 PM",
        category: "Lipid Regulator",
        purpose: "Vascular primary prevention",
        cautions: ["Take consistently"],
        sideEffects: [],
        adherenceRate: 99
      }
    ],
    updatedReportSummary: [
      {
        id: "rep-sunita-1",
        examName: "Annual Metabolic & Cardiovascular Profile",
        date: "Sep 10, 2026",
        result: "Normal ECG. Triglycerides: 110 mg/dL. BP 120/78 mmHg.",
        status: "Optimal",
        statusColor: "#047857"
      }
    ],
    doctorRemarks: [
      {
        id: "rem-sunita-1",
        doctor: "Dr. Sarah Chen, MD",
        role: "Chief Cardiologist",
        date: "Sep 12, 2026",
        remark: "Patient's risk is 16% (stable green zone). Maintain active lifestyle."
      }
    ]
  }
};
