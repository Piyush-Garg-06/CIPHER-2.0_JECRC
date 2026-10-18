import React, { useState } from 'react';
import { 
  Clock, 
  Activity, 
  FileText, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

export default function PatientTimeline({ timeline = [] }) {
  const [filterType, setFilterType] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const filteredEvents = timeline.filter(evt => {
    if (filterType === 'all') return true;
    return evt.type === filterType;
  });

  const getEventIcon = (type) => {
    switch (type) {
      case 'wearable': return <Activity size={13} />;
      case 'ehr': return <FileText size={13} />;
      case 'prediction': return <Sparkles size={13} />;
      case 'alert': return <AlertTriangle size={13} />;
      default: return <Clock size={13} />;
    }
  };

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
            <Clock size={18} />
          </div>
          <div>
            <div className="clean-card-title">
              Chronological Health Timeline
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Wearable telemetry, EHR encounters & prediction triggers
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'var(--bg-card-hover)', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'wearable', label: 'Wearables' },
            { key: 'ehr', label: 'EHR' },
            { key: 'prediction', label: 'Predictions' },
            { key: 'alert', label: 'Alerts' }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.72rem',
                fontWeight: 600,
                background: filterType === f.key ? 'var(--bg-card)' : 'transparent',
                color: filterType === f.key ? 'var(--primary-blue)' : 'var(--text-muted)',
                border: filterType === f.key ? '1px solid var(--border-medium)' : 'none',
                boxShadow: filterType === f.key ? 'var(--shadow-subtle)' : 'none',
                cursor: 'pointer'
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Stream */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {filteredEvents.map((evt) => {
          const isExpanded = expandedId === evt.id;

          return (
            <div
              key={evt.id}
              onClick={() => setExpandedId(isExpanded ? null : evt.id)}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '0.85rem 1rem',
                cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--border-medium)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  {evt.date} &bull; {evt.time}
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: evt.severity === 'critical' ? '#fef2f2' : evt.severity === 'elevated' ? '#fffbeb' : '#ecfdf5',
                  color: evt.severity === 'critical' ? '#b91c1c' : evt.severity === 'elevated' ? '#b45309' : '#047857'
                }}>
                  {evt.type}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                  {evt.title}
                </div>
                {isExpanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
              </div>

              {isExpanded && (
                <div style={{
                  marginTop: '0.5rem',
                  paddingTop: '0.5rem',
                  borderTop: '1px solid #f1f5f9',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)',
                  lineHeight: 1.5
                }}>
                  {evt.description}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
