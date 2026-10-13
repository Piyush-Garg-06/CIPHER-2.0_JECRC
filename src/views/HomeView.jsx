import React, { useState } from 'react';
import { 
  Activity, 
  Heart, 
  Brain, 
  Wind, 
  Droplet, 
  Zap, 
  Pill, 
  CheckCircle2, 
  Clock, 
  ShieldAlert
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import CardiovascularReportModal from '../components/CardiovascularReportModal';
import RealTimeDataMonitoringModal from '../components/RealTimeDataMonitoringModal';
import CareActionModal from '../components/CareActionModal';
import DemoModeController from '../components/DemoModeController';
import { DEMO_SIMULATION_STEPS } from '../services/patientData';

export default function HomeView({ 
  patient, 
  patients = [], 
  onSelectPatient,
  onNavigateToMedications,
  onNavigateToPredictions,
  isLive
}) {
  const [activeOrgan, setActiveOrgan] = useState('heart');
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [showRealTimeModal, setShowRealTimeModal] = useState(false);
  const [showCareModal, setShowCareModal] = useState(false);

  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);

  const isSimulated = patient?.isSimulated !== false && !isLive;

  const simulationSteps = DEMO_SIMULATION_STEPS;
  const currentDemoStep = simulationSteps[demoStepIndex];

  const activePatient = (isSimulated && isDemoActive) ? {
    ...patient,
    riskLevel: currentDemoStep.riskLevel,
    riskScore: currentDemoStep.riskScore,
    riskPercentage: currentDemoStep.riskPercentage,
    vitals: {
      ...patient.vitals,
      heartRate: currentDemoStep.heartRate,
      hrv: currentDemoStep.hrv,
      dailySteps: currentDemoStep.dailySteps
    },
    summaryText: currentDemoStep.headline,
    clinicalHeadline: currentDemoStep.actionPrompt
  } : patient;

  const vitals = activePatient?.vitals || {};

  const hotspots = [
    { id: 'brain', label: 'Autonomic System', icon: Brain, top: '8%', left: '50%', status: activePatient?.hotspots?.brain?.status || 'stable' },
    { id: 'lungs', label: 'Pulmonary / SpO2', icon: Wind, top: '24%', left: '39%', status: activePatient?.hotspots?.lungs?.status || 'stable' },
    { id: 'heart', label: 'Cardiovascular Core', icon: Heart, top: '28%', left: '54%', status: activePatient?.hotspots?.heart?.status || 'elevated', isHeart: true },
    { id: 'medication', label: 'Metabolic & Rx', icon: Pill, top: '39%', left: '38%', status: activePatient?.hotspots?.medication?.status || 'stable' },
    { id: 'vascular', label: 'Vascular System', icon: Activity, top: '48%', left: '51%', status: activePatient?.hotspots?.vascular?.status || 'elevated' },
    { id: 'activity', label: 'Mobility & Exertion', icon: Zap, top: '75%', left: '42%', status: activePatient?.hotspots?.activity?.status || 'elevated' }
  ];

  const handleStepChange = (newIndex) => {
    setIsDemoActive(true);
    setDemoStepIndex(newIndex);
  };

  const handleTogglePlay = (playing) => {
    setIsDemoActive(true);
    setIsDemoPlaying(playing);
  };

  const handleResetDemo = () => {
    setIsDemoActive(false);
    setIsDemoPlaying(false);
    setDemoStepIndex(0);
  };

  return (
    <div className="page-container">
      {/* Top Banner Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Patient Status & Remote Monitoring
            </h1>
            {isSimulated && (
              <span style={{ fontSize: '0.7rem', background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                DEMO DATA
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            Continuous physiological telemetry & digital twin overview
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button className="btn-clean btn-clean-secondary" onClick={() => setShowRealTimeModal(true)}>
            <Activity size={14} color="var(--primary-blue)" /> Telemetry Summary
          </button>
          {isSimulated && (
            <button className="btn-clean btn-clean-primary" onClick={() => setShowCareModal(true)}>
              <ShieldAlert size={14} /> Care Action Loop
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Panel Layout: Center Live Status + Right Digital Twin */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr',
        gap: '1.5rem',
        alignItems: 'start'
      }}>
        {/* CENTER PANEL: Live Status & Continuous Tracking */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Current Patient Updated Status */}
          <div className="clean-card" style={{ borderLeft: `4px solid ${activePatient?.riskLevel === 'critical' ? '#ef4444' : activePatient?.riskLevel === 'elevated' ? '#f59e0b' : '#10b981'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Current Patient Status
              </span>
              <RiskBadge level={activePatient?.riskLevel} score={activePatient?.riskScore} />
            </div>

            <div style={{ fontSize: '0.92rem', color: 'var(--text-main)', fontWeight: 600 }}>
              {activePatient?.summaryText || (activePatient?.twinState ? `Triage Zone: ${(activePatient.twinState.triageZone || 'Stable').toUpperCase()}` : 'Monitoring active')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span><Clock size={12} style={{ display: 'inline', marginRight: 3 }} /> {activePatient?.lastUpdated || 'Latest recorded day'}</span>
              <span>&bull;</span>
              <span>Telemetry: <strong style={{ color: '#047857' }}>Active</strong></span>
            </div>
          </div>

          {/* Biometrics */}
          <div className="clean-card">
            <div className="clean-card-header">
              <div className="clean-card-title">
                Recorded Telemetry & Biometrics
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {isSimulated ? 'Apple Watch & Holter' : 'Daily Wearable Stream'}
              </span>
            </div>

            {/* Resting Heart Rate */}
            <div className="metric-slider-row">
              <div className="metric-row-header">
                <span className="metric-row-title">Resting Heart Rate</span>
                <span className="metric-row-val">
                  {vitals.restingHR != null ? `${vitals.restingHR} BPM` : '-'}
                  {vitals.heartRate != null && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}> (Peak: {vitals.heartRate})</span>}
                </span>
              </div>
              <div className="clean-slider-track">
                <div className="clean-slider-colored-zone" style={{ left: '20%', width: '50%', background: '#a7f3d0' }} />
                {vitals.restingHR != null && (
                  <div className="clean-slider-pin" style={{ left: `${Math.min(Math.max((vitals.restingHR / 140) * 100, 5), 95)}%` }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>40 BPM</span>
                <span>Reference: 60 - 100 BPM</span>
                <span>140 BPM</span>
              </div>
            </div>

            {/* rMSSD HRV */}
            <div className="metric-slider-row">
              <div className="metric-row-header">
                <span className="metric-row-title">rMSSD Autonomic HRV</span>
                <span className="metric-row-val" style={{ color: (vitals.hrvChange7d != null && vitals.hrvChange7d < 0) ? '#b45309' : 'var(--text-main)' }}>
                  {vitals.hrv != null ? `${vitals.hrv} ms` : '-'}
                  {vitals.hrvChange7d != null && ` (${vitals.hrvChange7d}%)`}
                </span>
              </div>
              <div className="clean-slider-track">
                <div className="clean-slider-colored-zone" style={{ left: '40%', width: '50%', background: '#a7f3d0' }} />
                {vitals.hrv != null && (
                  <div className="clean-slider-pin" style={{ left: `${Math.min(Math.max((vitals.hrv / 100) * 100, 5), 95)}%` }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>10 ms</span>
                <span>Reference: &gt; 55 ms</span>
                <span>100 ms</span>
              </div>
            </div>

            {/* Blood Pressure */}
            <div className="metric-slider-row">
              <div className="metric-row-header">
                <span className="metric-row-title">Blood Pressure</span>
                <span className="metric-row-val">{vitals.bloodPressure != null ? `${vitals.bloodPressure} mmHg` : '-'}</span>
              </div>
              <div className="clean-slider-track">
                <div className="clean-slider-colored-zone" style={{ left: '15%', width: '45%', background: '#a7f3d0' }} />
                <div className="clean-slider-pin" style={{ left: '68%' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>90/60</span>
                <span>Reference: &lt; 120/80</span>
                <span>180/110</span>
              </div>
            </div>

            {/* Daily Steps */}
            <div className="metric-slider-row">
              <div className="metric-row-header">
                <span className="metric-row-title">Daily Steps</span>
                <span className="metric-row-val">
                  {vitals.dailySteps != null ? `${vitals.dailySteps.toLocaleString()} steps` : '-'}
                </span>
              </div>
              <div className="clean-slider-track">
                <div className="clean-slider-colored-zone" style={{ left: '50%', width: '45%', background: '#a7f3d0' }} />
                {vitals.dailySteps != null && (
                  <div className="clean-slider-pin" style={{ left: `${Math.min(Math.max((vitals.dailySteps / 12000) * 100, 5), 95)}%` }} />
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>0</span>
                <span>Reference: &gt; 5,000</span>
                <span>12,000</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: 2D Anatomical Digital Twin */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="clean-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
              <div className="clean-card-title">
                Interactive Digital Twin
              </div>
              {isSimulated && (
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: activePatient?.riskLevel === 'critical' ? '#ef4444' : '#f59e0b' }}>
                  {activePatient?.riskPercentage} <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ 100 Impact</span>
                </div>
              )}
            </div>

            {/* 2D Anatomy Canvas */}
            <div className="twin-light-canvas">
              <img
                src="/assets/human-anatomy.png"
                alt="2D Anatomical Human Digital Twin"
                className="twin-light-img"
              />

              {hotspots.map((hotspot) => {
                const Icon = hotspot.icon;
                const isActive = activeOrgan === hotspot.id;

                return (
                  <div
                    key={hotspot.id}
                    className={`body-hotspot-light ${isActive ? 'active' : ''}`}
                    style={{ top: hotspot.top, left: hotspot.left }}
                    onClick={() => {
                      setActiveOrgan(hotspot.id);
                      if (hotspot.id === 'heart' && isSimulated) setShowCardioModal(true);
                    }}
                    title={hotspot.label}
                  >
                    <div className="hotspot-beacon-light">
                      <Icon size={15} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Checklist */}
            {isSimulated && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.4rem',
                fontSize: '0.75rem',
                color: 'var(--text-main)',
                background: '#f8fafc',
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                marginTop: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={13} color="var(--primary-blue)" /> HRV Tone Deficit
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={13} color="var(--primary-blue)" /> Stage 1 SBP Load
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={13} color="var(--primary-blue)" /> Reduced Exertion
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={13} color="var(--primary-blue)" /> Non-Dipping Pulse
                </div>
              </div>
            )}

            {isSimulated && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1rem' }}>
                <button className="btn-clean btn-clean-secondary" onClick={() => setShowCardioModal(true)}>
                  Cardiovascular Report
                </button>
                <button className="btn-clean btn-clean-primary" onClick={() => setShowCareModal(true)}>
                  Care Action
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCardioModal && (
        <CardiovascularReportModal
          patient={activePatient}
          onClose={() => setShowCardioModal(false)}
          onOpenCareAction={() => setShowCareModal(true)}
        />
      )}

      {showRealTimeModal && (
        <RealTimeDataMonitoringModal
          patient={activePatient}
          onClose={() => setShowRealTimeModal(false)}
        />
      )}

      {showCareModal && (
        <CareActionModal
          patient={activePatient}
          onClose={() => setShowCareModal(false)}
          onActionTriggered={() => setShowCareModal(false)}
        />
      )}

      {/* Bottom Floating Timeline Scrubber Player - only for offline simulated demo */}
      {isSimulated && (
        <DemoModeController
          currentStepIndex={demoStepIndex}
          onStepChange={handleStepChange}
          isPlaying={isDemoPlaying}
          onTogglePlay={handleTogglePlay}
          onReset={handleResetDemo}
        />
      )}
    </div>
  );
}
