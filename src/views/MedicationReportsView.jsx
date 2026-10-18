import React, { useState } from 'react';
import { 
  Pill, 
  Clock, 
  AlertTriangle, 
  FileText, 
  UserCheck, 
  Stethoscope, 
  CheckCircle2, 
  Download, 
  AlertOctagon
} from 'lucide-react';
import { PATIENT_MEDICATIONS } from '../services/medicationData';

export default function MedicationReportsView({ patient, isLive }) {
  const [selectedMed, setSelectedMed] = useState(null);
  const isSimulated = patient?.isSimulated !== false && !isLive;

  const hasSampleEntry = Boolean(patient?.id && PATIENT_MEDICATIONS[patient.id]);
  const data = (patient?.id && PATIENT_MEDICATIONS[patient.id]) || PATIENT_MEDICATIONS["PT-8092"];

  return (
    <div className="page-container">
      {/* Honesty Banner */}
      <div
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: '#92400e',
          lineHeight: 1.45
        }}
      >
        DEMO DATA - sample medication schedule, labs and remarks. Not from this patient's record. Shown for interface demonstration only.
        {!hasSampleEntry && " This patient has no sample entry; PT-8092's sample data is shown."}
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Medication Schedule, Lab Exams & Doctor Remarks
            </h1>
            <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
              DEMO DATA
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
            Attending physician prescriptions, caution guidelines, and clinical laboratory evaluation
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button className="btn-clean btn-clean-secondary" disabled title="Not implemented in this demo">
            <Download size={14} /> Download Schedule
          </button>
        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.15fr 1fr',
        gap: '1.75rem',
        alignItems: 'start'
      }}>
        {/* LEFT COLUMN: Doctor Prescribed Medications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="clean-card">
            <div className="clean-card-header">
              <div className="clean-card-title">
                <Pill size={18} color="var(--primary-blue)" /> Prescribed Medications & Dosage Timing
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Prescribed by: {data.prescribingDoctor}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {data.medications.map(med => (
                <div
                  key={med.id}
                  style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.15rem',
                    boxShadow: 'var(--shadow-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                          {med.name}
                        </span>
                        <span style={{ fontSize: '0.72rem', background: 'var(--primary-blue-subtle)', color: 'var(--primary-blue)', fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
                          {med.dosage}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {med.category} &bull; {med.purpose}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: '#f8fafc',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.3rem 0.65rem',
                      fontSize: '0.78rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: 'var(--primary-blue)'
                    }}>
                      <Clock size={13} /> {med.timing}
                    </div>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-main)', fontWeight: 500 }}>
                    Schedule: <strong>{med.frequency}</strong>
                  </div>

                  {/* Sleek Minimal Guidance Pill */}
                  {med.cautions && med.cautions.length > 0 && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: 'var(--status-elevated-bg)',
                      border: '1px solid var(--status-elevated-border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.35rem 0.65rem',
                      fontSize: '0.74rem',
                      color: 'var(--status-elevated-text)',
                      fontWeight: 600
                    }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {med.cautions[0]}
                      </span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Side Effects:
                      </span>
                      {med.sideEffects.slice(0, 2).map((se, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: se.callDoctor ? 'rgba(239, 68, 68, 0.12)' : 'var(--bg-card-hover)',
                            color: se.callDoctor ? '#ef4444' : 'var(--text-main)',
                            border: `1px solid ${se.callDoctor ? 'rgba(239, 68, 68, 0.3)' : 'var(--border-light)'}`,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          {se.callDoctor && <AlertOctagon size={10} color="#ef4444" />}
                          {se.name.split(' (')[0]}
                        </span>
                      ))}
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--status-stable-text)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={13} /> {med.adherenceRate}% Adherence
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Updated Report Summary & Doctor Remarks */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="clean-card">
            <div className="clean-card-header">
              <div className="clean-card-title">
                <FileText size={18} color="var(--primary-blue)" /> Updated Report Summary & Patient Lab Exams
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Recent diagnostic encounters
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {data.updatedReportSummary.map(report => (
                <div
                  key={report.id}
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '0.75rem'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {report.examName}
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {report.result}
                    </p>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Conducted: {report.date}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: report.statusColor === '#047857' ? '#ecfdf5' : '#fffbeb',
                    color: report.statusColor,
                    whiteSpace: 'nowrap'
                  }}>
                    {report.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="clean-card">
            <div className="clean-card-header">
              <div className="clean-card-title">
                <Stethoscope size={18} color="var(--primary-blue)" /> Attending Physician Remarks
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Verified clinical documentation
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {data.doctorRemarks.map(remark => (
                <div
                  key={remark.id}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    boxShadow: 'var(--shadow-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <UserCheck size={14} color="var(--primary-blue)" />
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {remark.doctor}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ({remark.role})
                      </span>
                    </div>

                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {remark.date}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-main)', lineHeight: 1.55 }}>
                    "{remark.remark}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
