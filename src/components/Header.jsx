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
  Building2,
  Sun,
  Moon
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
  onOpenCareAction,
  theme = 'light',
  onToggleTheme
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
                    <div className="patient-meta-item">
                      <span className="meta-label">MRN</span>
                      <span className="meta-val" style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary-blue)' }}>
                        #{activePatient.id.replace('PT-', '984')}
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
                      <span className="meta-val">{activePatient.bedNumber ? `Ward Bed ${activePatient.bedNumber}` : (activePatient.bed || 'ICU Bed 01')}</span>
                    </div>
                    <div className="patient-meta-item">
                      <span className="meta-label">Primary Cardiologist</span>
                      <span className="meta-val">{activePatient.doctor || 'Dr. Sarah Chen, MD'}</span>
                    </div>
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
                      Cardiology Ward 4B &bull; Central Telemetry
                    </h2>
                    <span style={{ fontSize: '0.7rem', background: '#ecfdf5', color: '#047857', fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
                      8 Beds Connected
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Shift Supervisor: <strong>Dr. Sarah Chen, MD</strong> &bull; Continuous Wearable PPG Sync
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Doctor Actions & Switch Portal Profile Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button 
              className="btn-clean btn-clean-secondary"
              onClick={() => alert(`Exporting Hospital Clinical Dossier for ${activePatient.name} (PDF)...`)}
            >
              <Download size={14} /> Clinical PDF
            </button>

            <button 
              className="btn-clean btn-clean-secondary"
              onClick={onOpenHistory}
            >
              <History size={14} /> History
            </button>

            {/* Theme Toggle Button (Global Light / Dark Mode) */}
            <button
              onClick={onToggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
              title="Toggle Light / Dark Mode across the application"
            >
              {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#0284c7" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

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
              {activePatient.name ? activePatient.name.split(' ').map(n => n[0]).join('') : 'PT'}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
                  {activePatient.name}
                </h2>
                <RiskBadge level={activePatient.riskLevel} score={activePatient.riskScore} />
                <span style={{ fontSize: '0.72rem', background: '#f1f5f9', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
                  Personal Health Twin
                </span>
              </div>

              <div className="patient-meta-grid" style={{ marginTop: '0.2rem' }}>
                <div className="patient-meta-item">
                  <span className="meta-label">Patient ID</span>
                  <span className="meta-val" style={{ fontFamily: 'var(--font-mono)' }}>
                    #{activePatient.id ? activePatient.id.replace('PT-', '984') : '9848092'}
                  </span>
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">Age</span>
                  <span className="meta-val">{activePatient.age}y {activePatient.gender}</span>
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">Attending Cardiologist</span>
                  <span className="meta-val" style={{ color: 'var(--primary-blue)' }}>
                    {activePatient.doctor || 'Dr. Sarah Chen, MD'}
                  </span>
                </div>
                <div className="patient-meta-item">
                  <span className="meta-label">Next Scheduled Review</span>
                  <span className="meta-val">
                    {activePatient.nextReview || 'Oct 28, 2026 (10:00 AM)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Patient Actions & Switch Portal Profile Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
            <button 
              className="btn-clean btn-clean-secondary"
              onClick={() => alert(`Downloading personalized health summary for ${activePatient.name} (PDF)...`)}
            >
              <Download size={14} /> My Summary PDF
            </button>

            {/* Theme Toggle Button (Global Light / Dark Mode) */}
            <button
              onClick={onToggleTheme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '0.78rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all var(--transition)'
              }}
              title="Toggle Light / Dark Mode across the application"
            >
              {theme === 'dark' ? <Sun size={14} color="#f59e0b" /> : <Moon size={14} color="#0284c7" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
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
              onClick={() => alert(`Initiating direct emergency contact with ${activePatient.doctor || 'Dr. Sarah Chen'}’s triage clinic...`)}
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
              <span>{activePatient.name}</span>
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
