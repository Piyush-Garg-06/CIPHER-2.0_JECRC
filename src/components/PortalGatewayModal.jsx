import React from 'react';
import { Stethoscope, User, ShieldCheck, ArrowRight, X, Building2, Heart } from 'lucide-react';

export default function PortalGatewayModal({ isOpen, onClose, currentRole, onSelectRole }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '1.5rem'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '24px',
        maxWidth: '760px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid var(--border-light)'
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem 2.5rem 1.25rem 2.5rem',
          textAlign: 'center',
          borderBottom: '1px solid #f1f5f9',
          position: 'relative'
        }}>
          {onClose && (
            <button
              onClick={onClose}
              style={{
                position: 'absolute',
                right: '1.5rem',
                top: '1.5rem',
                background: '#f1f5f9',
                border: 'none',
                borderRadius: '50%',
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--text-muted)'
              }}
            >
              <X size={16} />
            </button>
          )}

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'var(--primary-blue-subtle)',
            color: 'var(--primary-blue)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            fontSize: '0.78rem',
            fontWeight: 700,
            marginBottom: '0.65rem'
          }}>
            <ShieldCheck size={14} /> DEMO ROLE SWITCH
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
            Select Portal Access
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Demo role switch - no authentication
          </p>
        </div>

        {/* 2 Role Cards */}
        <div style={{
          padding: '2rem 2.5rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1.5rem'
        }}>
          {/* 1. DOCTOR PORTAL */}
          <div
            onClick={() => onSelectRole('doctor')}
            style={{
              border: currentRole === 'doctor' ? '2.5px solid var(--primary-blue)' : '1.5px solid var(--border-medium)',
              borderRadius: '18px',
              padding: '1.75rem 1.5rem',
              cursor: 'pointer',
              background: currentRole === 'doctor' ? '#f0f9ff' : '#ffffff',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: currentRole === 'doctor' ? '0 8px 20px rgba(2, 132, 199, 0.12)' : '0 2px 8px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.borderColor = 'var(--primary-blue)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              if (currentRole !== 'doctor') e.currentTarget.style.borderColor = 'var(--border-medium)';
            }}
          >
            <div>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7, #0d9488)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)'
              }}>
                <Stethoscope size={24} />
              </div>

              <div style={{
                display: 'inline-block',
                fontSize: '0.7rem',
                fontWeight: 800,
                color: 'var(--primary-blue)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Clinical Staff Portal
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                Doctor Portal
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                Dr. Sarah Chen, MD (Cardiology Lead) - Demo
              </div>

              <ul style={{
                marginTop: '1rem',
                paddingLeft: '1.15rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                lineHeight: 1.6
              }}>
                <li>8-Bed Post-Discharge Monitoring Ward matrix</li>
                <li>Multi-patient clinical risk triage</li>
                <li>Prescription & lab orders management (DEMO)</li>
                <li>Decision-support care action loops (DEMO)</li>
              </ul>
            </div>

            <button
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: currentRole === 'doctor' ? 'var(--primary-blue)' : '#0f172a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <span>Access Doctor Portal</span>
              <ArrowRight size={14} />
            </button>
          </div>

          {/* 2. PATIENT PORTAL */}
          <div
            onClick={() => onSelectRole('patient')}
            style={{
              border: currentRole === 'patient' ? '2.5px solid #0f172a' : '1.5px solid var(--border-medium)',
              borderRadius: '18px',
              padding: '1.75rem 1.5rem',
              cursor: 'pointer',
              background: currentRole === 'patient' ? '#f8fafc' : '#ffffff',
              transition: 'all 0.2s ease',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: currentRole === 'patient' ? '0 8px 20px rgba(15, 23, 42, 0.12)' : '0 2px 8px rgba(0,0,0,0.04)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.borderColor = '#0f172a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              if (currentRole !== 'patient') e.currentTarget.style.borderColor = 'var(--border-medium)';
            }}
          >
            <div>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0f172a, #334155)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1rem',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)'
              }}>
                <User size={24} />
              </div>

              <div style={{
                display: 'inline-block',
                fontSize: '0.7rem',
                fontWeight: 800,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Patient Personal Portal
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                Patient Portal
              </h3>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: '2px' }}>
                Rahul Sharma (MRN #9848092)
              </div>

              <ul style={{
                marginTop: '1rem',
                paddingLeft: '1.15rem',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
                lineHeight: 1.6
              }}>
                <li>Personal 3D Digital Twin & telemetry</li>
                <li>Prescribed medication timings & reminders</li>
                <li>7-day health recovery trajectory</li>
                <li>AI assistant & condition tutorials</li>
              </ul>
            </div>

            <button
              style={{
                marginTop: '1.5rem',
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-md)',
                background: '#0f172a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <span>Access Patient Portal</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div style={{
          padding: '1rem 2.5rem',
          background: '#f8fafc',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <span>Role-Based Access Control (RBAC) enforced</span>
          <span>DPDP Act & HIPAA Privacy Standard</span>
        </div>
      </div>
    </div>
  );
}
