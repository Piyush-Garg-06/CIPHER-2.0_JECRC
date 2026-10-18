import React from 'react';
import { 
  Heart, 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Zap, 
  Clock, 
  ArrowUpRight,
  ShieldAlert
} from 'lucide-react';
import RiskBadge from './RiskBadge';
import Sparkline from './Sparkline';

export default function PatientCard({ patient, isSelected, onSelect }) {
  const getTrendIcon = () => {
    switch (patient.riskTrend) {
      case 'increasing':
        return <TrendingUp size={13} color="#ef4444" />;
      case 'decreasing':
        return <TrendingDown size={13} color="#10b981" />;
      default:
        return <Minus size={13} color="#94a3b8" />;
    }
  };

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
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '1px' }}>
            {patient.age} yrs &bull; {patient.gender} &bull; <span style={{ fontFamily: 'var(--font-mono)' }}>{patient.id}</span>
          </div>
        </div>

        <RiskBadge level={patient.riskLevel} score={patient.riskScore} size="sm" />
      </div>

      {/* Primary Risk Box */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.65rem 0.85rem',
        borderRadius: 'var(--radius-md)',
        background: '#f8fafc',
        border: '1px solid var(--border-light)'
      }}>
        <div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cardiovascular Risk
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: patient.riskLevel === 'critical' ? '#ef4444' : patient.riskLevel === 'elevated' ? '#f59e0b' : '#10b981' }}>
            {patient.riskScore} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>({patient.riskPercentage}%)</span>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            7-Day Velocity
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: 'flex-end', fontSize: '0.85rem', fontWeight: 700, color: patient.riskTrend === 'increasing' ? '#ef4444' : patient.riskTrend === 'decreasing' ? '#10b981' : 'var(--text-muted)' }}>
            {getTrendIcon()}
            <span>{patient.riskTrendValue}</span>
          </div>
        </div>
      </div>

      {/* Sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Risk Velocity (9d):
        </div>
        <Sparkline data={patient.sparkline} level={patient.riskLevel} width={130} height={32} />
      </div>

      {/* Vitals Summary */}
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
            {patient.vitals.heartRate} BPM
          </span>
        </div>
        <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>HRV</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: patient.vitals.hrvChange7d < 0 ? '#b45309' : 'var(--text-main)' }}>
            {patient.vitals.hrv} ms
          </span>
        </div>
        <div style={{ textAlign: 'center' }}>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>Steps</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
            {patient.vitals.dailySteps.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
