import React, { useState } from 'react';
import { FolderArchive, User } from 'lucide-react';
import MedicalRecordsVault from '../components/MedicalRecordsVault';
import RiskBadge from '../components/RiskBadge';

export default function RecordsView({ patient, patients = [], onSelectPatient }) {
  const [selectedPatientId, setSelectedPatientId] = useState(patient.id);
  const currentPatient = patients.find(p => p.id === selectedPatientId) || patient;

  return (
    <div className="page-container">
      {/* Honesty Banner */}
      <div
        style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          marginBottom: '1.25rem',
          fontSize: '0.8rem',
          color: '#92400e',
          lineHeight: 1.45
        }}
      >
        DEMO DATA - synthetic sample medical records and diagnostic files. Not from this patient's actual medical history. Shown for interface demonstration only.
      </div>

      <div className="clean-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-blue-subtle)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FolderArchive size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Electronic Health Records & Diagnostic Vault
              </h1>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                FHIR-compliant patient document archive with continuous wearable telemetry integration
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Viewing Records For:</span>
            <select
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                const p = patients.find(pt => pt.id === e.target.value);
                if (p) onSelectPatient(p);
              }}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: '#ffffff',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '0.82rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              {patients.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.id})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <MedicalRecordsVault records={currentPatient.records} patient={currentPatient} />
    </div>
  );
}
