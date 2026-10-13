import React from 'react';
import { 
  ArrowLeft, 
  Download, 
  History, 
  Scan, 
  ShieldAlert, 
  User,
  Heart,
  PhoneCall,
  RefreshCw,
  LogOut,
  Stethoscope,
  Building2
} from 'lucide-react';
import RiskBadge from './RiskBadge';

export default function Header({ 
  activePatient, 
  userRole = 'doctor',
  onOpenGateway,
  currentView,
  onNavigateToWard,
  onDownloadReport, 
  onOpenHistory, 
  onStartScanning,
  onOpenCareAction
}) {
  if (!activePatient) return null;

  return (
    <header className="top-patient-ribbon">
      {/* ================= DOCTOR VIEW HEADER ================= */}
      {userRole === 'doctor' ? (
        <>
          <div className="patient-info-cluster">
            {currentView !== 'ward' ? (
              <>
                <button
                  onClick={onNavigateToWard}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#0f172a',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}
                  title="Return to 8-Bed Hospital Ward Overview"
                >
                  <ArrowLeft size={14} /> Back to Ward Beds
                </button>

                <div className="patient-avatar-box">
                  {activePatient.name.split(' ').map(n => n[0]).join('')}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                      {activePatient.name}
                    </h2>
                    <RiskBadge level={activePatient.riskLevel} score={activePatient.riskScore} />
                  </div>

                  <div className="patient-meta-grid" style={{ marginTop: '0.2rem' }}>
                    {activePatient.isSimulated ? (
                      <>
                        <div className="patient-meta-item">
                          <span className="meta-label">MRN</span>
                          <span className="meta-val" style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-blue)' }}>
                            #{activePatient.id.replace('PT-', '984')} (DEMO)
                          </span>
                        </div>
                        <div className="patient-meta-item">
                          <span className="meta-label">Age</span>
                          <span className="meta-val">{activePatient.age}y</span>
                        </div>
                        <div className="patient-meta-item">
                          <span className="meta-label">Gender</span>
                          <span className="meta-val">{activePatient.gender}</span>
                        </div>
                        <div className="patient-meta-item">
                          <span className="meta-label">Bed</span>
                          <span className="meta-val">Bed 01 (DEMO)</span>
                        </div>
                        <div className="patient-meta-item">
                          <span className="meta-label">Primary Cardiologist</span>
                          <span className="meta-val">Dr. Sarah Chen, MD (DEMO)</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="patient-meta-item">
                          <span className="meta-label">Mode</span>
                          <span className="meta-val" style={{ color: '#047857', fontWeight: 700 }}>
                            Remote monitoring
                          </span>
                        </div>
                        <div className="patient-meta-item">
                          <span className="meta-label">Patient ID</span>
                          <span className="meta-val" style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-blue)' }}>
                            {activePatient.id}
                          </span>
                        </div>
                        <div className="patient-meta-item">
                          <span className="meta-label">Age</span>
                          <span className="meta-val">{activePatient.age}y</span>
                        </div>
                        <div className="patient-meta-item">
                          <span className="meta-label">Gender</span>
                          <span className="meta-val">{activePatient.gender}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* Doctor is on Ward Overview */
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: 42,
                  height: 42,
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, #0284c7, #0d9488)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)'
                }}>
                  <Building2 size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                      Post-discharge remote monitoring &bull; Central Telemetry
                    </h2>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {activePatient.isSimulated ? (
                      <>Shift Supervisor: <strong>Dr. Sarah Chen, MD (DEMO)</strong> &bull; Daily wearable summaries</>
                    ) : (
                      <>Post-discharge remote monitoring &bull; Daily wearable summaries</>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Doctor Actions & Switch Portal Profile Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <button 
              className="btn-clean btn-clean-secondary"
              disabled
              title="Not implemented in this demo"
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            >
              <Download size={14} /> Clinical PDF
            </button>

            <button 
              className="btn-clean btn-clean-secondary"
              onClick={onOpenHistory}
            >
              <History size={14} /> History
            </button>

            <button 
              className="btn-clean btn-clean-teal"
              disabled
              title="Not implemented in this demo"
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            >
              <Scan size={14} /> Start Telemetry
            </button>

            {activePatient.isSimulated && (
              <button 
                className="btn-clean btn-clean-primary"
                onClick={onOpenCareAction}
              >
                Care Action Loop (DEMO)
              </button>
            )}

            {/* Doctor Account Badge with Switch Portal Action */}
            <button
              onClick={onOpenGateway}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: '#f0f9ff',
                border: '1.5px solid #bae6fd',
                color: 'var(--primary-blue)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
              title="Click to Switch Portal Role"
            >
              <Stethoscope size={14} />
              <span>Dr. Sarah Chen</span>
              <span style={{ fontSize: '0.68rem', background: 'var(--primary-blue)', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>
                Doctor
              </span>
              <LogOut size={12} style={{ marginLeft: 2 }} />
            </button>
          </div>
        </>
      ) : (
        /* ================= PATIENT VIEW HEADER ================= */
        <>
          <div className="patient-info-cluster">
            <div className="patient-avatar-box" style={{ background: 'linear-gradient(135deg, #0f172a, #334155)' }}>
              RS
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                  Rahul Sharma
                </h2>
                <RiskBadge level={activePatient.riskLevel} score={activePatient.riskScore} />
                <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                  Personal Health Twin
                </span>
              </div>

              <div className="patient-meta-grid" style={{ marginTop: '0.2rem' }}>
                <div className="patient-meta-item">
                  <span className="meta-label">Patient ID</span>
                  <span className="meta-val" style={{ fontFamily: 'var(--font-mono)' }}>#9848092</span>
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">Age</span>
                  <span className="meta-val">52y Male</span>
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">Attending Cardiologist</span>
                  <span className="meta-val" style={{ color: 'var(--primary-blue)' }}>Dr. Sarah Chen, MD</span>
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">Next Scheduled Review</span>
                  <span className="meta-val">Oct 14, 2026 (10:00 AM)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Patient Actions & Switch Portal Profile Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button 
              className="btn-clean btn-clean-secondary"
              onClick={() => alert(`Downloading your personalized health summary (PDF)...`)}
            >
              <Download size={14} /> My Summary PDF
            </button>

            <button 
              className="btn-clean btn-clean-teal"
              onClick={() => alert('Syncing your connected Apple Watch data...')}
            >
              <RefreshCw size={13} /> Sync Smartwatch
            </button>

            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              onClick={() => alert('Initiating direct emergency contact with Dr. Sarah Chen’s triage clinic...')}
            >
              <PhoneCall size={13} /> Call Care Clinic
            </button>

            {/* Patient Account Badge with Switch Portal Action */}
            <button
              onClick={onOpenGateway}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: '#f8fafc',
                border: '1.5px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
              title="Click to Switch Portal Role"
            >
              <User size={14} />
              <span>Rahul Sharma</span>
              <span style={{ fontSize: '0.68rem', background: '#0f172a', color: '#fff', padding: '1px 5px', borderRadius: 3 }}>
                Patient
              </span>
              <LogOut size={12} style={{ marginLeft: 2 }} />
            </button>
          </div>
        </>
      )}
    </header>
  );
}
