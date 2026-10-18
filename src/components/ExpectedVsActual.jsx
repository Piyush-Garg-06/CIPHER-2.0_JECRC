import React from 'react';
import { GitCompare, CheckCircle2, TrendingDown, AlertTriangle } from 'lucide-react';

export default function ExpectedVsActual({ patient }) {
  const isSimulated = patient?.isSimulated !== false;
  const ts = patient?.twinState;
  const vitals = patient?.vitals || {};

  const isDeviated = (ts?.triageZone === 'yellow' || ts?.triageZone === 'red' || patient?.riskLevel === 'elevated' || patient?.riskLevel === 'critical');

  const expectedText = !isSimulated && ts?.hrv0 != null && ts?.steps0 != null
    ? `Baseline (first 3 valid days): HRV ~${Math.round(ts.hrv0)} ms • Steps ~${Math.round(ts.steps0)}`
    : "Target: HRV > 55 ms • Steps > 7,000";

  const actualHrv = vitals.hrv != null ? `${vitals.hrv} ms HRV` : "- HRV";
  const actualSteps = vitals.dailySteps != null ? `${vitals.dailySteps.toLocaleString()} steps` : "- steps";
  const actualText = `${actualHrv} • ${actualSteps}`;

  return (
    <div className="clean-card">
      <div className="clean-card-header">
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
            <GitCompare size={18} />
          </div>
          <div>
            <div className="clean-card-title">
              Digital Twin Baseline: Expected vs Actual
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Physiological divergence tracking from baseline
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isSimulated && (
            <span style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--radius-sm)',
              background: '#fef3c7',
              color: '#92400e',
              border: '1px solid #fde68a'
            }}>
              DEMO DATA - not model output
            </span>
          )}
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '0.2rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: isDeviated ? '#fffbeb' : '#ecfdf5',
            color: isDeviated ? '#b45309' : '#047857',
            border: `1px solid ${isDeviated ? '#fde68a' : '#a7f3d0'}`
          }}>
            {isDeviated ? 'DEVIATION DETECTED' : 'ON TRACK'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {/* Expected */}
        <div style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
            <span style={{ color: '#047857', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={13} /> {!isSimulated ? 'Personal Baseline (First 3 Valid Days)' : 'Expected Baseline Trajectory'}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {expectedText}
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--border-light)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: '100%', height: '100%', background: '#10b981' }} />
          </div>
        </div>

        {/* Actual */}
        <div style={{ background: isDeviated ? 'var(--status-elevated-bg)' : 'var(--bg-card-hover)', border: `1px solid ${isDeviated ? 'var(--status-elevated-border)' : 'var(--border-light)'}`, borderRadius: 'var(--radius-md)', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', fontSize: '0.8rem' }}>
            <span style={{ color: isDeviated ? 'var(--status-elevated-text)' : 'var(--text-main)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              {isDeviated ? <TrendingDown size={13} /> : <CheckCircle2 size={13} />} Latest Valid Reading
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', color: isDeviated ? 'var(--status-elevated-text)' : 'var(--text-main)', fontWeight: 600 }}>
              {actualText}
            </span>
          </div>
          <div style={{ height: '8px', background: 'var(--border-light)', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ width: `${isDeviated ? 58 : 95}%`, height: '100%', background: isDeviated ? '#f59e0b' : '#10b981' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
