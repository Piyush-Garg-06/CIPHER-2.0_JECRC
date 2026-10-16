import React from 'react';
import { 
  Wind, 
  Heart, 
  Brain, 
  Activity, 
  ChevronRight, 
  ShieldAlert, 
  AlertTriangle 
} from 'lucide-react';

export default function HealthRisksSection({ patient, onOpenCardioReport, onOpenRespiratoryReport }) {
  const cardioScore = patient.riskPercentage || 47;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
          Health Risks
        </h3>
        <span style={{ fontSize: '0.72rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>
          Organ Subsystem Risk Scoring (Demo)
        </span>
      </div>

      {/* 1. Respiratory System Card */}
      <div
        className="organ-risk-card"
        onClick={onOpenRespiratoryReport}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1.5px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Wind size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                Respiratory System
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Pulmonary & Gas Exchange
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#38bdf8' }}>
              74 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>
        </div>

        {/* Condition tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
          <span className="organ-tag-pill pink">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f43f5e' }} /> Bronchitis
          </span>
          <span className="organ-tag-pill yellow">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#eab308' }} /> Allergic Rhinitis
          </span>
          <span className="organ-tag-pill yellow">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#eab308' }} /> Asthma (mild)
          </span>
        </div>
      </div>

      {/* 2. Cardiovascular Health Report Card (Hero Card) */}
      <div
        className="organ-risk-card"
        onClick={onOpenCardioReport}
        style={{
          border: '1.5px solid rgba(0, 210, 255, 0.4)',
          background: 'linear-gradient(135deg, rgba(19, 29, 49, 0.95), rgba(26, 40, 68, 0.95))',
          boxShadow: '0 0 25px rgba(0, 210, 255, 0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1.5px solid rgba(239, 68, 68, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--risk-critical)'
            }}>
              <Heart size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>Cardiovascular Health Report</span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(0, 210, 255, 0.15)', color: 'var(--accent-cyan)', padding: '1px 5px', borderRadius: 3 }}>
                  PRIMARY
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Hemodynamic & Rhythm Risk (Demo)
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: patient.riskLevel === 'critical' ? 'var(--risk-critical)' : 'var(--risk-elevated)' }}>
              {cardioScore} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>
        </div>

        {/* Condition tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.5rem' }}>
          <span className="organ-tag-pill pink">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f43f5e' }} /> Hypertension
          </span>
          <span className="organ-tag-pill yellow">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#eab308' }} /> Coronary Artery Disease
          </span>
          <span className="organ-tag-pill yellow">
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#eab308' }} /> Heart Failure Risk
          </span>
        </div>
      </div>

      {/* 3. Endocrine & Autonomic System Card */}
      <div className="organ-risk-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: 'rgba(168, 85, 247, 0.15)',
              border: '1.5px solid rgba(168, 85, 247, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc'
            }}>
              <Brain size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                Endocrine & Autonomic System
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Vagal Tone & Circadian Recovery
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--risk-stable)' }}>
              28 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
