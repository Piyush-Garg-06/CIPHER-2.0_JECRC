import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Bell, 
  AlertOctagon, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User, 
  ArrowUpRight,
  Check
} from 'lucide-react';
import CareActionModal from '../components/CareActionModal';

export default function AlertsView({ 
  alerts = [], 
  patients = [], 
  onMarkRead, 
  onSelectPatient, 
  onNavigateToTwin 
}) {
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [selectedPatientForCare, setSelectedPatientForCare] = useState(null);

  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity === 'all') return true;
    if (filterSeverity === 'unread') return !a.isRead;
    return a.severity === filterSeverity;
  });

  const getSeverityIcon = (sev) => {
    switch (sev) {
      case 'critical': return <AlertOctagon size={18} color="#ef4444" />;
      case 'elevated': return <AlertTriangle size={18} color="#f59e0b" />;
      default: return <CheckCircle2 size={18} color="#10b981" />;
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="clean-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: '#fee2e2',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShieldAlert size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Clinical Alert & Early Warning Triage Center
              </h1>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Real-time automated alerts triggered by Digital Twin multi-parameter physiological deviation
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-card-hover)', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            {[
              { key: 'all', label: 'All Alerts' },
              { key: 'unread', label: 'Unread' },
              { key: 'critical', label: 'Critical' },
              { key: 'elevated', label: 'Elevated' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterSeverity(f.key)}
                style={{
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  background: filterSeverity === f.key ? 'var(--bg-card)' : 'transparent',
                  color: filterSeverity === f.key ? 'var(--primary-blue)' : 'var(--text-muted)',
                  border: filterSeverity === f.key ? '1px solid var(--border-medium)' : 'none',
                  boxShadow: filterSeverity === f.key ? 'var(--shadow-subtle)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Alerts Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        {filteredAlerts.map(alert => {
          const patient = patients.find(p => p.id === alert.patientId);

          return (
            <div
              key={alert.id}
              className="clean-card"
              style={{
                padding: '1.15rem',
                border: alert.severity === 'critical' ? '1.5px solid rgba(239, 68, 68, 0.4)' : alert.severity === 'elevated' ? '1.5px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-light)',
                background: !alert.isRead ? 'var(--bg-card-hover)' : 'var(--bg-card)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '1rem',
                flexWrap: 'wrap'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', flex: 1, minWidth: '280px' }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 'var(--radius-md)',
                  background: alert.severity === 'critical' ? '#fee2e2' : alert.severity === 'elevated' ? '#fef3c7' : '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  {getSeverityIcon(alert.severity)}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {alert.title}
                    </span>
                    {!alert.isRead && (
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        background: 'var(--primary-blue)',
                        color: '#ffffff',
                        fontWeight: 700
                      }}>
                        NEW
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.45, marginBottom: '0.5rem' }}>
                    {alert.description}
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {alert.patientName} ({alert.patientId})
                    </span>
                    <span>&bull;</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={12} /> {alert.timestamp}
                    </span>
                    <span>&bull;</span>
                    <span style={{ color: alert.severity === 'critical' ? '#b91c1c' : alert.severity === 'elevated' ? '#b45309' : 'var(--text-muted)' }}>
                      Action: {alert.actionRequired}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {!alert.isRead && (
                  <button
                    className="btn-clean btn-clean-secondary"
                    onClick={() => onMarkRead(alert.id)}
                  >
                    <Check size={13} /> Acknowledge
                  </button>
                )}

                <button
                  className="btn-clean btn-clean-primary"
                  onClick={() => {
                    if (patient) onSelectPatient(patient);
                    onNavigateToTwin();
                  }}
                >
                  <ArrowUpRight size={13} /> Open Twin
                </button>

                <button
                  className="btn-clean btn-clean-secondary"
                  onClick={() => {
                    if (patient) setSelectedPatientForCare(patient);
                  }}
                >
                  Care Protocol
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedPatientForCare && (
        <CareActionModal
          patient={selectedPatientForCare}
          onClose={() => setSelectedPatientForCare(null)}
          onActionTriggered={() => setSelectedPatientForCare(null)}
        />
      )}
    </div>
  );
}
