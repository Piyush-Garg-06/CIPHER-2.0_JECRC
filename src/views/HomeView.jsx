import React, { useState, useEffect, useMemo } from 'react';
import { 
  Heart, 
  Activity, 
  Wind, 
  Footprints, 
  Clock, 
  Moon, 
  Check, 
  AlertCircle, 
  Pill, 
  FileText, 
  ChevronRight, 
  Plus, 
  Zap,
  Sparkles,
  ArrowUpRight,
  Radio,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import CardiovascularReportModal from '../components/CardiovascularReportModal';
import RealTimeDataMonitoringModal from '../components/RealTimeDataMonitoringModal';
import CareActionModal from '../components/CareActionModal';
import ExploreDigitalTwinModal from '../components/ExploreDigitalTwinModal';
import { PATIENT_MEDICATIONS } from '../services/medicationData';

export default function HomeView({ 
  patient, 
  patients = [], 
  onSelectPatient,
  onNavigateToMedications,
  onNavigateToPredictions,
  onNavigateToRecords,
  onNavigateToAlerts,
  userRole = 'patient'
}) {
  const [timeRange, setTimeRange] = useState('today'); // 'today' | '7d' | '30d'
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Live real-time clock and subtle telemetry ticking
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  const [livePulseOffset, setLivePulseOffset] = useState(0);
  const [isBeating, setIsBeating] = useState(false);

  // Modals state
  const [showCardioModal, setShowCardioModal] = useState(false);
  const [showRealTimeModal, setShowRealTimeModal] = useState(false);
  const [showCareModal, setShowCareModal] = useState(false);
  const [showExploreTwinModal, setShowExploreTwinModal] = useState(false);

  // 1. Live Clock Tick every 10 seconds
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    }, 10000);
    return () => clearInterval(clockInterval);
  }, []);

  // 2. Live Biometric Fluctuations (simulating real-time continuous wearable telemetry stream)
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      // Subtle natural fluctuation: -1, 0, +1, +2
      const offsets = [-1, 0, 1, 0, 2, 1, -1, 0];
      const nextOffset = offsets[Math.floor(Math.random() * offsets.length)];
      setLivePulseOffset(nextOffset);
      setIsBeating(true);
      setTimeout(() => setIsBeating(false), 600);
    }, 2800);
    return () => clearInterval(pulseInterval);
  }, []);

  if (!patient) return null;

  // -------------------------------------------------------------
  // DYNAMIC CLINICAL VITALS & BASELINES DERIVATION
  // -------------------------------------------------------------
  const vitals = patient.vitals || {};
  const rawHR = vitals.heartRate ?? 78;
  const currentHR = Math.max(48, rawHR + livePulseOffset);

  // Baseline resting HR: compute true resting baseline from twinState or clinical offset
  const baselineHR = Math.round(
    patient.twinState?.hr0 
      ? patient.twinState.hr0 
      : (vitals.restingHR && vitals.restingHR !== rawHR 
          ? vitals.restingHR 
          : Math.max(56, rawHR - 11))
  );

  // Heart Rate Delta against personal resting baseline
  const hrDiff = currentHR - baselineHR;
  const hrDeltaPercent = baselineHR ? Math.abs(((hrDiff / baselineHR) * 100)).toFixed(1) : '8.4';
  const isHrElevated = hrDiff > 0;

  // Blood Pressure
  const bpString = vitals.bloodPressure || '120/80';
  const bpParts = bpString.split('/');
  const currentSys = parseInt(bpParts[0], 10) || 120;
  const currentDia = parseInt(bpParts[1], 10) || 80;
  const isBpStage2 = currentSys >= 140 || currentDia >= 90;
  const isBpStage1 = (currentSys >= 130 && currentSys < 140) || (currentDia >= 80 && currentDia < 90);
  const bpCategory = vitals.bpCategory || (isBpStage2 ? 'Stage 2 HTN' : isBpStage1 ? 'Stage 1 HTN' : 'Normal Range');

  // SpO2
  const spo2Val = vitals.spo2 ?? 98;
  const isSpo2Low = spo2Val < 95;
  const isSpo2Borderline = spo2Val >= 95 && spo2Val < 97;

  // Daily Activity
  const dailySteps = vitals.dailySteps ?? 4500;
  const stepsGoal = vitals.stepsBaseline ?? 10000;
  const stepsPercent = Math.min(100, Math.round((dailySteps / stepsGoal) * 100));
  const stepsChange = vitals.stepsChange7d;

  // -------------------------------------------------------------
  // DYNAMIC SPARKLINE GENERATORS
  // -------------------------------------------------------------
  const generateSparklinePath = (dataPoints, width = 90, height = 28) => {
    if (!dataPoints || dataPoints.length < 2) {
      return `M 2 ${height / 2} L ${width - 2} ${height / 2}`;
    }
    const min = Math.min(...dataPoints);
    const max = Math.max(...dataPoints);
    const range = max - min || 1;
    const padding = 4;
    const usableHeight = height - padding * 2;

    const coords = dataPoints.map((val, idx) => {
      const x = padding + (idx / (dataPoints.length - 1)) * (width - padding * 2);
      const y = height - padding - ((val - min) / range) * usableHeight;
      return { x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) };
    });

    let d = `M ${coords[0].x} ${coords[0].y}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const p1 = coords[i];
      const p2 = coords[i + 1];
      const cx = (p1.x + p2.x) / 2;
      d += ` Q ${p1.x} ${p1.y}, ${cx} ${(p1.y + p2.y) / 2} T ${p2.x} ${p2.y}`;
    }
    return d;
  };

  // 7-day sparkline arrays
  const hrSparklinePoints = useMemo(() => {
    const recent = patient.twinState?.recentReadings;
    if (Array.isArray(recent) && recent.length > 0) {
      const vals = recent.map(r => r.restingHR).filter(v => v != null);
      if (vals.length >= 3) return [...vals, currentHR];
    }
    return [baselineHR - 2, baselineHR + 1, baselineHR + 3, baselineHR + 5, currentHR - 3, currentHR - 1, currentHR];
  }, [patient, baselineHR, currentHR]);

  const bpSparklinePoints = useMemo(() => {
    return [currentSys - 8, currentSys - 4, currentSys - 6, currentSys - 2, currentSys + 3, currentSys - 1, currentSys];
  }, [currentSys]);

  const spo2SparklinePoints = useMemo(() => {
    return [spo2Val, Math.min(100, spo2Val + 1), spo2Val, Math.max(90, spo2Val - 1), spo2Val, spo2Val, spo2Val];
  }, [spo2Val]);

  const stepsSparklinePoints = useMemo(() => {
    return [
      Math.round(dailySteps * 0.4),
      Math.round(dailySteps * 0.6),
      Math.round(dailySteps * 0.5),
      Math.round(dailySteps * 0.75),
      Math.round(dailySteps * 0.85),
      Math.round(dailySteps * 0.95),
      dailySteps
    ];
  }, [dailySteps]);

  // -------------------------------------------------------------
  // DYNAMIC SPLINE CHART DATA (Heart Rate & Blood Pressure)
  // -------------------------------------------------------------
  const hrChartData = useMemo(() => {
    if (timeRange === '7d') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days.map((day, idx) => {
        const offset = Math.round(Math.sin((idx / 6) * Math.PI) * 9) - (idx % 2 === 0 ? 3 : -2);
        const val = Math.max(52, Math.min(135, currentHR + offset));
        return { time: day, hr: idx === 6 ? currentHR : val };
      });
    }

    if (timeRange === '30d') {
      const intervals = ['Day 1', 'Day 6', 'Day 12', 'Day 18', 'Day 24', 'Day 30'];
      return intervals.map((label, idx) => {
        const offset = Math.round(Math.cos((idx / 5) * Math.PI) * 11);
        const val = Math.max(54, Math.min(135, baselineHR + 7 + offset));
        return { time: label, hr: idx === 5 ? currentHR : val };
      });
    }

    // Default 'today': Continuous diurnal circadian spline
    const morningDip = Math.max(50, baselineHR - 3);
    const afternoonPeak = Math.max(morningDip + 12, currentHR + 3);
    return [
      { time: '06:00', hr: morningDip },
      { time: '08:00', hr: Math.round(morningDip + (afternoonPeak - morningDip) * 0.45) },
      { time: '10:00', hr: Math.round(morningDip + (afternoonPeak - morningDip) * 0.3) },
      { time: '12:00', hr: Math.round(morningDip + (afternoonPeak - morningDip) * 0.75) },
      { time: '14:00', hr: afternoonPeak },
      { time: '16:00', hr: Math.round(morningDip + (afternoonPeak - morningDip) * 0.5) },
      { time: '18:00', hr: Math.round(morningDip + (afternoonPeak - morningDip) * 0.65) },
      { time: '20:00', hr: currentHR }
    ];
  }, [timeRange, currentHR, baselineHR]);

  const chartWidth = 650;
  const chartHeight = 220;
  const paddingX = 45;
  const paddingY = 25;

  const hrVals = hrChartData.map(d => d.hr);
  const minHR = Math.max(40, Math.floor((Math.min(...hrVals) - 6) / 10) * 10);
  const maxHR = Math.min(160, Math.ceil((Math.max(...hrVals) + 12) / 10) * 10);

  const getX = (idx) => paddingX + (idx / (hrChartData.length - 1)) * (chartWidth - paddingX * 2);
  const getY = (val) => chartHeight - paddingY - ((val - minHR) / Math.max(1, (maxHR - minHR))) * (chartHeight - paddingY * 2);

  const generateSmoothPath = (pts) => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  };

  const hrPoints = hrChartData.map((d, i) => ({ x: getX(i), y: getY(d.hr) }));
  const smoothCurve = generateSmoothPath(hrPoints);
  const areaPath = hrPoints.length > 0 
    ? `${smoothCurve} L ${hrPoints[hrPoints.length - 1].x} ${chartHeight - paddingY} L ${hrPoints[0].x} ${chartHeight - paddingY} Z`
    : '';

  // Blood Pressure Dual Chart Data
  const bpChartData = useMemo(() => {
    if (timeRange === '7d') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return days.map((day, idx) => {
        const delta = Math.round(Math.cos((idx / 6) * Math.PI) * 7);
        return { 
          time: day, 
          sys: idx === 6 ? currentSys : currentSys + delta, 
          dia: idx === 6 ? currentDia : currentDia + Math.round(delta * 0.5) 
        };
      });
    }

    if (timeRange === '30d') {
      const intervals = ['W1', 'W2', 'W3', 'W4', 'W5', 'Cur'];
      return intervals.map((label, idx) => {
        const delta = Math.round(Math.sin((idx / 5) * Math.PI) * 9);
        return { 
          time: label, 
          sys: idx === 5 ? currentSys : currentSys + delta, 
          dia: idx === 5 ? currentDia : currentDia + Math.round(delta * 0.5) 
        };
      });
    }

    // Default 'today'
    return [
      { time: '06:00', sys: currentSys - 5, dia: currentDia - 4 },
      { time: '08:00', sys: currentSys - 2, dia: currentDia - 2 },
      { time: '10:00', sys: currentSys - 4, dia: currentDia - 3 },
      { time: '12:00', sys: currentSys + 4, dia: currentDia + 2 },
      { time: '14:00', sys: currentSys + 3, dia: currentDia + 2 },
      { time: '16:00', sys: currentSys, dia: currentDia },
      { time: '18:00', sys: currentSys + 2, dia: currentDia + 1 },
      { time: '20:00', sys: currentSys, dia: currentDia }
    ];
  }, [timeRange, currentSys, currentDia]);

  const bpChartWidth = 340;
  const bpChartHeight = 150;
  const bpPadX = 35;
  const bpPadY = 22;

  const allSys = bpChartData.map(d => d.sys);
  const allDia = bpChartData.map(d => d.dia);
  const bpMin = Math.max(40, Math.floor((Math.min(...allDia) - 10) / 10) * 10);
  const bpMax = Math.min(200, Math.ceil((Math.max(...allSys) + 12) / 10) * 10);

  const getBpX = (idx) => bpPadX + (idx / (bpChartData.length - 1)) * (bpChartWidth - bpPadX * 2);
  const getBpY = (val) => bpChartHeight - bpPadY - ((val - bpMin) / Math.max(1, (bpMax - bpMin))) * (bpChartHeight - bpPadY * 2);

  const sysPoints = bpChartData.map((d, i) => ({ x: getBpX(i), y: getBpY(d.sys) }));
  const diaPoints = bpChartData.map((d, i) => ({ x: getBpX(i), y: getBpY(d.dia) }));

  const sysCurve = generateSmoothPath(sysPoints);
  const diaCurve = generateSmoothPath(diaPoints);

  // -------------------------------------------------------------
  // DYNAMIC BOTTOM CARDS & TIMELINE
  // -------------------------------------------------------------
  // Dynamic Alert Assessment
  const isHighRiskTriage = patient.twinState?.triageZone === 'red' || patient.riskLevel === 'critical';
  const isElevatedTriage = patient.twinState?.triageZone === 'yellow' || patient.riskLevel === 'elevated';

  let alertTitle = 'Activity goal in progress';
  let alertDesc = `${Math.max(0, stepsGoal - dailySteps).toLocaleString()} more steps to reach today's goal`;
  let alertSeverity = 'info';

  if (isHighRiskTriage) {
    alertTitle = `Critical Triage: ${bpCategory} Detected`;
    alertDesc = `BP ${bpString} mmHg and SpO2 ${spo2Val}%. Continuous telemetry bed review recommended.`;
    alertSeverity = 'critical';
  } else if (isElevatedTriage) {
    alertTitle = `Elevated Risk Alert: ${bpCategory}`;
    alertDesc = `Nocturnal recovery deficit detected. Systolic pressure elevated at ${currentSys} mmHg.`;
    alertSeverity = 'warning';
  } else if (patient.alerts && patient.alerts.length > 0) {
    alertTitle = patient.alerts[0].title;
    alertDesc = patient.alerts[0].recommendation || patient.alerts[0].description || patient.alerts[0].message;
    alertSeverity = patient.alerts[0].severity || 'info';
  }

  // Medication
  const patientMedEntry = PATIENT_MEDICATIONS[patient.id] || PATIENT_MEDICATIONS['PT-8092'];
  const firstMedication = patientMedEntry?.medications?.[0] || {
    name: isBpStage2 ? 'Amlodipine Besylate' : 'Cardiovascular Care Regimen',
    dosage: isBpStage2 ? '10 mg' : 'Prescribed',
    timing: '09:00 PM',
    frequency: 'Once Daily (Night)'
  };

  // Diagnostic Records
  const latestRecord = (patient.records && patient.records.length > 0) ? patient.records[0] : {
    title: `${patient.name} Cardiovascular Telemetry Summary`,
    date: currentTime ? `Today (${currentTime})` : 'Oct 2026',
    category: 'EHR Stream Sync'
  };

  return (
    <div className="patient-twin-dashboard">
      {/* 1. Header Row with Live Indicator & Time Range Filter */}
      <div className="dashboard-header-bar">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 className="dashboard-heading">
              Your health today
            </h1>
            {/* Live Streaming Badge */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              letterSpacing: '0.03em'
            }}>
              <span className="pulse-beacon-circle" style={{ background: '#10b981' }} />
              LIVE TELEMETRY
            </div>
          </div>
          <p className="dashboard-subheading">
            Continuous photoplethysmography sync &bull; <strong>{patient.name}</strong> &bull; Updated just now ({currentTime})
          </p>
        </div>

        {/* Time Filter Pills */}
        <div className="time-filter-pill-group">
          <button
            className={`time-filter-btn ${timeRange === 'today' ? 'active' : ''}`}
            onClick={() => setTimeRange('today')}
          >
            Today
          </button>
          <button
            className={`time-filter-btn ${timeRange === '7d' ? 'active' : ''}`}
            onClick={() => setTimeRange('7d')}
          >
            7 days
          </button>
          <button
            className={`time-filter-btn ${timeRange === '30d' ? 'active' : ''}`}
            onClick={() => setTimeRange('30d')}
          >
            30 days
          </button>
        </div>
      </div>

      {/* 2. Top 4 Metric Overview Cards (All 100% Dynamic & Live Ticking) */}
      <div className="top-metrics-grid">
        {/* Metric 1: Heart rate */}
        <div className="metric-stat-card">
          <div className="metric-stat-top">
            <div className="metric-stat-label-group">
              <Heart 
                size={16} 
                color="#e11d48" 
                style={{
                  transform: isBeating ? 'scale(1.25)' : 'scale(1)',
                  transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              />
              <span>Heart rate</span>
              <span className="pulse-beacon-circle" style={{ background: '#e11d48', width: 6, height: 6 }} />
            </div>
            <span 
              className="metric-stat-delta" 
              style={isHrElevated ? { background: '#fff1f2', color: '#e11d48' } : { background: '#ecfdf5', color: '#059669' }}
            >
              {isHrElevated ? `↗ +${hrDeltaPercent}%` : `↘ -${hrDeltaPercent}%`}
            </span>
          </div>

          <div className="metric-stat-middle">
            <div>
              <span className="metric-stat-value">{currentHR}</span>
              <span className="metric-stat-unit">bpm</span>
            </div>

            {/* Dynamic Real-Time Sparkline */}
            <svg className="metric-stat-sparkline" viewBox="0 0 90 28" fill="none">
              <path 
                d={generateSparklinePath(hrSparklinePoints)} 
                stroke="#e11d48" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
              />
              <circle 
                cx="86" 
                cy={14 - (livePulseOffset * 3)} 
                r="3" 
                fill="#e11d48"
              />
            </svg>
          </div>

          <div className="metric-stat-subtext">
            Resting {baselineHR} bpm &bull; typical range 60–100
          </div>
        </div>

        {/* Metric 2: Blood pressure */}
        <div className="metric-stat-card">
          <div className="metric-stat-top">
            <div className="metric-stat-label-group">
              <Activity size={16} color="#0d9488" />
              <span>Blood pressure</span>
            </div>
            <span 
              className="metric-stat-delta" 
              style={isBpStage2 ? { background: '#fee2e2', color: '#dc2626' } : (isBpStage1 ? { background: '#fffbeb', color: '#b45309' } : { background: '#f0fdfa', color: '#0d9488' })}
            >
              {isBpStage2 ? '↗ Stage 2 HTN' : (isBpStage1 ? '↗ Stage 1 HTN' : '↗ Optimal')}
            </span>
          </div>

          <div className="metric-stat-middle">
            <div>
              <span className="metric-stat-value">{bpString}</span>
              <span className="metric-stat-unit">mmHg</span>
            </div>

            {/* Dynamic Real-Time Sparkline */}
            <svg className="metric-stat-sparkline" viewBox="0 0 90 28" fill="none">
              <path 
                d={generateSparklinePath(bpSparklinePoints)} 
                stroke="#0d9488" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
              />
              <circle cx="86" cy="12" r="3" fill="#0d9488" />
            </svg>
          </div>

          <div className="metric-stat-subtext">
            {bpCategory} &bull; SBP {currentSys} / DBP {currentDia}
          </div>
        </div>

        {/* Metric 3: Blood oxygen */}
        <div className="metric-stat-card">
          <div className="metric-stat-top">
            <div className="metric-stat-label-group">
              <Wind size={16} color="#0284c7" />
              <span>Blood oxygen</span>
            </div>
            <span 
              className="metric-stat-delta" 
              style={isSpo2Low ? { background: '#fee2e2', color: '#dc2626' } : (isSpo2Borderline ? { background: '#fffbeb', color: '#b45309' } : { background: '#f0f9ff', color: '#0284c7' })}
            >
              {isSpo2Low ? '↘ Hypoxic' : (isSpo2Borderline ? '→ Borderline' : '↗ Normal')}
            </span>
          </div>

          <div className="metric-stat-middle">
            <div>
              <span className="metric-stat-value">{spo2Val}</span>
              <span className="metric-stat-unit">%</span>
            </div>

            {/* Dynamic Real-Time Sparkline */}
            <svg className="metric-stat-sparkline" viewBox="0 0 90 28" fill="none">
              <path 
                d={generateSparklinePath(spo2SparklinePoints)} 
                stroke="#0284c7" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
              />
              <circle cx="86" cy="14" r="3" fill="#0284c7" />
            </svg>
          </div>

          <div className="metric-stat-subtext">
            SpO2 &bull; live synced {currentTime}
          </div>
        </div>

        {/* Metric 4: Daily activity */}
        <div className="metric-stat-card">
          <div className="metric-stat-top">
            <div className="metric-stat-label-group">
              <Footprints size={16} color="#059669" />
              <span>Daily activity</span>
            </div>
            <span 
              className="metric-stat-delta" 
              style={stepsChange && stepsChange < 0 ? { background: '#fff1f2', color: '#e11d48' } : { background: '#ecfdf5', color: '#059669' }}
            >
              {stepsChange != null 
                ? (stepsChange >= 0 ? `↗ +${stepsChange}%` : `↘ ${stepsChange}%`)
                : (stepsPercent >= 70 ? '↗ Active' : '↘ In progress')}
            </span>
          </div>

          <div className="metric-stat-middle">
            <div>
              <span className="metric-stat-value">{dailySteps.toLocaleString()}</span>
              <span className="metric-stat-unit">steps</span>
            </div>

            {/* Dynamic Real-Time Sparkline */}
            <svg className="metric-stat-sparkline" viewBox="0 0 90 28" fill="none">
              <path 
                d={generateSparklinePath(stepsSparklinePoints)} 
                stroke="#059669" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
              />
              <circle cx="86" cy="10" r="3" fill="#059669" />
            </svg>
          </div>

          <div className="metric-stat-subtext">
            {stepsPercent}% of your {stepsGoal.toLocaleString()} step goal
          </div>
        </div>
      </div>

      {/* 3. Middle Section: Left Cardiac Stack + Right Digital Twin */}
      <div className="dashboard-center-split">
        {/* LEFT COLUMN: Cardiac Activity & Sub-Cards */}
        <div className="left-cardiac-stack">
          {/* Card 1: Heart rate through the day */}
          <div className="cardiac-main-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div className="card-category-label">CARDIAC ACTIVITY</div>
                <h2 className="card-heading-title">
                  {timeRange === 'today' ? 'Heart rate through the day' : (timeRange === '7d' ? '7-Day Heart Rate Trajectory' : '30-Day Longitudinal Trend')}
                </h2>
              </div>

              {/* Dynamic Legend with pulsating red dot and live ticking BPM */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', fontWeight: 700 }}>
                <span className="pulse-beacon-circle" style={{ background: '#e11d48' }} />
                <span style={{ color: '#64748b' }}>Heart rate</span>
                <span style={{ 
                  color: '#0f172a', 
                  fontSize: '1.05rem', 
                  fontWeight: 800,
                  transition: 'color 0.2s'
                }}>
                  {currentHR}
                </span>
                <span style={{ color: '#64748b', fontSize: '0.75rem' }}>bpm</span>
              </div>
            </div>

            {/* Interactive SVG Smooth Spline Chart */}
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
              <svg 
                viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                style={{ width: '100%', height: 'auto', display: 'block' }}
              >
                <defs>
                  <linearGradient id="hrAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                {[maxHR, Math.round(maxHR - (maxHR - minHR) * 0.25), Math.round(maxHR - (maxHR - minHR) * 0.5), Math.round(maxHR - (maxHR - minHR) * 0.75), minHR].map((val) => {
                  const y = getY(val);
                  return (
                    <g key={val}>
                      <line 
                        x1={paddingX} 
                        y1={y} 
                        x2={chartWidth - paddingX} 
                        y2={y} 
                        stroke="#f1f5f9" 
                        strokeWidth="1" 
                      />
                      <text 
                        x={paddingX - 10} 
                        y={y + 3} 
                        fill="#94a3b8" 
                        fontSize="10" 
                        textAnchor="end"
                        fontFamily="var(--font-mono)"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Area Gradient Fill */}
                {areaPath && <path d={areaPath} fill="url(#hrAreaGradient)" />}

                {/* Smooth Curve Line */}
                {smoothCurve && (
                  <path 
                    d={smoothCurve} 
                    fill="none" 
                    stroke="#e11d48" 
                    strokeWidth="2.8" 
                    strokeLinecap="round" 
                  />
                )}

                {/* Data Points on curve */}
                {hrChartData.map((d, i) => {
                  const x = getX(i);
                  const y = getY(d.hr);
                  const isHovered = hoveredPoint === i;

                  return (
                    <g key={d.time}>
                      <circle 
                        cx={x} 
                        cy={y} 
                        r={isHovered ? 6 : 3.5} 
                        fill="#ffffff" 
                        stroke="#e11d48" 
                        strokeWidth={isHovered ? 3 : 2}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                        onMouseEnter={() => setHoveredPoint(i)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                      {/* X-axis time label */}
                      <text 
                        x={x} 
                        y={chartHeight - 6} 
                        fill="#64748b" 
                        fontSize="11" 
                        textAnchor="middle"
                        fontWeight={isHovered ? '700' : '500'}
                      >
                        {d.time}
                      </text>

                      {/* Hover Tooltip */}
                      {isHovered && (
                        <g>
                          <rect 
                            x={x - 30} 
                            y={y - 32} 
                            width="60" 
                            height="22" 
                            rx="6" 
                            fill="#0f172a" 
                          />
                          <text 
                            x={x} 
                            y={y - 17} 
                            fill="#ffffff" 
                            fontSize="10" 
                            fontWeight="700" 
                            textAnchor="middle"
                          >
                            {d.hr} bpm
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Bottom Chart Metadata */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '0.85rem',
              paddingTop: '0.75rem',
              borderTop: '1px solid #f1f5f9',
              fontSize: '0.75rem',
              color: '#64748b'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Clock size={13} />
                <span>Last reading: Just now ({currentTime})</span>
              </div>
              <div>
                Resting baseline: <strong style={{ color: '#0f172a' }}>{baselineHR} bpm</strong> &bull; Typical: 60–100 bpm
              </div>
            </div>
          </div>

          {/* Sub-row: Blood pressure + Today's timeline */}
          <div className="sub-charts-row">
            {/* Card 2: Blood pressure */}
            <div className="sub-metric-card">
              <div>
                <div className="sub-card-header">
                  <div>
                    <h3 className="sub-card-title">Blood pressure</h3>
                    <div className="sub-card-subtitle">Systolic / diastolic &bull; mmHg</div>
                  </div>
                  <button 
                    className="sub-card-link"
                    onClick={() => setShowRealTimeModal(true)}
                  >
                    Details <ChevronRight size={13} />
                  </button>
                </div>

                {/* Dual Line SVG */}
                <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
                  <svg 
                    viewBox={`0 0 ${bpChartWidth} ${bpChartHeight}`} 
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  >
                    {/* Y-axis guidelines */}
                    {[bpMax, Math.round(bpMax - (bpMax - bpMin) * 0.33), Math.round(bpMax - (bpMax - bpMin) * 0.66), bpMin].map(val => {
                      const y = getBpY(val);
                      return (
                        <g key={val}>
                          <line x1={bpPadX} y1={y} x2={bpChartWidth - bpPadX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                          <text x={bpPadX - 6} y={y + 3} fill="#94a3b8" fontSize="8.5" textAnchor="end" fontFamily="var(--font-mono)">
                            {val}
                          </text>
                        </g>
                      );
                    })}

                    {/* Systolic curve (Teal) */}
                    {sysCurve && <path d={sysCurve} fill="none" stroke="#0d9488" strokeWidth="2.2" strokeLinecap="round" />}
                    {/* Diastolic curve (Blue) */}
                    {diaCurve && <path d={diaCurve} fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" />}

                    {/* Time labels */}
                    {bpChartData.map((d, i) => (
                      <text 
                        key={d.time} 
                        x={getBpX(i)} 
                        y={bpChartHeight - 4} 
                        fill="#94a3b8" 
                        fontSize="8.5" 
                        textAnchor="middle"
                      >
                        {d.time}
                      </text>
                    ))}
                  </svg>
                </div>
              </div>

              {/* Legend with patient's live BP readings */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginTop: '0.65rem', fontSize: '0.74rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#0d9488' }} />
                  <span style={{ color: '#64748b' }}>Systolic</span>
                  <strong style={{ color: '#0f172a' }}>{currentSys}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563eb' }} />
                  <span style={{ color: '#64748b' }}>Diastolic</span>
                  <strong style={{ color: '#0f172a' }}>{currentDia}</strong>
                </div>
              </div>
            </div>

            {/* Card 3: Today's timeline (Rich, Multi-event Chronological Track) */}
            <div className="sub-metric-card">
              <div>
                <div className="sub-card-header">
                  <div>
                    <h3 className="sub-card-title">Today's timeline</h3>
                    <div className="sub-card-subtitle">Continuous telemetry checkpoints</div>
                  </div>
                  <button 
                    className="sub-card-link"
                    onClick={() => setShowRealTimeModal(true)}
                  >
                    View all <ChevronRight size={13} />
                  </button>
                </div>

                <div className="timeline-event-list">
                  {/* Event 1: Real-time Live Sync Checkpoint */}
                  <div className="timeline-event-item">
                    <div className="timeline-event-left">
                      <div className="timeline-event-icon-box" style={{ background: '#fff1f2', color: '#e11d48' }}>
                        <Heart size={14} />
                      </div>
                      <div>
                        <div className="timeline-event-time">{currentTime} &bull; Live Telemetry</div>
                        <div className="timeline-event-title">Vitals synchronized</div>
                        <div className="timeline-event-desc">HR {currentHR} bpm &bull; SpO2 {spo2Val}%</div>
                      </div>
                    </div>
                    <div style={{ color: '#059669', background: '#ecfdf5', borderRadius: '50%', padding: 4 }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Event 2: Afternoon Walk / Exertion */}
                  <div className="timeline-event-item">
                    <div className="timeline-event-left">
                      <div className="timeline-event-icon-box" style={{ background: '#ecfdf5', color: '#059669' }}>
                        <Footprints size={14} />
                      </div>
                      <div>
                        <div className="timeline-event-time">12:15 PM &bull; Activity</div>
                        <div className="timeline-event-title">Daily exertion logged</div>
                        <div className="timeline-event-desc">
                          {Math.round(dailySteps * 0.38).toLocaleString()} steps &bull; {vitals.activeMinutes || 22} min active
                        </div>
                      </div>
                    </div>
                    <div style={{ color: '#059669', background: '#ecfdf5', borderRadius: '50%', padding: 4 }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Event 3: Morning Hemodynamics */}
                  <div className="timeline-event-item">
                    <div className="timeline-event-left">
                      <div className="timeline-event-icon-box" style={{ background: '#f0fdfa', color: '#0d9488' }}>
                        <Activity size={14} />
                      </div>
                      <div>
                        <div className="timeline-event-time">09:30 AM &bull; Blood Pressure</div>
                        <div className="timeline-event-title">Hemodynamics logged</div>
                        <div className="timeline-event-desc">
                          {bpString} mmHg &bull; {bpCategory}
                        </div>
                      </div>
                    </div>
                    <div style={{ color: '#059669', background: '#ecfdf5', borderRadius: '50%', padding: 4 }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>

                  {/* Event 4: Morning Sleep Architecture */}
                  <div className="timeline-event-item">
                    <div className="timeline-event-left">
                      <div className="timeline-event-icon-box" style={{ background: '#eff6ff', color: '#2563eb' }}>
                        <Moon size={14} />
                      </div>
                      <div>
                        <div className="timeline-event-time">07:05 AM &bull; Circadian Sleep</div>
                        <div className="timeline-event-title">Sleep summary</div>
                        <div className="timeline-event-desc">
                          {vitals.sleepHours || '7h 10m'} &bull; {vitals.deepSleepPercent ? `${vitals.deepSleepPercent}% deep` : 'restful'}
                        </div>
                      </div>
                    </div>
                    <div style={{ color: '#059669', background: '#ecfdf5', borderRadius: '50%', padding: 4 }}>
                      <Check size={12} strokeWidth={3} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: 3D Anatomical Digital Twin Showcase */}
        <div className="twin-showcase-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-category-label">PERSONALIZED VIEW</div>
              <h2 className="card-heading-title">Digital twin</h2>
            </div>
            {/* Status Ready badge */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#ecfdf5',
              color: '#059669',
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: 'var(--radius-full)'
            }}>
              <span className="pulse-beacon-circle" style={{ background: '#10b981' }} />
              Live Sync
            </div>
          </div>

          {/* 3D Anatomical Body Viewport */}
          <div className="twin-viewport-frame">
            {/* Technical grid watermark */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
              opacity: 0.4,
              pointerEvents: 'none'
            }} />

            {/* Continuous Top-to-Bottom Cyber Laser Telemetry Scan */}
            {/* Futuristic Laser Body Scanning Line */}
            <div className="body-scanner-line">
              <div className="scanner-glow-beam" />
              <div className="scanner-horizontal-line" />
            </div>

            {/* Glowing Heartbeat Telemetry Beacon behind heart */}
            <div style={{
              position: 'absolute',
              top: '29%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239, 68, 68, 0.6) 0%, rgba(244, 63, 94, 0.2) 45%, transparent 70%)',
              filter: 'blur(10px)',
              pointerEvents: 'none',
              zIndex: 8,
              animation: 'heart-pulse 0.8s ease-in-out infinite'
            }} />

            {/* High-definition 3D Anatomical Twin Image */}
            <img 
              src="/assets/digital-twin-anatomy.jpg" 
              alt="Patient 3D Anatomical Digital Twin"
              className="twin-anatomy-render-img"
            />

            {/* Targeting Brackets around chest */}
            <div className="targeting-bracket top-left" />
            <div className="targeting-bracket bottom-right" />

            {/* Interactive Callout Tag 1: HEART neatly placed on right side of anatomical heart */}
            <button
              className="twin-callout-tag heart-tag"
              onClick={() => setShowCardioModal(true)}
              title="Click to inspect Cardiovascular System Report"
              style={{
                top: '28%',
                left: '58%',
                transform: 'translateY(-50%)',
                padding: '3px 8px',
                fontSize: '0.66rem',
                gap: '0.28rem',
                zIndex: 20,
                whiteSpace: 'nowrap'
              }}
            >
              <Heart 
                size={11} 
                style={{
                  transform: isBeating ? 'scale(1.25)' : 'scale(1)',
                  transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
              />
              <span>HEART</span>
              <span className="pulse-beacon-circle" style={{ background: '#e11d48', width: 5, height: 5 }} />
            </button>

            {/* Center-bottom CTA: Explore Digital Twin */}
            <button
              className="btn-explore-twin"
              onClick={() => setShowExploreTwinModal(true)}
            >
              <Sparkles size={14} color="#0284c7" />
              <span>Explore Digital Twin</span>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Lower Metadata Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '0.85rem',
            fontSize: '0.74rem',
            color: '#64748b'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
              <span><strong>{patient.name}</strong> &bull; MRN #{patient.id ? patient.id.replace('PT-', '984') : '9848092'}</span>
            </div>
            <div>{patient.age}y {patient.gender} &bull; Anatomy Sync</div>
          </div>
        </div>
      </div>

      {/* 4. Bottom 3-Card Highlights Grid */}
      <div className="bottom-highlights-grid">
        {/* Card 1: ATTENTION • Recent alerts */}
        <div className="highlight-item-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-category-label">ATTENTION</div>
              <h3 className="sub-card-title">Recent alerts</h3>
            </div>
            <button 
              className="sub-card-link"
              onClick={() => onNavigateToAlerts ? onNavigateToAlerts() : setShowCareModal(true)}
            >
              All alerts <ChevronRight size={13} />
            </button>
          </div>

          <div className="highlight-row">
            <div className="highlight-left-cluster">
              <div 
                className="highlight-icon-box" 
                style={alertSeverity === 'critical' 
                  ? { background: '#fee2e2', color: '#dc2626' } 
                  : (alertSeverity === 'warning' ? { background: '#fffbeb', color: '#b45309' } : { background: '#fff1f2', color: '#e11d48' })}
              >
                <AlertCircle size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {alertTitle}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {alertDesc}
                </div>
              </div>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600 }}>
              {currentTime}
            </span>
          </div>
        </div>

        {/* Card 2: YOUR ROUTINE • Medication reminders */}
        <div className="highlight-item-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-category-label">YOUR ROUTINE</div>
              <h3 className="sub-card-title">Medication reminders</h3>
            </div>
          </div>

          <div className="highlight-row">
            <div className="highlight-left-cluster">
              <div className="highlight-icon-box" style={{ background: 'var(--bg-card-hover)', border: '1px solid var(--border-light)', color: 'var(--primary-blue)' }}>
                <Pill size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {firstMedication.name} {firstMedication.dosage}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Next dose at {firstMedication.timing} &bull; {firstMedication.frequency}
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigateToMedications ? onNavigateToMedications() : null}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '6px 12px',
                borderRadius: '8px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                color: '#0f172a',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              <Plus size={13} /> Add reminder
            </button>
          </div>
        </div>

        {/* Card 3: RECENTLY ADDED • Medical reports */}
        <div className="highlight-item-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div className="card-category-label">RECENTLY ADDED</div>
              <h3 className="sub-card-title">Medical reports</h3>
            </div>
            <button 
              className="sub-card-link"
              onClick={() => onNavigateToRecords ? onNavigateToRecords() : null}
            >
              View reports <ChevronRight size={13} />
            </button>
          </div>

          <div 
            className="highlight-row"
            style={{ cursor: 'pointer' }}
            onClick={() => onNavigateToRecords ? onNavigateToRecords() : null}
          >
            <div className="highlight-left-cluster">
              <div className="highlight-icon-box" style={{ background: '#f0fdf4', color: '#059669' }}>
                <FileText size={18} />
              </div>
              <div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                  {latestRecord.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                  {latestRecord.category || 'Diagnostic Record'} &bull; {latestRecord.date || 'Oct 2026'}
                </div>
              </div>
            </div>
            <ChevronRight size={15} color="#94a3b8" />
          </div>
        </div>
      </div>

      {/* MODALS */}
      {showCardioModal && (
        <CardiovascularReportModal
          patient={patient}
          onClose={() => setShowCardioModal(false)}
          onOpenCareAction={() => {
            setShowCardioModal(false);
            setShowCareModal(true);
          }}
        />
      )}

      {showRealTimeModal && (
        <RealTimeDataMonitoringModal
          patient={patient}
          onClose={() => setShowRealTimeModal(false)}
        />
      )}

      {showCareModal && (
        <CareActionModal
          patient={patient}
          onClose={() => setShowCareModal(false)}
        />
      )}

      {showExploreTwinModal && (
        <ExploreDigitalTwinModal
          isOpen={showExploreTwinModal}
          patient={patient}
          onClose={() => setShowExploreTwinModal(false)}
          onOpenCardioReport={() => setShowCardioModal(true)}
        />
      )}
    </div>
  );
}
