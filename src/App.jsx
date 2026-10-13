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
        if (loadedPatients && loadedPatients.length > 0) {
          setSelectedPatient(prev => {
            if (!prev) return loadedPatients[0];
            const found = loadedPatients.find(p => p.id === prev.id);
            return found || loadedPatients[0];
          });
        }
      } catch (err) {
        setCohortState(patientService.getState());
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

  const patients = cohortState.patients;
  const isLive = cohortState.source === 'live';
  const liveAlertCount = isLive ? patientService.getAlerts().length : 0;

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
      {/* Persistent Banner: Live vs Offline vs Loading */}
      <div
        className="persistent-status-banner"
        style={{
          width: '100%',
          padding: '0.45rem 1.25rem',
          fontSize: '0.78rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: cohortState.source === 'live' ? '#ecfdf5' : cohortState.source === 'offline-demo' ? '#fef3c7' : '#f1f5f9',
          color: cohortState.source === 'live' ? '#047857' : cohortState.source === 'offline-demo' ? '#92400e' : '#475569',
          borderBottom: `1px solid ${cohortState.source === 'live' ? '#a7f3d0' : cohortState.source === 'offline-demo' ? '#fde68a' : '#e2e8f0'}`,
          zIndex: 100
        }}
      >
        <span>
          {cohortState.source === 'live' && "LIVE API - synthetic cohort (demonstration data, not real patients)"}
          {cohortState.source === 'offline-demo' && "OFFLINE - showing built-in demo data"}
          {cohortState.source === 'loading' && "Loading patient cohort..."}
        </span>
        {cohortState.lastFetched && (
          <span style={{ fontSize: '0.7rem', fontWeight: 500, opacity: 0.85 }}>
            Last fetched: {cohortState.lastFetched.toLocaleTimeString()}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', width: '100%', flex: 1, minHeight: 0 }}>
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          unreadAlertCount={liveAlertCount}
          isLive={isLive}
          onOpenSearch={() => setIsSearchOpen(true)}
          userRole={userRole}
        />

        {/* Main Content Area */}
        <div className="main-wrapper">
          {/* Top Header Ribbon */}
          {selectedPatient && (
            <Header
              activePatient={selectedPatient}
              userRole={userRole}
              onOpenGateway={() => setShowGatewayModal(true)}
              currentView={currentView}
              onNavigateToWard={() => setCurrentView('ward')}
              onDownloadReport={() => {}}
              onOpenHistory={() => setCurrentView('records')}
              onStartScanning={() => {}}
              onOpenCareAction={() => setShowGlobalCareModal(true)}
            />
          )}

          {/* Dynamic View Component */}
          <main>
            {cohortState.source === 'loading' && patients.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading patient data...
              </div>
            ) : (
              <>
                {/* Doctor Only: Hospital Ward Overview */}
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

                {/* 1. Home: Live Status & Tracking + Digital Twin */}
                {(currentView === 'home' || currentView === 'digital-twin') && selectedPatient && (
                  <HomeView
                    patient={selectedPatient}
                    patients={userRole === 'doctor' ? patients : [selectedPatient]}
                    isLive={isLive}
                    onSelectPatient={userRole === 'doctor' ? setSelectedPatient : undefined}
                    onNavigateToMedications={() => setCurrentView('medications')}
                    onNavigateToPredictions={() => setCurrentView('predictions')}
                  />
                )}

                {/* 2. Medication Schedule */}
                {currentView === 'medications' && selectedPatient && (
                  <MedicationReportsView
                    patient={selectedPatient}
                    isLive={isLive}
                  />
                )}

                {/* 3. Prediction & Trajectory Forecast */}
                {currentView === 'predictions' && selectedPatient && (
                  <PredictionsView
                    patient={selectedPatient}
                    patients={userRole === 'doctor' ? patients : [selectedPatient]}
                    isLive={isLive}
                    onSelectPatient={userRole === 'doctor' ? setSelectedPatient : undefined}
                  />
                )}

                {/* 4. Scripted Assistant Chatbot */}
                {currentView === 'chatbot' && selectedPatient && (
                  <AIChatbotView
                    patient={selectedPatient}
                    isLive={isLive}
                    onNavigateToPredictions={() => setCurrentView('predictions')}
                  />
                )}

                {/* 5. Online Health Magazine */}
                {currentView === 'magazine' && selectedPatient && (
                  <HealthMagazineView
                    patient={selectedPatient}
                  />
                )}

                {/* Medical Records Archive */}
                {currentView === 'records' && selectedPatient && (
                  <RecordsView
                    patient={selectedPatient}
                    patients={userRole === 'doctor' ? patients : [selectedPatient]}
                    onSelectPatient={userRole === 'doctor' ? setSelectedPatient : undefined}
                  />
                )}

                {/* Clinical Alerts Triage (Doctor Only) */}
                {userRole === 'doctor' && currentView === 'alerts' && (
                  <AlertsView
                    alerts={alerts}
                    patients={patients}
                    onMarkRead={handleMarkAlertRead}
                    onSelectPatient={setSelectedPatient}
                    onNavigateToTwin={() => setCurrentView('home')}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Global Quick Search Modal */}
      {selectedPatient && (
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          patients={userRole === 'doctor' ? patients : [selectedPatient]}
          onSelectPatient={setSelectedPatient}
          onSelectView={setCurrentView}
        />
      )}

      {/* Global Care Action Protocol Modal (offline-demo only) */}
      {showGlobalCareModal && selectedPatient && (
        <CareActionModal
          patient={selectedPatient}
          onClose={() => setShowGlobalCareModal(false)}
          onActionTriggered={() => setShowGlobalCareModal(false)}
        />
      )}

      {/* Portal Selection Gateway Modal for Role Switching */}
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
