import React, { useState } from 'react';
import { 
  FolderArchive, 
  Search, 
  Eye, 
  Download, 
  Building2, 
  X, 
  Tag 
} from 'lucide-react';

const DEFAULT_RECORDS = [
  {
    id: "rec-101",
    title: "24-Hour Ambulatory Holter ECG Analysis",
    category: "Clinical Reports",
    date: "Sep 14, 2026",
    facility: "Metro Heart Institute - Electrophysiology Lab",
    doctor: "Dr. A. Verma, FACC",
    fileType: "PDF Report",
    summary: "Sinus rhythm with average HR 78 BPM. 14 isolated PACs, no sustained VT. Diminished nocturnal high-frequency (HF) HRV power indicative of blunted vagal recovery.",
    tags: ["ECG", "Holter", "Electrophysiology"],
    content: `PATIENT RECORD: 24-HOUR CONTINUOUS AMBULATORY TELEMETRY
RECORDING DURATION: 23 hrs 48 mins | SAMPLING FREQ: 500 Hz
- Min HR: 54 BPM (04:12 AM)
- Max HR: 114 BPM (06:45 PM)
- Average HR: 78 BPM

CLINICAL FINDINGS:
1. Baseline rhythm is Normal Sinus Rhythm throughout recording.
2. Low burden supraventricular ectopy (<0.2%), zero ventricular couplets/triplets.
3. Diminished nocturnal HF spectral surge, indicating impaired parasympathetic baroreflex recovery.
CONCLUSION: Recommend wearable telemetry tracking and blood pressure monitoring.`
  },
  {
    id: "rec-102",
    title: "Comprehensive Lipid & High-Sensitivity Biomarker Panel",
    category: "Lab Reports",
    date: "Sep 10, 2026",
    facility: "Central PathLab Diagnostic Hub",
    doctor: "Dr. Sarah Chen, MD",
    fileType: "Lab Data",
    summary: "Total Cholesterol: 194 mg/dL, LDL-C: 112 mg/dL, HDL-C: 44 mg/dL, Triglycerides: 168 mg/dL, hs-CRP: 2.1 mg/L (Borderline vascular inflammation).",
    tags: ["Lipids", "Biomarkers", "Metabolic"],
    content: `BIOCHEMICAL & METABOLIC ASSAY:
- Total Cholesterol: 194 mg/dL (Desirable: <200)
- LDL-C: 112 mg/dL (High risk target: <70, Moderate: <100)
- HDL-C: 44 mg/dL (Normal: >40)
- Triglycerides: 168 mg/dL (Borderline High: 150-199)
- Fasting Glucose: 98 mg/dL (Normal: 70-99)
- HbA1c: 5.7% (Normal pre-diabetic cutoff: <5.7%)
- High-Sensitivity CRP (hs-CRP): 2.1 mg/L (Moderate cardiovascular risk: 1.0-3.0)
- Serum Creatinine: 0.98 mg/dL | eGFR: 88 mL/min/1.73m² (Preserved renal function)`
  },
  {
    id: "rec-103",
    title: "Transthoracic Echocardiogram (TTE) - Left Ventricular Assessment",
    category: "Imaging",
    date: "Aug 28, 2026",
    facility: "Advanced Cardiac Imaging Center",
    doctor: "Dr. K. Patel, MD (Cardiologist)",
    fileType: "Imaging Summary",
    summary: "LVEF estimated at 54-58% (Preserved systolic function). Mild concentric LV hypertrophy. Grade 1 diastolic relaxation impairment.",
    tags: ["Echo", "Ultrasound", "LVEF"],
    content: `2D TRANSTHORACIC ECHOCARDIOGRAM REPORT:
- Left Ventricular Internal Diameter (End Diastole): 4.8 cm
- Interventricular Septal Thickness: 1.2 cm (Mild concentric LV hypertrophy)
- Posterior Wall Thickness: 1.1 cm
- Ejection Fraction (Biplane Simpson's method): 56% (Normal range 50-70%)
- Left Atrial Volume Index (LAVI): 32 mL/m²
- Mitral Inflow E/A Ratio: 0.84 with septal E/e' of 9.2 (Consistent with Grade 1 diastolic dysfunction)
- Aortic Root & Ascending Aorta: Normal dimensions, trileaflet valve without stenosis.`
  },
  {
    id: "rec-104",
    title: "Post-Discharge Cardiology Follow-up & Treatment Plan",
    category: "Doctor Notes",
    date: "Aug 15, 2026",
    facility: "Metro Heart Outpatient Clinic",
    doctor: "Dr. Sarah Chen, MD (Lead Cardiologist)",
    fileType: "Clinical Encounter",
    summary: "Stable post-acute presentation. Optimization of anti-hypertensive regimen, beta-blocker titration, and remote digital twin wearable enrollment.",
    tags: ["Follow-up", "Prescription", "Care Plan"],
    content: `OUTPATIENT CLINICAL PROGRESS NOTE:
SUBJECTIVE: Patient Rahul Sharma reports mild fatigue with brisk walking, denies orthopnea, paroxysmal nocturnal dyspnea, or chest pain.
OBJECTIVE:
- Sitting BP: 136/86 mmHg | Pulse: 74 BPM regular | SpO2: 98% room air
- Heart: S1, S2 normal, no S3 gallop, no murmurs. Lungs clear to auscultation bilaterally.

ASSESSMENT & PLAN:
1. Stage 1 Hypertension with autonomic fatigue: Maintain Amlodipine 5mg OD, Metoprolol Succinate 25mg OD.
2. Remote Telemetry: Connected to AURA Digital Twin platform for daily resting HR & HRV tracking.
3. Cardiac Rehab: Cleared for phase 2 home-based 30-minute graded walking sessions.
4. Next in-clinic review: 6 weeks.`
  }
];

