import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Send, 
  Calendar, 
  PhoneCall, 
  X, 
  CheckCircle2, 
  AlertOctagon
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function CareActionModal({ patient, onClose, onActionTriggered }) {
  const [selectedAction, setSelectedAction] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');

  const riskLevel = patient?.riskLevel || 'elevated';

  const actionProtocols = {
    critical: [
      {
        id: 'act-crit-1',
        title: 'Escalate to Acute Cardiology Telemetry',
        badge: 'Priority Alpha',
        icon: AlertOctagon,
        description: 'Page attending electrophysiologist & dispatch urgent continuous telemetry bed review.',
        recommended: true
      },
      {
        id: 'act-crit-2',
        title: 'Immediate Clinical Outbound Contact',
        badge: 'Urgent',
        icon: PhoneCall,
        description: 'Initiate high-priority outbound call to patient and emergency care contact.',
        recommended: false
      }
    ],
    elevated: [
      {
        id: 'act-elev-1',
        title: 'Schedule Expedited Telehealth Follow-up',
        badge: 'Recommended',
        icon: Calendar,
        description: 'Book a 48-hour remote cardiology review with attending physician.',
        recommended: true
      },
      {
        id: 'act-elev-2',
        title: 'Transmit Autonomic Recovery Advisory to Patient App',
        badge: 'Patient Loop',
        icon: Send,
        description: 'Send personalized guidance regarding sleep hygiene, stress reduction, and hydration.',
        recommended: false
      }
    ],
    stable: [
      {
        id: 'act-stab-1',
        title: 'Continue Passive Digital Twin Monitoring',
        badge: 'Standard Protocol',
        icon: CheckCircle2,
        description: 'All biometric feeds within physiological reference bounds. Next routine review in 3 months.',
        recommended: true
      }
    ]
  };

  const currentProtocols = actionProtocols[riskLevel] || actionProtocols.elevated;

  const handleExecute = () => {
    if (!selectedAction) return;

    setIsSuccess(true);
    setSuccessMessage(`Care action initiated: "${selectedAction.title}" for ${patient.name || patient.id}. Dispatched to care team.`);

    try {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    } catch (e) {}

    if (onActionTriggered) {
      onActionTriggered({
        action: selectedAction,
        patientId: patient.id,
        notes: clinicalNotes,
        timestamp: new Date().toLocaleTimeString()
      });
    }
  };

  return (
    <div className="modal-overlay-light" onClick={onClose}>
      <div className="modal-content-light" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.85rem', marginBottom: '1rem' }}>
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
              <ShieldAlert size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Clinical Care Action & Escalation Protocol
                </h2>
                <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                  DEMO DATA
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Patient: <strong style={{ color: 'var(--text-main)' }}>{patient.name || patient.id}</strong> &bull; Status: {riskLevel.toUpperCase()}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              color: 'var(--text-muted)',
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-full)',
              background: '#ecfdf5',
              border: '2px solid #10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
              color: '#047857'
            }}>
              <CheckCircle2 size={30} />
            </div>
            <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>
              Care Action Executed Successfully
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto 1.5rem auto', lineHeight: 1.5 }}>
              {successMessage}
            </p>
            <button className="btn-clean btn-clean-primary" onClick={onClose}>
              Return
            </button>
          </div>
        ) : (
          <>
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-md)',
              background: '#f8fafc',
              border: '1px solid var(--border-light)',
              marginBottom: '1rem',
              fontSize: '0.78rem',
              color: 'var(--text-muted)'
            }}>
              <strong style={{ color: 'var(--text-main)' }}>Demonstration Care Pathway:</strong> Select an action pathway below (demonstration protocol).
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
              {currentProtocols.map(proto => {
                const Icon = proto.icon;
                const isSelected = selectedAction?.id === proto.id;

                return (
                  <div
                    key={proto.id}
                    onClick={() => setSelectedAction(proto)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.85rem',
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      border: isSelected ? '1.5px solid var(--primary-blue)' : '1px solid var(--border-light)',
                      cursor: 'pointer',
                      transition: 'all var(--transition)'
                    }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'var(--primary-blue)' : '#f1f5f9',
                      color: isSelected ? '#ffffff' : 'var(--text-main)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={16} />
                    </div>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                          {proto.title}
                        </span>
                        <span style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 3,
                          background: proto.recommended ? '#ecfdf5' : '#f1f5f9',
                          color: proto.recommended ? '#047857' : 'var(--text-muted)'
                        }}>
                          {proto.badge}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                        {proto.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                Attending Clinician Addendum
              </label>
              <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Add specific instructions for care team..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-md)',
                  background: '#ffffff',
                  border: '1px solid var(--border-medium)',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  resize: 'none',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
              <button className="btn-clean btn-clean-secondary" onClick={onClose}>
                Cancel
              </button>
              <button
                className="btn-clean btn-clean-primary"
                disabled={!selectedAction}
                onClick={handleExecute}
                style={{ opacity: selectedAction ? 1 : 0.5, cursor: selectedAction ? 'pointer' : 'not-allowed' }}
              >
                <Send size={13} /> Confirm & Dispatch Protocol
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
