import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  AlertTriangle, 
  AlertOctagon, 
  Search, 
  ArrowRight,
  Activity,
  Radio
} from 'lucide-react';
import PatientCard from '../components/PatientCard';
import RiskBadge from '../components/RiskBadge';

export default function CommandCenterView({ patients = [], selectedPatient, onSelectPatient, onNavigateToTwin }) {
  const [filterRisk, setFilterRisk] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const stats = {
    total: patients.length,
    stable: patients.filter(p => p.riskLevel === 'stable').length,
    elevated: patients.filter(p => p.riskLevel === 'elevated').length,
    critical: patients.filter(p => p.riskLevel === 'critical').length
  };

  const filteredPatients = patients.filter(p => {
    const matchesRisk = filterRisk === 'all' || p.riskLevel === filterRisk;
    const matchesSearch = 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRisk && matchesSearch;
  });

  return (
    <div className="page-container">
      {/* Top Clinical Stats */}
      <div className="grid-4">
        <div className="clean-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Monitored Cohort
            </span>
            <Users size={16} color="var(--primary-blue)" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-main)' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--primary-blue)', marginTop: '0.2rem' }}>
            Daily Wearable Telemetry
          </div>
        </div>

        <div 
          className="clean-card" 
          style={{ cursor: 'pointer', border: filterRisk === 'stable' ? '2px solid #10b981' : '1px solid var(--border-light)' }}
          onClick={() => setFilterRisk(filterRisk === 'stable' ? 'all' : 'stable')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase' }}>
              Stable Baseline
            </span>
            <ShieldCheck size={16} color="#10b981" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#047857' }}>
            {stats.stable}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Homeostasis verified
          </div>
        </div>

        <div 
          className="clean-card" 
          style={{ cursor: 'pointer', border: filterRisk === 'elevated' ? '2px solid #f59e0b' : '1px solid var(--border-light)' }}
          onClick={() => setFilterRisk(filterRisk === 'elevated' ? 'all' : 'elevated')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', textTransform: 'uppercase' }}>
              Attention Required
            </span>
            <AlertTriangle size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#b45309' }}>
            {stats.elevated}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Autonomic drift flagged
          </div>
        </div>

        <div 
          className="clean-card" 
          style={{ cursor: 'pointer', border: filterRisk === 'critical' ? '2px solid #ef4444' : '1px solid var(--border-light)' }}
          onClick={() => setFilterRisk(filterRisk === 'critical' ? 'all' : 'critical')}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase' }}>
              Critical Warnings
            </span>
            <AlertOctagon size={16} color="#ef4444" />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#b91c1c' }}>
            {stats.critical}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Telemetry escalation active
          </div>
        </div>
      </div>

      {/* Cohort Grid Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
            Cardiovascular Digital Twin Cohort
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Daily multi-modal patient state tracking with predictive risk scoring (demo)
          </p>
        </div>

        {/* Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search cohort..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '0.45rem 0.65rem 0.45rem 2rem',
                borderRadius: 'var(--radius-md)',
                background: '#ffffff',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: '#ffffff', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            {[
              { key: 'all', label: 'All' },
              { key: 'critical', label: 'Critical' },
              { key: 'elevated', label: 'Elevated' },
              { key: 'stable', label: 'Stable' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterRisk(f.key)}
                style={{
                  padding: '0.3rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: filterRisk === f.key ? 'var(--primary-blue-subtle)' : 'transparent',
                  color: filterRisk === f.key ? 'var(--primary-blue)' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Patient Cards Grid */}
      <div className="grid-3">
        {filteredPatients.map(patient => (
          <PatientCard
            key={patient.id}
            patient={patient}
            isSelected={selectedPatient?.id === patient.id}
            onSelect={(p) => {
              onSelectPatient(p);
              onNavigateToTwin();
            }}
          />
        ))}
      </div>
    </div>
  );
}
