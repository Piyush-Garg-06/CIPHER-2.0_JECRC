import React from 'react';
import { 
  HeartHandshake, 
  Search, 
  Home, 
  Pill, 
  BrainCircuit, 
  Bot, 
  BookOpen, 
  FolderArchive, 
  Bell, 
  Building2,
  User,
  Settings, 
  HelpCircle 
} from 'lucide-react';

export default function Sidebar({ currentView, onViewChange, unreadAlertCount, onOpenSearch, userRole = 'doctor', isLive }) {
  const doctorNavItems = [
    {
      id: 'ward',
      label: 'Hospital Ward Beds',
      desc: 'Remote monitoring matrix',
      icon: Building2
    },
    {
      id: 'home',
      label: 'Patient Digital Twin',
      desc: 'Live status & 3D twin',
      icon: Home
    },
    {
      id: 'medications',
      label: 'Medication & Reports',
      desc: 'Sample data (demo)',
      icon: Pill
    },
    {
      id: 'predictions',
      label: 'Prediction',
      desc: '7-day trajectory & XAI',
      icon: BrainCircuit
    },
    {
      id: 'chatbot',
      label: 'AI Chatbot',
      desc: 'Scripted data assistant',
      icon: Bot
    },
    {
      id: 'records',
      label: 'Medical Records',
      desc: 'Sample data (demo)',
      icon: FolderArchive
    },
    {
      id: 'alerts',
      label: 'Alerts Triage',
      desc: 'Early warning signals',
      icon: Bell,
      badge: isLive ? unreadAlertCount : 0
    }
  ];

  const patientNavItems = [
    {
      id: 'home',
      label: 'My Digital Twin',
      desc: 'Live vitals & personal twin',
      icon: Home
    },
    {
      id: 'medications',
      label: 'My Medications',
      desc: 'Sample data (demo)',
      icon: Pill
    },
    {
      id: 'predictions',
      label: 'Risk Forecast',
      desc: '7-day health trajectory',
      icon: BrainCircuit
    },
    {
      id: 'chatbot',
      label: 'AI Health Assistant',
      desc: 'Scripted data assistant',
      icon: Bot
    },
    {
      id: 'magazine',
      label: 'Health Magazine',
      desc: 'Video tutorials & wellness',
      icon: BookOpen
    },
    {
      id: 'records',
      label: 'My Medical Records',
      desc: 'Sample records (demo)',
      icon: FolderArchive
    }
  ];

  const navItems = userRole === 'doctor' ? doctorNavItems : patientNavItems;

  return (
    <aside className="app-sidebar-expanded">
      {/* Brand Header */}
      <div className="sidebar-brand" onClick={() => onViewChange('home')}>
        <div className="sidebar-brand-icon">
          <HeartHandshake size={20} />
        </div>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
            AURA TWIN
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--primary-blue)', fontWeight: 600, textTransform: 'uppercase' }}>
            Digital Twin Core
          </div>
        </div>
      </div>

      {/* Quick Search Bar Button */}
      <button
        onClick={onOpenSearch}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          borderRadius: 'var(--radius-md)',
          background: '#f8fafc',
          border: '1px solid var(--border-light)',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          cursor: 'pointer',
          marginBottom: '1rem',
          width: '100%'
        }}
      >
        <Search size={14} />
        <span>Search cohort...</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.68rem', background: '#e2e8f0', padding: '1px 5px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>⌘K</span>
      </button>

      {/* Navigation Menu List with Explicit Names and Purpose */}
      <div className="sidebar-nav-list">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id || (item.id === 'home' && currentView === 'digital-twin');

          return (
            <button
              key={item.id}
              className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <div style={{
                width: 34,
                height: 34,
                borderRadius: 'var(--radius-md)',
                background: isActive ? 'var(--primary-blue)' : '#f1f5f9',
                color: isActive ? '#ffffff' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all var(--transition)'
              }}>
                <Icon size={17} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '0.86rem',
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? 'var(--primary-blue)' : 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: '0.7rem',
                  color: isActive ? 'var(--primary-blue)' : 'var(--text-muted)',
                  opacity: isActive ? 0.9 : 0.75,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginTop: 1
                }}>
                  {item.desc}
                </div>
              </div>

              {item.badge > 0 && (
                <span style={{
                  fontSize: '0.68rem',
                  padding: '2px 7px',
                  borderRadius: 'var(--radius-full)',
                  background: '#ef4444',
                  color: '#ffffff',
                  fontWeight: 700,
                  flexShrink: 0
                }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Profile (Doctor vs Patient) */}
      <div style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
        <div style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-full)',
          background: userRole === 'doctor' ? 'var(--primary-blue)' : '#0f172a',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.8rem'
        }}>
          {userRole === 'doctor' ? 'SC' : 'RS'}
        </div>
        <div>
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {userRole === 'doctor' ? 'Dr. Sarah Chen (Demo)' : 'Rahul Sharma (Demo)'}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {userRole === 'doctor' ? 'Cardiology Lead' : 'Patient ID PT-8092'}
          </div>
        </div>
      </div>
    </aside>
  );
}
