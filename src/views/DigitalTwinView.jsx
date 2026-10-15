import React, { useState } from 'react';
import { 
  Heart, 
  Activity, 
  TrendingUp, 
  Clock, 
  Calendar, 
  FileText, 
  Download, 
  ShieldAlert, 
  User, 
  Sparkles,
  Watch,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Brain,
  Wind,
  Droplet,
  Zap,
  Pill,
  Info
} from 'lucide-react';
import RiskBadge from '../components/RiskBadge';
import RiskForecastChart from '../components/RiskForecastChart';
import ExplainabilityPanel from '../components/ExplainabilityPanel';
import ExpectedVsActual from '../components/ExpectedVsActual';
import PatientTimeline from '../components/PatientTimeline';
import DemoModeController from '../components/DemoModeController';
import CareActionModal from '../components/CareActionModal';
import CardiovascularReportModal from '../components/CardiovascularReportModal';
import RealTimeDataMonitoringModal from '../components/RealTimeDataMonitoringModal';
import { DEMO_SIMULATION_STEPS } from '../services/patientData';

export default function DigitalTwinView({ 
  patient, 
  patients = [], 
  onSelectPatient, 
  onNavigateToRecords,
  onNavigateToAlerts 
}) {
  const [activeTab, setActiveTab] = useState('results'); // 'results' | 'forecast' | 'xai' | 'timeline'
  const [activeOrgan, setActiveOrgan] = useState('heart');
  const [showCareActionModal, setShowCareActionModal] = useState(false);
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [showRealTimeModal, setShowRealTimeModal] = useState(false);

  const [demoStepIndex, setDemoStepIndex] = useState(0);
  const [isDemoPlaying, setIsDemoPlaying] = useState(false);
  const [isDemoActive, setIsDemoActive] = useState(false);

  const simulationSteps = DEMO_SIMULATION_STEPS;
  const currentDemoStep = simulationSteps[demoStepIndex];

  const activePatient = isDemoActive ? {
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

  const hotspots = [
    { id: 'brain', label: 'Autonomic Tone', icon: Brain, top: '8%', left: '50%', status: activePatient.hotspots.brain?.status || 'stable' },
    { id: 'lungs', label: 'Pulmonary / SpO2', icon: Wind, top: '24%', left: '39%', status: activePatient.hotspots.lungs?.status || 'stable' },
    { id: 'heart', label: 'Cardiovascular Core', icon: Heart, top: '28%', left: '54%', status: activePatient.hotspots.heart?.status || 'elevated', isHeart: true },
    { id: 'medication', label: 'Metabolic & Rx', icon: Pill, top: '39%', left: '38%', status: activePatient.hotspots.medication?.status || 'stable' },
    { id: 'vascular', label: 'Vascular System', icon: Activity, top: '48%', left: '51%', status: activePatient.hotspots.vascular?.status || 'elevated' },
    { id: 'activity', label: 'Mobility & Exertion', icon: Zap, top: '75%', left: '42%', status: activePatient.hotspots.activity?.status || 'elevated' }
  ];

  return (
    <div className="page-container">
      {/* Report Header & Quick Status Pills matching Screenshot 1 */}
      <div className="report-action-bar">
        <div className="report-title-group">
          <h1>Cardiovascular & Autonomic Analysis Report</h1>
          <p>
            Daily wearable sensor metrics and autonomic variability provide indication of cardiovascular stability and sub-clinical risk deviation (demonstration view).
          </p>

          <div className="quick-status-pills">
            <div className="status-indicator-pill">
              <span>Risk Factor:</span>
              <strong style={{ color: activePatient.riskLevel === 'critical' ? '#ef4444' : activePatient.riskLevel === 'elevated' ? '#f59e0b' : '#10b981' }}>
                {activePatient.riskLevel.toUpperCase()}
              </strong>
            </div>

            <div className="status-indicator-pill">
              <span>Abnormalities:</span>
              <strong>{activePatient.riskLevel === 'stable' ? 'None Detected' : 'HRV Decline & Non-Dipping Pulse'}</strong>
            </div>

            <div className="status-indicator-pill">
              <span>General Wellness:</span>
              <strong style={{ color: 'var(--primary-blue)' }}>
                {activePatient.riskLevel === 'stable' ? 'Optimal' : 'Clinical Attention Required'}
              </strong>
            </div>
          </div>
        </div>

        {/* Cohort Select */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Focus Patient:</span>
          <select
            value={patient.id}
            onChange={(e) => {
              const found = patients.find(p => p.id === e.target.value);
              if (found) onSelectPatient(found);
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
                {p.name} ({p.riskLevel.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-Navigation Tabs matching Screenshot 1 */}
      <div className="page-tabs-nav">
        <button
          className={`page-tab-btn ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          Results & Digital Twin
        </button>
        <button
          className={`page-tab-btn ${activeTab === 'forecast' ? 'active' : ''}`}
          onClick={() => setActiveTab('forecast')}
        >
          Risk Trajectory & Forecast
        </button>
        <button
          className={`page-tab-btn ${activeTab === 'xai' ? 'active' : ''}`}
          onClick={() => setActiveTab('xai')}
        >
          Explainable AI (XAI)
        </button>
        <button
          className={`page-tab-btn ${activeTab === 'timeline' ? 'active' : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Chronological Timeline
        </button>
      </div>

      {/* TAB 1: RESULTS & DIGITAL TWIN (Matching Screenshot 1 Layout) */}
      {activeTab === 'results' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.25fr 1fr',
          gap: '1.75rem',
          alignItems: 'start'
        }}>
          {/* LEFT COLUMN: Clean Continuous Risk Slider + Biometrics + Heatmap Matrix */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* 1. Patient Total Cardiovascular Risk Abundance Slider matching reference */}
            <div className="risk-abundance-banner">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Patient Total Cardiovascular Risk Index
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  &lt; Potential Low Risk &bull; Healthy Cohort &bull; Elevated Vulnerability &gt;
                </span>
              </div>

              {/* Slider track with floating 'You: XX%' indicator */}
              <div style={{ position: 'relative', margin: '1.25rem 0 0.5rem 0' }}>
                <div style={{
                  height: '10px',
                  borderRadius: '5px',
                  background: 'linear-gradient(90deg, #10b981 0%, #38bdf8 35%, #f59e0b 70%, #ef4444 100%)'
                }} />

                {/* Floating "You: XX%" bubble indicator */}
                <div style={{
                  position: 'absolute',
                  left: `${Math.min(92, Math.max(8, activePatient.riskPercentage))}%`,
                  top: '-32px',
                  transform: 'translateX(-50%)',
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                }}>
                  You: {activePatient.riskPercentage}%
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>-30%</span>
                <span>-10%</span>
                <span style={{ color: 'var(--primary-blue)', fontWeight: 600 }}>Healthy Reference</span>
                <span>+15%</span>
                <span>+30%</span>
              </div>
            </div>

            {/* 2. Continuous Telemetry & Hemodynamics (Clean Spacious Rows matching Screenshot 1) */}
            <div className="clean-card">
              <div className="clean-card-header">
                <div>
                  <div className="clean-card-title">
                    Daily Hemodynamics & Wearable Biomarkers
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Daily wearable telemetry summaries from smartwatch & sensor feeds (demo)
                  </div>
                </div>
                <button 
                  className="btn-clean btn-clean-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.3rem 0.7rem' }}
                  onClick={() => setShowRealTimeModal(true)}
                >
                  <Activity size={13} color="var(--primary-blue)" /> Live Telemetry Waveforms
                </button>
              </div>

              {/* Row 1: Heart Rate */}
              <div className="metric-slider-row">
                <div className="metric-row-header">
                  <span className="metric-row-title">Resting Heart Rate</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="metric-row-val">{activePatient.vitals.restingHR} BPM</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Peak: {activePatient.vitals.heartRate} BPM</span>
                  </div>
                </div>
                <div className="clean-slider-track">
                  <div className="clean-slider-colored-zone" style={{ left: '20%', width: '50%', background: '#a7f3d0' }} />
                  <div className="clean-slider-pin" style={{ left: `${(activePatient.vitals.heartRate / 140) * 100}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <span>40 BPM</span>
                  <span>Target Range: 60 - 100 BPM</span>
                  <span>140 BPM</span>
                </div>
              </div>

              {/* Row 2: rMSSD HRV */}
              <div className="metric-slider-row">
                <div className="metric-row-header">
                  <span className="metric-row-title">rMSSD Heart Rate Variability (HRV)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="metric-row-val" style={{ color: activePatient.vitals.hrvChange7d < 0 ? '#b45309' : 'var(--text-main)' }}>
                      {activePatient.vitals.hrv} ms ({activePatient.vitals.hrvChange7d}%)
                    </span>
                  </div>
                </div>
                <div className="clean-slider-track">
                  <div className="clean-slider-colored-zone" style={{ left: '40%', width: '50%', background: '#a7f3d0' }} />
                  <div className="clean-slider-pin" style={{ left: `${(activePatient.vitals.hrv / 100) * 100}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <span>10 ms</span>
                  <span>Autonomic Baseline: &gt; 55 ms</span>
                  <span>100 ms</span>
                </div>
              </div>

              {/* Row 3: Blood Pressure */}
              <div className="metric-slider-row">
                <div className="metric-row-header">
                  <span className="metric-row-title">Systolic & Diastolic Blood Pressure</span>
                  <span className="metric-row-val">{activePatient.vitals.bloodPressure} mmHg</span>
                </div>
                <div className="clean-slider-track">
                  <div className="clean-slider-colored-zone" style={{ left: '15%', width: '45%', background: '#a7f3d0' }} />
                  <div className="clean-slider-pin" style={{ left: '68%' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <span>90 systolic</span>
                  <span>Normotensive: &lt; 120/80 mmHg</span>
                  <span>180 systolic</span>
                </div>
              </div>

              {/* Row 4: Daily Steps */}
              <div className="metric-slider-row">
                <div className="metric-row-header">
                  <span className="metric-row-title">Daily Physical Exertion (Steps)</span>
                  <span className="metric-row-val">{activePatient.vitals.dailySteps.toLocaleString()} steps</span>
                </div>
                <div className="clean-slider-track">
                  <div className="clean-slider-colored-zone" style={{ left: '50%', width: '45%', background: '#a7f3d0' }} />
                  <div className="clean-slider-pin" style={{ left: `${(activePatient.vitals.dailySteps / 12000) * 100}%` }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                  <span>0</span>
                  <span>Cardio Target: &gt; 7,500 steps/day</span>
                  <span>12,000</span>
                </div>
              </div>
            </div>

            {/* 3. Therapeutic / Pharmacological Sensitivity Heatmap Grid (matching screenshot) */}
            <div className="clean-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Pharmacological Sensitivity & Metabolic Response
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    Drug clearance and autonomic responsiveness index
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Low <span style={{ width: 30, height: 6, background: '#bfdbfe', display: 'inline-block', borderRadius: 2 }} /> High
                </span>
              </div>

              <div className="sensitivity-grid">
                <div className="sensitivity-cell" style={{ background: '#dbeafe' }}>Amlodipine</div>
                <div className="sensitivity-cell" style={{ background: '#bfdbfe' }}>0.3 mg/L</div>
                <div className="sensitivity-cell" style={{ background: '#93c5fd' }}>&lt; 0.9</div>
                <div className="sensitivity-cell" style={{ background: '#60a5fa', color: '#fff' }}>Optimal</div>

                <div className="sensitivity-cell" style={{ background: '#dbeafe' }}>Atorvastatin</div>
                <div className="sensitivity-cell" style={{ background: '#93c5fd' }}>50 ng/mL</div>
                <div className="sensitivity-cell" style={{ background: '#60a5fa', color: '#fff' }}>0.85</div>
                <div className="sensitivity-cell" style={{ background: '#3b82f6', color: '#fff' }}>Responsive</div>

                <div className="sensitivity-cell" style={{ background: '#dbeafe' }}>Metoprolol</div>
                <div className="sensitivity-cell" style={{ background: '#bfdbfe' }}>&lt; 0.1</div>
                <div className="sensitivity-cell" style={{ background: '#93c5fd' }}>0.42</div>
                <div className="sensitivity-cell" style={{ background: '#60a5fa', color: '#fff' }}>Adequate</div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: 2D Anatomical Digital Twin & Clinical Insights (Matching Screenshot 1) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Insights Card 1: Cardiovascular Digital Twin Core */}
            <div className="clean-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 'var(--radius-md)',
                    background: '#fee2e2',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Heart size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Cardiovascular Digital Twin
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Interactive Anatomical Navigation
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: activePatient.riskLevel === 'critical' ? '#ef4444' : '#f59e0b' }}>
                    {activePatient.riskPercentage} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100 Impact</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 600 }}>&bull; High Concern</span>
                </div>
              </div>

              {/* 2D Anatomical Body Centerpiece */}
              <div className="twin-light-canvas">
                <img
                  src="/assets/human-anatomy.png"
                  alt="2D Anatomical Human Digital Twin"
                  className="twin-light-img"
                />

                {/* Hotspots */}
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
                        if (hotspot.id === 'heart') setShowCardioModal(true);
                      }}
                      title={`Click to inspect ${hotspot.label}`}
                    >
                      <div className="hotspot-beacon-light">
                        <Icon size={15} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Clinical Interpretation & Checkpoints (matching reference screenshot) */}
              <div style={{ marginTop: '1.25rem' }}>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.35rem' }}>
                  Cardiovascular Vulnerability & Autonomic Tone
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '0.75rem' }}>
                  {activePatient.summaryText}
                </p>

                {/* 2-column checklist items matching screenshot */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  color: 'var(--text-main)',
                  background: '#f8fafc',
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={13} color="var(--primary-blue)" /> Nocturnal HRV Tone Deficit
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={13} color="var(--primary-blue)" /> Stage 1 SBP Hemodynamic Load
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={13} color="var(--primary-blue)" /> Decreased Physical Exertion
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={13} color="var(--primary-blue)" /> Non-Dipping Resting Pulse
                  </div>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.65rem' }}>
                  <button 
                    className="btn-clean btn-clean-secondary"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => setShowCardioModal(true)}
                  >
                    Open Full System Report
                  </button>
                  <button 
                    className="btn-clean btn-clean-primary"
                    style={{ fontSize: '0.78rem' }}
                    onClick={() => setShowCareActionModal(true)}
                  >
                    Dispatch Care Protocol
                  </button>
                </div>
              </div>
            </div>

            {/* Insights Card 2: Metabolic Balance & Endocrine */}
            <div className="clean-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.65rem' }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Metabolic & Renal Risk
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: '#10b981' }}>
                  19 <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>/ 100 Impact</span>
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Preserved renal filtration with stable eGFR (88 mL/min) and optimal glycemic index.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RISK TRAJECTORY & 7-DAY FORECAST */}
      {activeTab === 'forecast' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <RiskForecastChart
            trajectory={activePatient.riskTrajectory}
            patientName={activePatient.name}
          />
          <ExpectedVsActual patient={activePatient} />
        </div>
      )}

      {/* TAB 3: EXPLAINABLE AI (XAI) */}
      {activeTab === 'xai' && (
        <ExplainabilityPanel
          factors={activePatient.explainabilityFactors}
          summaryText={activePatient.summaryText}
          patientName={activePatient.name}
          riskLevel={activePatient.riskLevel}
        />
      )}

      {/* TAB 4: CHRONOLOGICAL TIMELINE */}
      {activeTab === 'timeline' && (
        <PatientTimeline timeline={activePatient.timeline} />
      )}

      {/* Modals */}
      {showCardioModal && (
        <CardiovascularReportModal
          patient={activePatient}
          onClose={() => setShowCardioModal(false)}
          onOpenCareAction={() => setShowCareActionModal(true)}
        />
      )}

      {showRealTimeModal && (
        <RealTimeDataMonitoringModal
          patient={activePatient}
          onClose={() => setShowRealTimeModal(false)}
        />
      )}

      {showCareActionModal && (
        <CareActionModal
          patient={activePatient}
          onClose={() => setShowCareActionModal(false)}
          onActionTriggered={() => {}}
        />
      )}

      {/* Bottom Floating Timeline Player Scrubber (matching reference video scrubber) */}
      <DemoModeController
        currentStepIndex={demoStepIndex}
        onStepChange={handleStepChange}
        isPlaying={isDemoPlaying}
        onTogglePlay={handleTogglePlay}
        onReset={handleResetDemo}
      />
    </div>
  );
}
