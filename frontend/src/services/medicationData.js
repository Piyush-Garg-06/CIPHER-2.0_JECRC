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
  }
};
