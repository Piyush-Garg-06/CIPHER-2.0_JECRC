import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import HomeView from './views/HomeView';
import WardBedView from './views/WardBedView';
import MedicationReportsView from './views/MedicationReportsView';
import PredictionsView from './views/PredictionsView';
import AIChatbotView from './views/AIChatbotView';
import HealthMagazineView from './views/HealthMagazineView';
import RecordsView from './views/RecordsView';
import AlertsView from './views/AlertsView';
import GlobalSearchModal from './components/GlobalSearchModal';
import CareActionModal from './components/CareActionModal';
import PortalGatewayModal from './components/PortalGatewayModal';
import { patientService } from './services/patientService';

export default function App() {
  const [userRole, setUserRole] = useState('doctor'); // 'doctor' | 'patient'
  const [currentView, setCurrentView] = useState('ward'); // 'ward' default for doctor
  const [cohortState, setCohortState] = useState(() => patientService.getState());
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [alerts, setAlerts] = useState(() => patientService.getAlerts());
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [showGlobalCareModal, setShowGlobalCareModal] = useState(false);
  const [showGatewayModal, setShowGatewayModal] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('aura_theme') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    try {
      localStorage.setItem('aura_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const pollIntervalMs = parseInt(import.meta.env.VITE_POLL_MS || '30000', 10);

  // Poll /patients every 30 s (paused while tab is hidden)
  useEffect(() => {
    let timer = null;

    const loadData = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        const loadedPatients = await patientService.fetchPatients();
        const updatedState = patientService.getState();
        setCohortState(updatedState);
        setAlerts(patientService.getAlerts());
        if (loadedPatients && loadedPatients.length > 0) {
          setSelectedPatient(prev => {
            if (!prev) return loadedPatients[0];
            const found = loadedPatients.find(p => p.id === prev.id);
            return found || loadedPatients[0];
          });
        }
      } catch (err) {
        setCohortState(patientService.getState());
        setAlerts(patientService.getAlerts());
      }
    };

    // Initial load
    loadData();

    // Set polling interval
    timer = setInterval(loadData, pollIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pollIntervalMs]);

  const patients = cohortState.patients.length > 0 ? cohortState.patients : patientService.getPatients();
  const isLive = cohortState.source === 'live';
  // Active patient fallback
  const activePatient = selectedPatient || patients[0];

  const unreadAlertCount = userRole === 'doctor'
    ? alerts.filter(a => !a.isRead).length
    : alerts.filter(a => !a.isRead && (a.patientId === activePatient?.id || a.patientId === 'PT-8092')).length;

  const alertBadgeCount = unreadAlertCount;

  const handleMarkAlertRead = (alertId) => {
    const updated = patientService.markAlertAsRead(alertId);
    setAlerts(updated);
  };

  const handleSelectRole = (newRole) => {
    setUserRole(newRole);
    if (newRole === 'doctor') {
      setCurrentView('ward');
    } else {
      // In patient mode, lock strictly to Rahul Sharma
      const rahul = patients.find(p => p.id === 'PT-8092') || patients[0];
      setSelectedPatient(rahul);
      setCurrentView('home');
    }
  };

  return (
    <div className="app-layout">
      {/* Left Navigation Sidebar */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        unreadAlertCount={alertBadgeCount}
        onOpenSearch={() => setIsSearchOpen(true)}
        userRole={userRole}
        activePatient={activePatient}
      />

      {/* Main Content Area */}
      <div className="main-wrapper">
        {/* Top Header Ribbon with Dedicated Doctor / Patient UI & Portal Switcher */}
        {activePatient && (
          <Header
            activePatient={activePatient}
            userRole={userRole}
            onOpenGateway={() => setShowGatewayModal(true)}
            currentView={currentView}
            onNavigateToWard={() => setCurrentView('ward')}
            onDownloadReport={() => alert(`Exporting Clinical Report for ${activePatient.name}`)}
            onOpenHistory={() => setCurrentView('records')}
            onStartScanning={() => alert('Starting Telemetry Stream...')}
            onOpenCareAction={() => setShowGlobalCareModal(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        {/* Dynamic View Component */}
        <main>
          {cohortState.source === 'loading' && patients.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading patient digital twin data...
            </div>
          ) : (
            <>
              {/* Doctor Only: 8-Bed Hospital Ward Grid with Live Filters & Search */}
              {userRole === 'doctor' && currentView === 'ward' && (
                <WardBedView
                  patients={patients}
                  isLive={isLive}
                  onSelectPatient={(p) => {
                    setSelectedPatient(p);
                    setCurrentView('home');
                  }}
                />
              )}

              {/* 1. Home: Live Status & Tracking + 2D/3D Digital Twin */}
              {(currentView === 'home' || currentView === 'digital-twin') && (
                <HomeView
                  patient={activePatient}
                  patients={userRole === 'doctor' ? patients : [activePatient]}
                  isLive={isLive}
                  onSelectPatient={userRole === 'doctor' ? setSelectedPatient : undefined}
                  onNavigateToMedications={() => setCurrentView('medications')}
                  onNavigateToPredictions={() => setCurrentView('predictions')}
                  onNavigateToRecords={() => setCurrentView('records')}
                  onNavigateToAlerts={() => setCurrentView('alerts')}
                  userRole={userRole}
                />
              )}

              {/* 2. Medication Schedule, Side Effects, Cautions & Doctor Remarks */}
              {currentView === 'medications' && (
                <MedicationReportsView
                  patient={activePatient}
                  isLive={isLive}
                />
              )}

              {/* 3. Prediction & Trajectory Forecast */}
              {currentView === 'predictions' && (
                <PredictionsView
                  patient={activePatient}
                  patients={userRole === 'doctor' ? patients : [activePatient]}
                  isLive={isLive}
                  onSelectPatient={userRole === 'doctor' ? setSelectedPatient : undefined}
                />
              )}

              {/* 4. Clinical / Data & Scenario Assistant */}
              {currentView === 'chatbot' && (
                <AIChatbotView
                  patient={activePatient}
                  isLive={isLive}
                  onOpenCareAction={() => setShowGlobalCareModal(true)}
                  onNavigateToPredictions={() => setCurrentView('predictions')}
                  onNavigateToMedications={() => setCurrentView('medications')}
                />
              )}

              {/* 5. Online Health Magazine & Video Tutorials */}
              {currentView === 'magazine' && (
                <HealthMagazineView
                  patient={activePatient}
                />
              )}

              {/* Medical Records Archive */}
              {currentView === 'records' && (
                <RecordsView
                  patient={activePatient}
                  patients={userRole === 'doctor' ? patients : [activePatient]}
                  onSelectPatient={userRole === 'doctor' ? setSelectedPatient : undefined}
                />
              )}

              {/* Health Alerts Triage & Warning Center (Accessible for both Doctor & Patient) */}
              {currentView === 'alerts' && (
                <AlertsView
                  alerts={userRole === 'doctor' ? alerts : alerts.filter(a => a.patientId === activePatient.id || a.patientId === 'PT-8092')}
                  patients={userRole === 'doctor' ? patients : [activePatient]}
                  onMarkRead={handleMarkAlertRead}
                  onSelectPatient={userRole === 'doctor' ? setSelectedPatient : undefined}
                  onNavigateToTwin={() => setCurrentView('home')}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Global Quick Search Modal (Scoped: Doctor can search all ward, Patient only sees self) */}
      {activePatient && (
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          patients={userRole === 'doctor' ? patients : [activePatient]}
          onSelectPatient={setSelectedPatient}
          onSelectView={setCurrentView}
        />
      )}

      {/* Global Care Action Protocol Modal */}
      {showGlobalCareModal && activePatient && (
        <CareActionModal
          patient={activePatient}
          onClose={() => setShowGlobalCareModal(false)}
          onActionTriggered={() => setShowGlobalCareModal(false)}
        />
      )}

      {/* Portal Selection Gateway Modal for Clean Role Switching */}
      <PortalGatewayModal
        isOpen={showGatewayModal}
        onClose={() => setShowGatewayModal(false)}
        currentRole={userRole}
        onSelectRole={(role) => {
          handleSelectRole(role);
          setShowGatewayModal(false);
        }}
      />
    </div>
  );
}
