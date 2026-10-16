import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import RiskBadge from './RiskBadge';
import Sparkline from './Sparkline';
import { formatRisk, formatVitalValue } from '../utils/formatters';
import { isPatientStale } from '../services/patientService';

export default function PatientCard({ patient, isSelected, onSelect }) {
  if (!patient) return null;

  const zone = (patient.twinState?.triageZone || patient.riskLevel || 'green').toLowerCase();
  const isWatch = Boolean(patient.twinState?.watch || patient.watch);
  const redSource = patient.twinState?.redSource || patient.redSource;
  const isStale = isPatientStale(patient);
  const p50 = patient.twinState?.p50 ?? patient.riskScore;

  // Null-safe vitals
  const vitals = patient.vitals || {};
  const heartRate = formatVitalValue(vitals.heartRate ?? vitals.restingHR);
  const hrv = formatVitalValue(vitals.hrv);
  const dailySteps = formatVitalValue(vitals.dailySteps);

  const hasSparkline = Boolean(patient.sparkline && patient.sparkline.length > 0);
  const hasVelocity = Boolean(patient.riskTrend && patient.riskTrendValue);

  return (
    <div
      onClick={() => onSelect(patient)}
      className="clean-card"
      style={{
        cursor: 'pointer',
        border: isSelected ? '1.5px solid var(--primary-blue)' : '1px solid var(--border-light)',
        boxShadow: isSelected ? '0 4px 15px rgba(2, 132, 199, 0.15)' : 'var(--shadow-card)',
        background: isSelected ? '#f0f9ff' : '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.85rem',
        transition: 'all var(--transition)'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>{patient.name}</span>
            <ArrowUpRight size={14} color="var(--primary-blue)" />
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span>{patient.age ? `${patient.age} yrs` : '-'} &bull; {patient.gender || '-'} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{patient.id}</span></span>
            {patient.isSimulated && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
                DEMO DATA
              </span>
            )}
            {isStale && (
              <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
                No readings for {patient.twinState?.dataAgeDays ?? patient.dataAgeDays ?? 3} days
              </span>
            )}
          </div>
        </div>

        <RiskBadge
          level={zone}
          watch={isWatch}
          redSource={redSource}
          size="sm"
        />
      </div>

      {/* Primary Risk Box (Single line shared risk formatter) */}
      <div style={{
        padding: '0.65rem 0.85rem',
        borderRadius: 'var(--radius-md)',
        background: '#f8fafc',
        border: '1px solid var(--border-light)'
      }}>
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          7-Day Risk Status
        </div>
        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
          {formatRisk(p50)}
        </div>
      </div>

      {/* Velocity / Sparkline - ONLY rendered when present */}
      {hasVelocity && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>7-Day Velocity:</span>
          <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{patient.riskTrendValue}</span>
        </div>
      )}

      {hasSparkline && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            Risk Velocity (9d):
          </div>
          <Sparkline data={patient.sparkline} level={zone} width={130} height={32} />
        </div>
      )}

      {/* Vitals Summary (Null-Safe) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.4rem',
        padding: '0.5rem',
        borderRadius: 'var(--radius-sm)',
        background: '#f8fafc',
        fontSize: '0.72rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>HR</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
            {heartRate !== '-' ? `${heartRate} BPM` : '-'}
          </span>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>HRV</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
            {hrv !== '-' ? `${hrv} ms` : '-'}
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>Steps</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
            {dailySteps !== '-' ? (typeof dailySteps === 'number' ? dailySteps.toLocaleString() : dailySteps) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
