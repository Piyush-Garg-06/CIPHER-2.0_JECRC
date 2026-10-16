import React, { useState, useEffect } from 'react';
import { Search, X, User, ArrowRight } from 'lucide-react';
import RiskBadge from './RiskBadge';

export default function GlobalSearchModal({ isOpen, onClose, patients = [], onSelectPatient, onSelectView }) {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.id.toLowerCase().includes(query.toLowerCase()) ||
    p.clinicalHeadline.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="modal-overlay-light" onClick={onClose}>
      <div className="modal-content-light" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', padding: '1.25rem' }}>
        {/* Search input */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <Search size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--primary-blue)' }} />
          <input
            type="text"
            placeholder="Search patients, ID, condition..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '0.65rem 0.75rem 0.65rem 2.4rem',
              borderRadius: 'var(--radius-md)',
              background: '#f8fafc',
              border: '1.5px solid var(--primary-blue)',
              color: 'var(--text-main)',
              fontSize: '0.9rem',
              outline: 'none'
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: '340px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
          {filteredPatients.map(p => (
            <div
              key={p.id}
              onClick={() => {
                onSelectPatient(p);
                onSelectView('digital-twin');
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: '#ffffff',
                border: '1px solid var(--border-light)',
                cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary-blue)';
                e.currentTarget.style.background = '#f0f9ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-light)';
                e.currentTarget.style.background = '#ffffff';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-full)',
                  background: '#e0f2fe',
                  color: 'var(--primary-blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {p.name} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>({p.id})</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {p.age} yrs &bull; {p.gender} &bull; HR: {p.vitals.heartRate} BPM &bull; HRV: {p.vitals.hrv} ms
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <RiskBadge level={p.riskLevel} score={p.riskScore} size="sm" />
                <ArrowRight size={14} color="#94a3b8" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
