import React from 'react';
import { ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle } from 'lucide-react';

export default function RiskBadge({ level = 'stable', score, percentage, watch = false, redSource = null, size = 'md' }) {
  const isNotCalibrated = level === 'not_calibrated' || (score === null && percentage === null);

  if (isNotCalibrated) {
    return (
      <span className="risk-badge-light not_calibrated" style={{
        fontSize: size === 'sm' ? '0.7rem' : '0.75rem',
        background: '#f1f5f9',
        color: '#64748b',
        border: '1px solid #cbd5e1',
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <HelpCircle size={size === 'sm' ? 12 : 13} />
        <span>Not calibrated</span>
      </span>
    );
  }

  const getIcon = () => {
    switch (level) {
      case 'critical':
      case 'red':
        return <AlertOctagon size={size === 'sm' ? 12 : 13} />;
      case 'elevated':
      case 'yellow':
        return <AlertTriangle size={size === 'sm' ? 12 : 13} />;
      default:
        return <ShieldCheck size={size === 'sm' ? 12 : 13} />;
    }
  };

  const getLabel = () => {
    switch (level) {
      case 'critical':
      case 'red':
        return redSource ? `Red (${redSource})` : 'Red Zone';
      case 'elevated':
      case 'yellow':
        return 'Yellow Zone';
      default:
        return 'Green Zone';
    }
  };

  // Derive honest percentage without conflicting score/percentage pairs
  let pctVal = null;
  if (score !== undefined && score !== null) {
    pctVal = Math.round(score * 100);
  } else if (percentage !== undefined && percentage !== null) {
    pctVal = percentage;
  }

  return (
    <span
      className={`risk-badge-light ${level}`}
      style={{ fontSize: size === 'sm' ? '0.7rem' : '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
    >
      {getIcon()}
      <span>{getLabel()}</span>
      {pctVal !== null && (
        <span
          title="Percentages are approximate; zones are the reliable signal."
          style={{ opacity: 0.9, fontFamily: 'var(--font-mono)', fontWeight: 600, cursor: 'help' }}
        >
          (~{pctVal}%)
        </span>
      )}
      {watch && (
        <span style={{
          background: '#fef3c7',
          color: '#92400e',
          padding: '1px 5px',
          borderRadius: '4px',
          fontSize: '0.65rem',
          fontWeight: 700,
          border: '1px solid #fde68a'
        }}>
          Watch
        </span>
      )}
    </span>
  );
}