export default function MedicalRecordsVault({ records = [], patient }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activePreviewDoc, setActivePreviewDoc] = useState(null);

  const activeRecords = (records && records.length > 0) ? records : DEFAULT_RECORDS;
  const categories = ['All', 'Clinical Reports', 'Lab Reports', 'Imaging', 'Doctor Notes'];

  const filteredRecords = activeRecords.filter(rec => {
    const matchesSearch = 
      rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rec.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'All' || rec.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="clean-card">
      {/* Header */}
      <div className="clean-card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-md)',
            background: 'var(--primary-blue-subtle)',
            color: 'var(--primary-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <FolderArchive size={18} />
          </div>
          <div>
            <div className="clean-card-title">
              EHR Diagnostic Documentation & Vault
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Integrated clinical documentation, Holter traces, labs & imaging
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search records..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.45rem 0.6rem 0.45rem 2rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-medium)',
              color: 'var(--text-main)',
              fontSize: '0.78rem',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '0.35rem 0.75rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.78rem',
              fontWeight: 600,
              background: selectedCategory === cat ? 'var(--primary-blue-subtle)' : 'var(--bg-card-hover)',
              color: selectedCategory === cat ? 'var(--primary-blue)' : 'var(--text-muted)',
              border: selectedCategory === cat ? '1px solid var(--primary-blue)' : '1px solid var(--border-light)',
              cursor: 'pointer'
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Records Cards Grid */}
      <div className="grid-2">
        {filteredRecords.map(rec => (
          <div
            key={rec.id}
            onClick={() => setActivePreviewDoc(rec)}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              cursor: 'pointer',
              transition: 'all var(--transition)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--primary-blue)';
              e.currentTarget.style.boxShadow = 'var(--shadow-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span style={{
                fontSize: '0.68rem',
                padding: '2px 7px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--primary-blue-subtle)',
                color: 'var(--primary-blue)',
                fontFamily: 'var(--font-mono)',
                fontWeight: 600
              }}>
                {rec.category}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {rec.date}
              </span>
            </div>

            <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
              {rec.title}
            </div>

            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {rec.summary}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.65rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                <Building2 size={12} /> {rec.facility}
              </div>
              <span style={{ color: 'var(--primary-blue)', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
                <Eye size={13} /> View Document
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Document Preview Modal */}
      {activePreviewDoc && (
        <div className="modal-overlay-light" onClick={() => setActivePreviewDoc(null)}>
          <div className="modal-content-light" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
              <div>
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--primary-blue-subtle)',
                  color: 'var(--primary-blue)',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600
                }}>
                  {activePreviewDoc.category} &bull; {activePreviewDoc.fileType}
                </span>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                  {activePreviewDoc.title}
                </h3>
              </div>

              <button
                onClick={() => setActivePreviewDoc(null)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-muted)',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{
              background: '#f8fafc',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              padding: '1.15rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.78rem',
              lineHeight: 1.6,
              color: 'var(--text-main)',
              whiteSpace: 'pre-wrap',
              maxHeight: '300px',
              overflowY: 'auto',
              marginBottom: '1rem'
            }}>
              {activePreviewDoc.content || activePreviewDoc.summary}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
              <button className="btn-clean btn-clean-secondary" onClick={() => alert(`Exporting ${activePreviewDoc.title} (PDF)...`)}>
                <Download size={13} /> Export PDF
              </button>
              <button className="btn-clean btn-clean-primary" onClick={() => setActivePreviewDoc(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
