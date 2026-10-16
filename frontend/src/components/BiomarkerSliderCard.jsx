import React from 'react';
import { ChevronRight, Dna } from 'lucide-react';

export default function BiomarkerSliderCard({ 
  name, 
  value, 
  unit, 
  status = 'Optimal', 
  min = 50, 
  max = 140, 
  current = 75,
  geneTag,
  onClick 
}) {
  const percent = Math.min(100, Math.max(0, ((current - min) / (max - min)) * 100));

  const isOptimal = status.toLowerCase() === 'optimal' || status.toLowerCase() === 'stable';
  const statusColor = isOptimal ? 'var(--risk-stable)' : 'var(--risk-elevated)';

  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(19, 29, 49, 0.75)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '0.95rem 1.15rem',
        cursor: 'pointer',
        transition: 'all var(--transition-fast)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent-cyan)';
        e.currentTarget.style.background = 'rgba(26, 40, 68, 0.9)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)';
        e.currentTarget.style.background = 'rgba(19, 29, 49, 0.75)';
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
          {name}
        </span>
        <ChevronRight size={15} color="var(--text-muted)" />
      </div>

      {/* Main Metric Value & Status Badge */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '0.35rem 0' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
          <span style={{ fontSize: '1.45rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#fff' }}>
            {value}
          </span>
          {unit && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {unit}
            </span>
          )}
        </div>

        {status && (
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: statusColor,
            fontFamily: 'var(--font-sans)'
          }}>
            {status}
          </span>
        )}
      </div>

      {/* Gene Tag Variant if applicable */}
      {geneTag ? (
        <div style={{
          marginTop: '0.4rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.4rem',
          padding: '0.4rem',
          borderRadius: 'var(--radius-sm)',
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid var(--border-subtle)',
          fontSize: '0.72rem',
          color: 'var(--text-secondary)'
        }}>
          <Dna size={13} color="var(--accent-cyan)" />
          <span>Detected: <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>{geneTag}</strong></span>
        </div>
      ) : (
        /* Gradient Slider Bar Track */
        <div style={{ marginTop: '0.35rem' }}>
          <div className="gradient-slider-track">
            <div className="slider-needle" style={{ left: `${percent}%` }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </div>
      )}
    </div>
  );
}
