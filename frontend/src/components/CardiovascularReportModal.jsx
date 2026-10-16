import React from 'react';
import { Heart, X, Activity, ArrowUpRight } from 'lucide-react';

export default function CardiovascularReportModal({ patient, onClose, onOpenCareAction }) {
  if (!patient) return null;

  const riskScore = patient.riskPercentage || 18.4;
  const riskLabel = patient.riskLevel === 'critical' ? 'High Risk' : patient.riskLevel === 'elevated' ? 'Moderate Risk' : 'Low Risk';

  const areasOfConcern = [
    { name: 'Atrial Fibrillation', severity: 'high', dot: '🔴' },
    { name: 'Pulmonary Embolism', severity: 'high', dot: '🔴' },
    { name: 'Hypertension', severity: 'medium', dot: '🟡' },
    { name: 'Ischemic Stroke', severity: 'medium', dot: '🟡' },
    { name: 'Coronary Atherosclerosis', severity: 'low', dot: '🟢' }
  ];

  return (
    <div className="modal-overlay-light" onClick={onClose}>
      <div className="modal-content-light" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--radius-md)',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Heart size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Cardiovascular System Report
              </h2>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {patient.name} &bull; MRN #{patient.id} &bull; 10-Year Probability Engine
              </div>
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

        {/* Risk Score Block */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '2.2rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>
                {riskScore}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-muted)' }}>%</span>
            </div>

            <span style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              color: patient.riskLevel === 'critical' ? '#b91c1c' : '#b45309',
              background: patient.riskLevel === 'critical' ? '#fef2f2' : '#fffbeb',
              padding: '3px 8px',
              borderRadius: 'var(--radius-full)'
            }}>
              &bull; {riskLabel}
            </span>
          </div>

          {/* Gradient Spectrum Slider Bar */}
          <div className="clean-slider-track" style={{ height: '10px', background: 'linear-gradient(90deg, #10b981 0%, #38bdf8 35%, #f59e0b 70%, #ef4444 100%)' }}>
            <div className="clean-slider-pin" style={{ left: `${Math.min(95, Math.max(5, riskScore))}%` }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.35rem' }}>
            <span>0</span>
            <span>15</span>
            <span>30+</span>
          </div>

          {/* Narrative */}
          <div style={{ marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--primary-blue)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
              Risk Score Interpretation
            </div>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
              Patient has an estimated <strong>{riskScore}% probability</strong> of a cardiovascular event in 10 years, placing them in the <strong>{riskLabel}</strong> category for their age ({patient.age}) and clinical profile.
            </p>
          </div>
        </div>

        {/* Areas of Concern */}
        <div style={{
          background: '#f8fafc',
          border: '1px solid var(--border-light)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.25rem',
          marginBottom: '1.25rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Areas of Concern
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              <span>&bull; Low</span>
              <span>&bull; Medium</span>
              <span>&bull; High</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
            {areasOfConcern.map((area, idx) => (
              <div
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.35rem 0.75rem',
                  borderRadius: 'var(--radius-full)',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  fontSize: '0.78rem',
                  color: 'var(--text-main)',
                  fontWeight: 500
                }}
              >
                <span>{area.dot}</span>
                <span>{area.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
          <button className="btn-clean btn-clean-secondary" onClick={onClose}>
            Close
          </button>
          <button
            className="btn-clean btn-clean-primary"
            onClick={() => {
              onClose();
              if (onOpenCareAction) onOpenCareAction();
            }}
          >
            <ArrowUpRight size={14} /> Open Care Protocol
          </button>
        </div>
      </div>
    </div>
  );
}
