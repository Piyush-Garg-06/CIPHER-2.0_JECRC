import React from 'react';
import { 
  Heart, 
  Brain, 
  Wind, 
  Activity, 
  Pill, 
  Zap, 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  AlertOctagon,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
  Stethoscope,
  Info
} from 'lucide-react';
import ECGWaveform from './ECGWaveform';
import RiskBadge from './RiskBadge';

export default function OrganDetailPanel({ activeOrgan, organData, patient, onClose, onSelectCareAction }) {
  if (!activeOrgan || !organData) return null;

  const getOrganIcon = (key) => {
    switch (key) {
      case 'heart': return <Heart size={20} className="text-red-400" />;
      case 'brain': return <Brain size={20} className="text-purple-400" />;
      case 'lungs': return <Wind size={20} className="text-cyan-400" />;
      case 'vascular': return <Activity size={20} className="text-amber-400" />;
      case 'activity': return <Zap size={20} className="text-blue-400" />;
      case 'medication': return <Pill size={20} className="text-emerald-400" />;
      default: return <Heart size={20} />;
    }
  };

  return (
    <div className="floating-organ-panel">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-md)',
            background: 'rgba(0, 210, 255, 0.1)',
            border: '1px solid rgba(0, 210, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            {getOrganIcon(activeOrgan)}
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
              {organData.name}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {organData.title}
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)',
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

      {/* Risk Status Indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '0.85rem'
      }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
          Subsystem Status
        </span>
        <RiskBadge level={organData.status} size="sm" />
      </div>

      {/* ECG Trace if Heart is selected */}
      {activeOrgan === 'heart' && (
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            fontSize: '0.72rem', 
            color: 'var(--text-secondary)',
            marginBottom: '0.35rem' 
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={13} color="var(--accent-cyan)" /> Live Telemetry Waveform
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
              {patient.vitals.heartRate} BPM
            </span>
          </div>
          <ECGWaveform bpm={patient.vitals.heartRate} riskLevel={organData.status} height={56} />
        </div>
      )}

      {/* Metrics List */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.45rem' }}>
          Key Biomarkers & Wearable Signals
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {organData.metrics?.map((m, idx) => (
            <div 
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.45rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-subtle)',
                fontSize: '0.78rem'
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {m.note && (
                  <span style={{
                    fontSize: '0.68rem',
                    color: m.status === 'stable' ? 'var(--risk-stable)' : m.status === 'critical' ? 'var(--risk-critical)' : 'var(--risk-elevated)',
                    fontFamily: 'var(--font-mono)'
                  }}>
                    {m.note}
                  </span>
                )}
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 600,
                  color: m.status === 'critical' ? 'var(--risk-critical)' : m.status === 'elevated' ? 'var(--risk-elevated)' : '#fff'
                }}>
                  {m.value}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical Findings */}
      <div style={{
        padding: '0.65rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(15, 26, 48, 0.6)',
        border: '1px solid rgba(0, 210, 255, 0.2)',
        marginBottom: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--accent-cyan)', marginBottom: '0.25rem' }}>
          <Info size={13} /> Digital Twin Interpretation
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
          {organData.findings}
        </p>
      </div>

      {/* Clinical Action Suggestion */}
      <div style={{
        padding: '0.65rem 0.75rem',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(245, 158, 11, 0.08)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        marginBottom: '0.85rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', fontWeight: 600, color: 'var(--risk-elevated)', marginBottom: '0.25rem' }}>
          <Stethoscope size={13} /> Decision-Support Recommendation
        </div>
        <p style={{ fontSize: '0.75rem', color: '#fef3c7', lineHeight: 1.4 }}>
          {organData.recommendation}
        </p>
      </div>

      {/* Escalate / Trigger Action Button */}
      <button 
        onClick={() => onSelectCareAction && onSelectCareAction(organData)}
        className="btn btn-primary"
        style={{ width: '100%', fontSize: '0.8rem', padding: '0.5rem' }}
      >
        <ArrowUpRight size={14} /> Open Care Action Protocol
      </button>
    </div>
  );
}
