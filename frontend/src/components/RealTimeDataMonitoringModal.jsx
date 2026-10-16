import React from 'react';
import { Heart, Droplet, Watch, X, Activity } from 'lucide-react';
import ECGWaveform from './ECGWaveform';

export default function RealTimeDataMonitoringModal({ patient, onClose }) {
  if (!patient) return null;

  return (
    <div className="modal-overlay-light" onClick={onClose}>
      <div className="modal-content-light" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Wearable Telemetry Summary
              </h2>
              <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                DEMO DATA
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Wearable telemetry records for {patient.name || patient.id}
            </div>
          </div>

          <button
            onClick={onClose}
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

        {/* Source Pill */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#f8fafc',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-md)',
          padding: '0.55rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.78rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Watch size={16} color="var(--primary-blue)" />
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Apple Watch Telemetry Ingestion</span>
          </div>
          <span style={{ color: 'var(--primary-blue)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
            8 telemetry streams active (demo)
          </span>
        </div>

        {/* Card 1: Heart Rate */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.15rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Heart size={15} />
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Heart Rate
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
            Over the course of the day, patient's heart rate fluctuated between {patient?.vitals?.restingHR ?? 68} and {(patient?.vitals?.heartRate ?? 72) + 18} BPM, remaining predominantly in the reference range.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              Avg {patient?.vitals?.heartRate ?? 72} BPM (Resting: {patient?.vitals?.restingHR ?? 68} BPM)
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
              Wearable Ingestion
            </span>
          </div>

          <ECGWaveform bpm={patient.vitals.heartRate} riskLevel={patient.riskLevel} height={52} />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            <span>--- Suggested ref range: 60 BPM - 100 BPM</span>
            <span style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>HRV: {patient.vitals.hrv} ms</span>
          </div>
        </div>

        {/* Card 2: Blood Pressure */}
        <div style={{
          background: '#ffffff',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.15rem',
          marginBottom: '1rem',
          boxShadow: 'var(--shadow-subtle)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              background: '#e0f2fe',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Droplet size={15} />
            </div>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Blood Pressure Dynamics
            </span>
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
            Systolic blood pressure averaged {patient.vitals.bloodPressure.split('/')[0]} mmHg and diastolic averaged {patient.vitals.bloodPressure.split('/')[1]} mmHg. Category: {patient.vitals.bpCategory}.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.35rem' }}>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>
              SBP / DBP: <span style={{ color: 'var(--primary-blue)', fontFamily: 'var(--font-mono)' }}>{patient.vitals.bloodPressure} mmHg</span>
            </span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
              PWV: {patient.vitals.arterialStiffnessIndex}
            </span>
          </div>

          <div style={{ width: '100%', height: '60px', background: '#f8fafc', borderRadius: 'var(--radius-md)', padding: '0.4rem', border: '1px solid var(--border-light)' }}>
            <svg viewBox="0 0 500 50" style={{ width: '100%', height: '100%' }}>
              <polyline fill="none" stroke="#f43f5e" strokeWidth="2.5" points="10,15 100,20 200,24 300,14 400,18 490,16" />
              <polyline fill="none" stroke="#10b981" strokeWidth="2.5" points="10,35 100,38 200,36 300,32 400,35 490,34" />
            </svg>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
            <span>--- Suggested ref range: 120-129 mmHg SBP</span>
            <span>--- Ref range: 80-84 mmHg DBP</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-clean btn-clean-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
