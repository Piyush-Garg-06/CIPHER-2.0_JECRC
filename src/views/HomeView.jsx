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
import Sparkline from '../components/Sparkline';
import { DEMO_SIMULATION_STEPS } from '../services/patientData';
import { calcSliderPosition, formatTimeAgo } from '../utils/formatters';
import { isPatientStale } from '../services/patientService';

export default function HomeView({ 
  patient, 
  patients = [], 
  onSelectPatient,
  onNavigateToMedications,
  onNavigateToPredictions,
  isLive,
  userRole = 'doctor',
  simStatus = null
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
  const twin = activePatient?.twinState || activePatient || {};
  const lastIngestAt = twin.lastIngestAt;
  const streamSource = twin.streamSource;
  const scoreDay = twin.scoreDay ?? activePatient?.scoreDay;
  const hr0 = twin.hr0 ?? activePatient?.hr0;
  const hrv0 = twin.hrv0 ?? activePatient?.hrv0;
  const steps0 = twin.steps0 ?? activePatient?.steps0;
  const recentReadings = twin.recentReadings || [];

  const hrData = recentReadings.map(r => r.restingHR);
  const hrvData = recentReadings.map(r => r.hrv);
  const stepsData = recentReadings.map(r => r.steps);

  const observationWindowDays = twin?.observationWindowDays ?? activePatient?.observationWindowDays ?? null;

  let packetLine = null;
  if (streamSource && streamSource !== 'seed' && lastIngestAt) {
    const timeAgo = formatTimeAgo(lastIngestAt);
    if (timeAgo) {
      const isStreamRunning = Boolean(simStatus && simStatus.running);
      const suffix = isStreamRunning ? '' : ' (stream not running)';
      packetLine = `Last packet: ${timeAgo}${suffix}`;
    }
  }

  const isStale = isPatientStale(activePatient, twin);
  const dataAgeDays = twin?.dataAgeDays ?? activePatient?.dataAgeDays ?? null;
  const lastReadingDay = scoreDay != null ? scoreDay : null;

  let telemetryStatusText = '';
  let telemetryStatusColor = '#047857';

  if (isStale) {
    if (dataAgeDays != null && lastReadingDay != null) {
      telemetryStatusText = `no readings for ${dataAgeDays} days (last reading day ${lastReadingDay})`;
    } else {
      telemetryStatusText = 'no recent readings';
    }
    telemetryStatusColor = '#991b1b';
  } else if (observationWindowDays != null && scoreDay != null && scoreDay >= observationWindowDays) {
    telemetryStatusText = 'stream ended';
    telemetryStatusColor = '#92400e';
  } else {
    telemetryStatusText = 'receiving';
    telemetryStatusColor = '#047857';
  }

  const hrPin = calcSliderPosition('restingHR', vitals.restingHR);
  const hr0Tick = calcSliderPosition('restingHR', hr0);

  const hrvPin = calcSliderPosition('hrv', vitals.hrv);
  const hrv0Tick = calcSliderPosition('hrv', hrv0);

  const bpSys = vitals.bpSys ?? (vitals.bloodPressure ? parseInt(String(vitals.bloodPressure).split('/')[0], 10) : null);
  const bpPin = calcSliderPosition('bpSys', bpSys);

  const stepsPin = calcSliderPosition('steps', vitals.dailySteps);
  const steps0Tick = calcSliderPosition('steps', steps0);

  const isYellowOrRed = (
    activePatient?.riskLevel === 'critical' || 
    activePatient?.riskLevel === 'elevated' || 
    twin?.triageZone === 'red' || 
    twin?.triageZone === 'yellow'
  );

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
            Daily wearable summaries & digital twin overview
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button className="btn-clean btn-clean-secondary" onClick={() => setShowRealTimeModal(true)}>
            <Activity size={14} color="var(--primary-blue)" /> Telemetry Summary
          </button>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <button className="btn-clean btn-clean-primary" onClick={() => setShowCareModal(true)}>
              <ShieldAlert size={14} /> Care Action Loop
            </button>
            {!isSimulated && (
              <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                DEMO DATA
              </span>
            )}
          </div>
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

            {userRole === 'patient' && isYellowOrRed && (
              <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '0.4rem', fontWeight: 500, fontStyle: 'italic' }}>
                This is an automated score from synthetic demo data. It is not a diagnosis.
              </div>
            )}

            {packetLine && (
              <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: '#047857' }}>
                {packetLine}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.6rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span><Clock size={12} style={{ display: 'inline', marginRight: 3 }} /> {scoreDay != null ? `Day ${scoreDay}` : (activePatient?.lastUpdated || 'Latest recorded day')}</span>
              <span>&bull;</span>
              <span><strong style={{ color: telemetryStatusColor }}>Telemetry: {telemetryStatusText}</strong></span>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {hrData.length > 0 && <Sparkline data={hrData} level={activePatient?.riskLevel} width={70} height={20} />}
                  <span className="metric-row-val">
                    {vitals.restingHR != null ? `${vitals.restingHR} BPM` : '-'}
                    {vitals.heartRate != null && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}> (Peak: {vitals.heartRate})</span>}
                  </span>
                </div>
              </div>
              <div className="clean-slider-track">
                {isSimulated && (
                  <div className="clean-slider-colored-zone" style={{ left: '20%', width: '50%', background: '#a7f3d0' }} />
                )}
                {!isSimulated && hr0Tick !== null && (
                  <div
                    className="clean-slider-tick"
                    style={{ position: 'absolute', left: `${hr0Tick}%`, width: '2px', height: '100%', background: '#64748b', zIndex: 2 }}
                    title={`Your baseline: ${Math.round(hr0)} bpm`}
                  />
                )}
                {isSimulated ? (
                  vitals.restingHR != null && (
                    <div className="clean-slider-pin" style={{ left: `${Math.min(Math.max((vitals.restingHR / 140) * 100, 5), 95)}%` }} />
                  )
                ) : (
                  hrPin !== null && (
                    <div className="clean-slider-pin" style={{ left: `${hrPin}%` }} />
                  )
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>40 BPM</span>
                {isSimulated ? (
                  <span>
                    Reference: 60 - 100 BPM
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', marginLeft: '4px' }}>DEMO DATA</span>
                  </span>
                ) : (
                  hr0 != null ? <span>Your baseline: {Math.round(hr0)} bpm</span> : <span />
                )}
                <span>140 BPM</span>
              </div>
            </div>

            {/* rMSSD HRV */}
            <div className="metric-slider-row">
              <div className="metric-row-header">
                <span className="metric-row-title">rMSSD Autonomic HRV</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {hrvData.length > 0 && <Sparkline data={hrvData} level={activePatient?.riskLevel} width={70} height={20} />}
                  <span className="metric-row-val" style={{ color: (vitals.hrvChange7d != null && vitals.hrvChange7d < 0) ? '#b45309' : 'var(--text-main)' }}>
                    {vitals.hrv != null ? `${vitals.hrv} ms` : '-'}
                    {vitals.hrvChange7d != null && ` (${vitals.hrvChange7d}%)`}
                  </span>
                </div>
              </div>
              <div className="clean-slider-track">
                {isSimulated && (
                  <div className="clean-slider-colored-zone" style={{ left: '40%', width: '50%', background: '#a7f3d0' }} />
                )}
                {!isSimulated && hrv0Tick !== null && (
                  <div
                    className="clean-slider-tick"
                    style={{ position: 'absolute', left: `${hrv0Tick}%`, width: '2px', height: '100%', background: '#64748b', zIndex: 2 }}
                    title={`Your baseline: ${Math.round(hrv0)} ms`}
                  />
                )}
                {isSimulated ? (
                  vitals.hrv != null && (
                    <div className="clean-slider-pin" style={{ left: `${Math.min(Math.max((vitals.hrv / 100) * 100, 5), 95)}%` }} />
                  )
                ) : (
                  hrvPin !== null && (
                    <div className="clean-slider-pin" style={{ left: `${hrvPin}%` }} />
                  )
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>10 ms</span>
                {isSimulated ? (
                  <span>
                    Reference: &gt; 55 ms
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', marginLeft: '4px' }}>DEMO DATA</span>
                  </span>
                ) : (
                  hrv0 != null ? <span>Your baseline: {Math.round(hrv0)} ms</span> : <span />
                )}
                <span>100 ms</span>
              </div>
            </div>

            {/* Blood Pressure */}
            <div className="metric-slider-row">
              <div className="metric-row-header">
                <span className="metric-row-title">Blood Pressure</span>
                <span className="metric-row-val">
                  {(vitals.bloodPressure ?? (vitals.bpSys != null && vitals.bpDia != null ? `${vitals.bpSys}/${vitals.bpDia}` : null)) != null
                    ? `${vitals.bloodPressure ?? `${vitals.bpSys}/${vitals.bpDia}`} mmHg`
                    : '-'}
                </span>
              </div>
              <div className="clean-slider-track">
                {isSimulated && (
                  <div className="clean-slider-colored-zone" style={{ left: '15%', width: '45%', background: '#a7f3d0' }} />
                )}
                {isSimulated ? (
                  <div className="clean-slider-pin" style={{ left: '68%' }} />
                ) : (
                  bpPin !== null && (
                    <div className="clean-slider-pin" style={{ left: `${bpPin}%` }} />
                  )
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>90 systolic</span>
                {isSimulated ? (
                  <span>
                    Reference: &lt; 120/80
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', marginLeft: '4px' }}>DEMO DATA</span>
                  </span>
                ) : <span />}
                <span>180 systolic</span>
              </div>
            </div>

            {/* Daily Steps */}
            <div className="metric-slider-row">
              <div className="metric-row-header">
                <span className="metric-row-title">Daily Steps</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  {stepsData.length > 0 && <Sparkline data={stepsData} level={activePatient?.riskLevel} width={70} height={20} />}
                  <span className="metric-row-val">
                    {vitals.dailySteps != null ? `${vitals.dailySteps.toLocaleString()} steps` : '-'}
                  </span>
                </div>
              </div>
              <div className="clean-slider-track">
                {isSimulated && (
                  <div className="clean-slider-colored-zone" style={{ left: '50%', width: '45%', background: '#a7f3d0' }} />
                )}
                {!isSimulated && steps0Tick !== null && (
                  <div
                    className="clean-slider-tick"
                    style={{ position: 'absolute', left: `${steps0Tick}%`, width: '2px', height: '100%', background: '#64748b', zIndex: 2 }}
                    title={`Your baseline: ${Math.round(steps0).toLocaleString()} steps`}
                  />
                )}
                {isSimulated ? (
                  vitals.dailySteps != null && (
                    <div className="clean-slider-pin" style={{ left: `${Math.min(Math.max((vitals.dailySteps / 12000) * 100, 5), 95)}%` }} />
                  )
                ) : (
                  stepsPin !== null && (
                    <div className="clean-slider-pin" style={{ left: `${stepsPin}%` }} />
                  )
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                <span>0</span>
                {isSimulated ? (
                  <span>
                    Reference: &gt; 5,000
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a', marginLeft: '4px' }}>DEMO DATA</span>
                  </span>
                ) : (
                  steps0 != null ? <span>Your baseline: {Math.round(steps0).toLocaleString()} steps</span> : <span />
                )}
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

            {/* 3D Anatomical Digital Twin Canvas with Continuous Laser Telemetry Scan */}
            <div className="twin-light-canvas" style={{
              background: 'linear-gradient(180deg, #090d16 0%, #0f172a 100%)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              overflow: 'hidden',
              position: 'relative',
              borderRadius: 'var(--radius-lg)',
              minHeight: '440px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 30px rgba(2, 132, 199, 0.15)'
            }}>
              {/* Background Cyber Tech Grid */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(56, 189, 248, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.05) 1px, transparent 1px)',
                backgroundSize: '24px 24px',
                pointerEvents: 'none'
              }} />

              {/* Continuous Top-to-Bottom Laser Scanner Line */}
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '3px',
                background: 'linear-gradient(90deg, transparent 0%, #38bdf8 30%, #0284c7 50%, #38bdf8 70%, transparent 100%)',
                boxShadow: '0 0 18px 4px rgba(56, 189, 248, 0.8), 0 0 35px 8px rgba(2, 132, 199, 0.4)',
                animation: 'twin-laser-sweep 3.2s ease-in-out infinite alternate',
                zIndex: 15,
                pointerEvents: 'none'
              }} />

              {/* Laser Light Flare */}
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                height: '40px',
                background: 'linear-gradient(180deg, rgba(56, 189, 248, 0.15) 0%, transparent 100%)',
                animation: 'twin-laser-sweep 3.2s ease-in-out infinite alternate',
                zIndex: 14,
                pointerEvents: 'none'
              }} />

              {/* Heartbeat Pulsating Glow Beacon */}
              <div style={{
                position: 'absolute',
                top: '28%',
                left: '52%',
                transform: 'translate(-50%, -50%)',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(239, 68, 68, 0.6) 0%, rgba(245, 158, 11, 0.2) 45%, transparent 70%)',
                filter: 'blur(8px)',
                pointerEvents: 'none',
                zIndex: 10,
                animation: 'heart-pulse 0.8s ease-in-out infinite'
              }} />

              {/* 3D Anatomical Human Model */}
              <img
                src="/assets/digital-twin-anatomy.png"
                alt="3D Anatomical Digital Twin"
                className="twin-light-img"
                style={{
                  maxHeight: '400px',
                  zIndex: 8,
                  filter: 'drop-shadow(0 0 25px rgba(14, 165, 233, 0.35))'
                }}
              />

              {/* Telemetry Status Tag */}
              <div style={{
                position: 'absolute',
                bottom: '12px',
                left: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.68rem',
                color: '#38bdf8',
                fontWeight: 600,
                zIndex: 20
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
                <span>3D LASER TELEMETRY ACTIVE</span>
              </div>

              {hotspots.map((hotspot) => {
                const Icon = hotspot.icon;
                const isActive = activeOrgan === hotspot.id;

                return (
                  <div
                    key={hotspot.id}
                    className={`body-hotspot-light ${isActive ? 'active' : ''}`}
                    style={{ top: hotspot.top, left: hotspot.left, zIndex: 25 }}
                    onClick={() => {
                      setActiveOrgan(hotspot.id);
                      if (hotspot.id === 'heart' && isSimulated) setShowCardioModal(true);
                    }}
                    title={hotspot.label}
                  >
                    <div className="hotspot-beacon-light" style={{
                      background: 'rgba(15, 23, 42, 0.9)',
                      borderColor: hotspot.id === 'heart' ? '#ef4444' : '#38bdf8',
                      color: hotspot.id === 'heart' ? '#ef4444' : '#38bdf8'
                    }}>
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

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.65rem', marginTop: '1rem' }}>
              {!isSimulated && (
                <span style={{ fontSize: '0.68rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 3, fontWeight: 700 }}>
                  DEMO DATA
                </span>
              )}
              <button className="btn-clean btn-clean-secondary" onClick={() => setShowCardioModal(true)}>
                Cardiovascular Report
              </button>
              <button className="btn-clean btn-clean-primary" onClick={() => setShowCareModal(true)}>
                Care Action
              </button>
            </div>
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
