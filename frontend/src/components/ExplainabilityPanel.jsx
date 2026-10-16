import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  BrainCircuit
} from 'lucide-react';
import { getDriverLabel, formatDriverValue } from '../utils/formatters';

export default function ExplainabilityPanel({ twinState = null, summaryText, riskLevel = 'elevated' }) {
  const drivers = twinState?.drivers;
  const driversNote = twinState?.driversNote || "linear-model contributions in log-odds units; not causal; clipped at +-4";
  const hasDrivers = Array.isArray(drivers) && drivers.length > 0;

  const maxContrib = hasDrivers
    ? Math.max(...drivers.map(d => Math.abs(d.logitContribution)), 0.001)
    : 1;

  return (
    <div className="clean-card">
      {/* Header */}
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
            <BrainCircuit size={18} />
          </div>
          <div>
            <div className="clean-card-title">
              Explainable Risk Drivers (XAI)
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Top contributors to calibrated log-odds
            </div>
          </div>
        </div>

        <span style={{
          fontSize: '0.72rem',
          padding: '2px 8px',
          borderRadius: 'var(--radius-sm)',
          background: '#f1f5f9',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-mono)'
        }}>
          Linear contributions (log-odds)
        </span>
      </div>

      {/* Narrative Box */}
      {summaryText && (
        <div style={{
          padding: '0.85rem 1.15rem',
          borderRadius: 'var(--radius-md)',
          background: '#f8fafc',
          border: '1px solid var(--border-light)',
          marginBottom: '1.25rem'
        }}>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', lineHeight: 1.5, margin: 0 }}>
            {summaryText}
          </p>
        </div>
      )}

      {/* Drivers List */}
      {hasDrivers ? (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {drivers.map((driver, idx) => {
              const isRiskIncrease = driver.logitContribution > 0;
              const barColor = isRiskIncrease 
                ? (riskLevel === 'critical' || riskLevel === 'red' ? '#ef4444' : '#f59e0b') 
                : '#10b981';
              const barWidth = Math.min(Math.round((Math.abs(driver.logitContribution) / maxContrib) * 100), 100);
              const label = getDriverLabel(driver.feature);
              const formattedVal = formatDriverValue(driver.feature, driver.rawValue);

              return (
                <div
                  key={driver.feature || idx}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#ffffff',
                    border: '1px solid var(--border-light)',
                    transition: 'all var(--transition)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {isRiskIncrease ? <ArrowUpRight size={14} color={barColor} /> : <ArrowDownRight size={14} color="#10b981" />}
                      <span>{label}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: barColor }}>
                      {driver.logitContribution >= 0 ? '+' : ''}{driver.logitContribution.toFixed(3)}
                    </span>
                  </div>

                  {/* Bar track */}
                  <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', margin: '0.4rem 0 0.2rem 0', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${barWidth}%`, background: barColor, borderRadius: '3px' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Observed: {formattedVal}</span>
                    {driver.zScore != null && (
                      <span>z-score: {driver.zScore >= 0 ? '+' : ''}{driver.zScore.toFixed(2)}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{
            marginTop: '0.85rem',
            paddingTop: '0.65rem',
            borderTop: '1px solid var(--border-light)',
            fontSize: '0.72rem',
            color: 'var(--text-muted)',
            lineHeight: 1.45
          }}>
            {driversNote}
          </div>
        </>
      ) : (
        <div style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          background: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px dashed var(--border-light)'
        }}>
          No driver breakdown for this record
        </div>
      )}
    </div>
  );
}
