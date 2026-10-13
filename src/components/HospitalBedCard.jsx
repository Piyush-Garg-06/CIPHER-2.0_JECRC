import React from 'react';
import { Heart, AlertTriangle, ShieldAlert } from 'lucide-react';
import RiskBadge from './RiskBadge';
import { formatRisk, formatVitalValue } from '../utils/formatters';

export default function HospitalBedCard({ patient, bedNumber, onSelect, isSelected }) {
  if (!patient) return null;

  const zone = (patient.twinState?.triageZone || patient.riskLevel || 'green').toLowerCase();
  const isWatch = Boolean(patient.twinState?.watch || patient.watch);
  const redSource = patient.twinState?.redSource || patient.redSource;
  const isStale = Boolean(patient.twinState?.staleData || patient.staleData);
  const p50 = patient.twinState?.p50 ?? patient.riskScore;

  const isCritical = zone === 'critical' || zone === 'red';
  const isElevated = zone === 'elevated' || zone === 'yellow';

  const statusColor = isCritical ? '#ef4444' : (isElevated ? '#f59e0b' : '#10b981');

  // Null-safe vitals
  const vitals = patient.vitals || {};
  const heartRate = formatVitalValue(vitals.heartRate ?? vitals.restingHR);
  const hrv = formatVitalValue(vitals.hrv);
  const bloodPressure = formatVitalValue(vitals.bloodPressure);
  const spo2 = formatVitalValue(vitals.spo2);

  return (
    <div
      onClick={() => onSelect(patient)}
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: isSelected ? '2.5px solid var(--primary-blue)' : `1.5px solid ${isCritical ? '#fca5a5' : '#e2e8f0'}`,
        boxShadow: isCritical 
          ? '0 6px 20px rgba(239, 68, 68, 0.15)' 
          : '0 4px 14px rgba(0, 0, 0, 0.05)',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '1rem',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 24px rgba(2, 132, 199, 0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = isCritical 
          ? '0 6px 20px rgba(239, 68, 68, 0.15)' 
          : '0 4px 14px rgba(0, 0, 0, 0.05)';
      }}
    >
      {/* Header: Bed Number & Status Tags */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.5rem',
        paddingBottom: '0.4rem',
        borderBottom: '1px solid #f1f5f9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '0.72rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 800,
            background: '#0f172a',
            color: '#ffffff',
            padding: '2px 7px',
            borderRadius: '4px',
            letterSpacing: '0.05em'
          }}>
            BED {bedNumber ? bedNumber.toString().padStart(2, '0') : '--'}
          </span>

          {patient.isSimulated && (
            <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}>
              DEMO DATA
            </span>
          )}

          {isStale && (
            <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}>
              STALE DATA
            </span>
          )}
        </div>

        {/* Risk Badge with Watch & RedSource */}
        <RiskBadge
          level={zone}
          watch={isWatch}
          redSource={redSource}
          size="sm"
        />
      </div>

      {/* Visual Avatar / Graphic Box */}
      <div style={{
        width: '100%',
        height: '110px',
        background: 'linear-gradient(180deg, #f0fdf4 0%, #f8fafc 100%)',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        border: '1px solid #e2e8f0',
        marginBottom: '0.75rem'
      }}>
        <svg width="120" height="90" viewBox="0 0 150 120" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="25" y="15" width="100" height="10" rx="3" fill="#64748b" />
          <rect x="28" y="25" width="6" height="70" fill="#94a3b8" />
          <rect x="116" y="25" width="6" height="70" fill="#94a3b8" />
          <rect x="30" y="22" width="90" height="80" rx="6" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
          <rect x="45" y="26" width="60" height="20" rx="5" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
          <circle cx="75" cy="34" r="13" fill="#fed7aa" />
          <path d="M62 31C63 24 68 20 75 20C82 20 87 24 88 31C85 29 80 28 75 28C70 28 65 29 62 31Z" fill="#78350f" />
          <ellipse cx="75" cy="39" rx="6.5" ry="5" fill="rgba(56, 189, 248, 0.45)" stroke="#0284c7" strokeWidth="1.2" />
          <rect x="48" y="55" width="8" height="32" rx="4" fill="#fed7aa" />
          <rect x="94" y="55" width="8" height="32" rx="4" fill="#fed7aa" />
          <path d="M42 58C42 56 44 54 46 54H104C106 54 108 56 108 58V98C108 100 106 102 104 102H46C44 102 42 100 42 98V58Z" fill="#38bdf8" fillOpacity="0.85" stroke="#0284c7" strokeWidth="1.5" />
          <rect x="25" y="96" width="100" height="8" rx="2" fill="#64748b" />
        </svg>

        {/* Vital Overlay Tag */}
        <div style={{
          position: 'absolute',
          bottom: '6px',
          right: '8px',
          background: 'rgba(15, 23, 42, 0.85)',
          color: '#ffffff',
          padding: '2px 7px',
          borderRadius: '4px',
          fontSize: '0.68rem',
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <Heart size={10} color="#f43f5e" />
          {heartRate !== '-' ? `${heartRate} BPM` : '-'}
        </div>
      </div>

      {/* Patient Data Capsule Box */}
      <div style={{
        width: '100%',
        background: '#f8fafc',
        border: `1.5px solid ${isCritical ? '#f87171' : 'var(--primary-blue)'}`,
        borderRadius: '10px',
        padding: '0.65rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.35rem',
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)'
      }}>
        {/* Name & ID */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {patient.name}
            </div>
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              {patient.id} &bull; {patient.age ? `${patient.age}y` : '-'} {patient.gender ? patient.gender[0] : ''}
            </div>
          </div>
        </div>

        {/* Shared Risk Formatter: Single Line without riskScore + percentage pairing */}
        <div style={{
          fontSize: '0.74rem',
          fontWeight: 700,
          color: statusColor,
          padding: '2px 0'
        }}>
          {formatRisk(p50)}
        </div>

        {/* Quick Vitals Strip (All Null-Safe) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '0.25rem',
          paddingTop: '0.35rem',
          borderTop: '1px solid #e2e8f0',
          fontSize: '0.68rem',
          color: 'var(--text-muted)'
        }}>
          <div>
            <span>HRV: </span>
            <strong style={{ color: 'var(--text-main)' }}>{hrv !== '-' ? `${hrv}ms` : '-'}</strong>
          </div>
          <div>
            <span>BP: </span>
            <strong style={{ color: 'var(--text-main)' }}>{bloodPressure}</strong>
          </div>
          <div>
            <span>SpO2: </span>
            <strong style={{ color: '#047857' }}>{spo2 !== '-' ? `${spo2}%` : '-'}</strong>
          </div>
        </div>

        {/* Action cue */}
        <div style={{
          marginTop: '2px',
          textAlign: 'center',
          fontSize: '0.68rem',
          fontWeight: 700,
          color: 'var(--primary-blue)',
          paddingTop: '2px'
        }}>
          Inspect Digital Twin ➔
        </div>
      </div>
    </div>
  );
}
