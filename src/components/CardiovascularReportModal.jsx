import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Heart, 
  Activity, 
  ShieldCheck, 
  Footprints, 
  Clock, 
  Moon, 
  Check, 
  AlertTriangle, 
  X, 
  ArrowUpRight, 
  Zap, 
  Sun, 
  Moon as MoonIcon,
  Sparkles,
  Radio,
  Wifi,
  Gauge,
  Play,
  RotateCcw
} from 'lucide-react';

export default function CardiovascularReportModal({ patient, onClose, onOpenCareAction }) {
  if (!patient) return null;

  // Theme state: defaults to dark matching user reference, with instant toggle to light theme
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  // Active view tab for daily performance card: 'stream' (live 60s rolling telemetry buffer) or 'today' (circadian intraday)
  const [chartMode, setChartMode] = useState('stream');
  const [activeHotspot, setActiveHotspot] = useState(null);

  // Live real-time biometric states
  const [livePulseOffset, setLivePulseOffset] = useState(0);
  const [liveSysOffset, setLiveSysOffset] = useState(0);
  const [liveDiaOffset, setLiveDiaOffset] = useState(0);
  const [liveSpo2Offset, setLiveSpo2Offset] = useState(0);
  const [liveStepAdd, setLiveStepAdd] = useState(0);
  const [isBeating, setIsBeating] = useState(false);
  const [packetCount, setPacketCount] = useState(2888);
  const [secondsSinceSync, setSecondsSinceSync] = useState(0);
  const [isSimulatingExertion, setIsSimulatingExertion] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);

  // Live Clock string updating every second
  const [currentTime, setCurrentTime] = useState(() => 
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // 1. Live Clock updating every second & sync timer
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setSecondsSinceSync(prev => prev + 1);
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  // 2. Base vitals from patient object
  const vitals = patient.vitals || {};
  const rawHR = vitals.heartRate ?? 74;
  const restingHR = Math.round(
    patient.twinState?.hr0 
      ? patient.twinState.hr0 
      : (vitals.restingHR && vitals.restingHR !== rawHR 
          ? vitals.restingHR 
          : Math.max(56, rawHR - 11))
  );

  const bpString = vitals.bloodPressure || '118/76';
  const bpParts = bpString.split('/');
  const baseSys = parseInt(bpParts[0], 10) || 118;
  const baseDia = parseInt(bpParts[1], 10) || 76;
  const baseSpo2 = vitals.spo2 ?? 98;
  const baseSteps = vitals.dailySteps ?? 5680;
  const activeMinutes = vitals.activeMinutes ?? 42;
  const sleepHours = vitals.sleepHours ?? '8.0h';
  const stepsGoal = vitals.stepsBaseline ?? 10000;

  // Real-time calculated live values
  const liveHR = Math.max(48, rawHR + livePulseOffset + (isSimulatingExertion ? 15 : 0));
  const liveSys = Math.max(90, baseSys + liveSysOffset + (isSimulatingExertion ? 9 : 0));
  const liveDia = Math.max(60, baseDia + liveDiaOffset + (isSimulatingExertion ? 5 : 0));
  const liveSpo2 = Math.min(100, Math.max(90, baseSpo2 + liveSpo2Offset));
  const liveSteps = baseSteps + liveStepAdd;
  const stepsPercent = Math.min(100, Math.round((liveSteps / stepsGoal) * 100));

  const isBpStage2 = liveSys >= 140 || liveDia >= 90;
  const isBpStage1 = (liveSys >= 130 && liveSys < 140) || (liveDia >= 80 && liveDia < 90);

  // 3. Live rolling telemetry buffer for the real-time chart (12 rolling timepoints)
  const [telemetryStream, setTelemetryStream] = useState(() => {
    const initial = [];
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const pastTime = new Date(now - i * 2500);
      const timeStr = pastTime.toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });
      const jitter = (i % 3 === 0 ? 1 : i % 2 === 0 ? -1 : 0);
      initial.push({
        time: timeStr,
        hr: Math.max(50, rawHR + jitter),
        sys: baseSys + jitter,
        dia: baseDia
      });
    }
    return initial;
  });

  // 4. Continuous Real-time Telemetry Ingestion Loop (ticking every 2.2 seconds)
  useEffect(() => {
    const pulseInterval = setInterval(() => {
      // Natural respiratory sinus arrhythmia (RSA) and subtle arterial wave variance
      const hrOffsets = [-2, -1, 0, 1, 2, 1, 0, -1];
      const sysOffsets = [-1, 0, 1, 0, -1, 2, 0];
      const diaOffsets = [-1, 0, 1, 0];
      const spo2Offsets = [0, 0, 0, 1, 0, -1, 0];

      const nextHrOff = hrOffsets[Math.floor(Math.random() * hrOffsets.length)];
      const nextSysOff = sysOffsets[Math.floor(Math.random() * sysOffsets.length)];
      const nextDiaOff = diaOffsets[Math.floor(Math.random() * diaOffsets.length)];
      const nextSpo2Off = spo2Offsets[Math.floor(Math.random() * spo2Offsets.length)];

      setLivePulseOffset(nextHrOff);
      setLiveSysOffset(nextSysOff);
      setLiveDiaOffset(nextDiaOff);
      setLiveSpo2Offset(nextSpo2Off);

      // Random step increment if active
      if (Math.random() > 0.45) {
        setLiveStepAdd(prev => prev + Math.floor(Math.random() * 3) + 1);
      }

      // Heartbeat trigger (synchronous double beat)
      setIsBeating(true);
      setPacketCount(prev => prev + 1);
      setSecondsSinceSync(0);

      const nextHrVal = Math.max(50, rawHR + nextHrOff + (isSimulatingExertion ? 15 : 0));
      const nextSysVal = Math.max(90, baseSys + nextSysOff + (isSimulatingExertion ? 9 : 0));
      const nextDiaVal = Math.max(60, baseDia + nextDiaOff + (isSimulatingExertion ? 5 : 0));

      const nowTimeStr = new Date().toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });

      setTelemetryStream(prev => {
        const updated = [...prev.slice(1), {
          time: nowTimeStr,
          hr: nextHrVal,
          sys: nextSysVal,
          dia: nextDiaVal
        }];
        return updated;
      });

      setTimeout(() => setIsBeating(false), 550);
    }, 2200);

    return () => clearInterval(pulseInterval);
  }, [rawHR, baseSys, baseDia, isSimulatingExertion]);

  // Exertion test simulator auto-reset after 7 seconds
  const triggerExertionBurst = () => {
    setIsSimulatingExertion(true);
    setTimeout(() => {
      setIsSimulatingExertion(false);
    }, 7000);
  };

  // 5. Clinically Calibrated Risk Indicator
  const calibratedRisk = useMemo(() => {
    const zone = patient.twinState?.triageZone || patient.riskLevel;
    const basePct = patient.riskPercentage;

    // If explicit clinical percentage already present (e.g. Rahul Sharma 68%, Aarav Saxena 90%)
    if (basePct != null && basePct >= 20) {
      const score = Math.min(100, Math.max(1, basePct));
      return {
        score,
        label: score >= 70 ? 'Critical' : 'Elevated',
        color: score >= 70 ? '#ef4444' : '#f59e0b'
      };
    }

    // Calibrate based on triage zone and live blood pressure / vitals
    if (zone === 'red' || patient.riskLevel === 'critical') {
      const score = Math.min(96, Math.max(72, Math.round(78 + (liveSys - 135) * 0.4)));
      return { score, label: 'Critical', color: '#ef4444' };
    }

    if (zone === 'yellow' || patient.riskLevel === 'elevated' || isBpStage1 || isBpStage2) {
      const score = Math.min(68, Math.max(38, Math.round(48 + (liveSys - 128) * 0.5 + (liveHR - restingHR) * 0.3)));
      return { score, label: 'Elevated', color: '#f59e0b' };
    }

    // Stable green zone
    const score = Math.min(32, Math.max(8, Math.round(14 + (liveSys - 118) * 0.3)));
    return { score, label: 'Stable', color: '#10b981' };
  }, [patient, liveSys, liveHR, restingHR, isBpStage1, isBpStage2]);

  const riskScore = calibratedRisk.score;
  const riskLabel = calibratedRisk.label;
  const riskColor = calibratedRisk.color;

  // 6. Intraday (24h) Performance Chart Points anchored to current live reading
  const minHR = Math.max(50, restingHR - 3);
  const maxHR = Math.max(minHR + 16, liveHR + 2);
  const intradayPoints = useMemo(() => [
    { time: '06:00', hr: minHR },
    { time: '08:00', hr: Math.round(minHR + (maxHR - minHR) * 0.45) },
    { time: '10:00', hr: Math.round(minHR + (maxHR - minHR) * 0.3) },
    { time: '12:00', hr: Math.round(minHR + (maxHR - minHR) * 0.75) },
    { time: '14:00', hr: maxHR },
    { time: '16:00', hr: Math.round(minHR + (maxHR - minHR) * 0.52) },
    { time: '18:00', hr: Math.round(minHR + (maxHR - minHR) * 0.65) },
    { time: 'Now', hr: liveHR }
  ], [minHR, maxHR, liveHR]);

  // Active chart points based on mode
  const activeChartData = chartMode === 'stream' ? telemetryStream : intradayPoints;

  // SVG Chart Dimensions
  const chartW = 340;
  const chartH = 95;
  const padX = 22;
  const padY = 14;
  const yMin = chartMode === 'stream' ? Math.min(...telemetryStream.map(d => d.hr)) - 6 : 50;
  const yMax = chartMode === 'stream' ? Math.max(...telemetryStream.map(d => d.hr)) + 6 : 110;

  const getPtX = (idx) => padX + (idx / (activeChartData.length - 1)) * (chartW - padX * 2);
  const getPtY = (val) => chartH - padY - ((val - yMin) / (Math.max(1, yMax - yMin))) * (chartH - padY * 2);

  const pts = activeChartData.map((d, i) => ({ x: getPtX(i), y: getPtY(d.hr) }));
  
  let curveD = pts.length > 0 ? `M ${pts[0].x} ${pts[0].y}` : '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    curveD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  const areaD = pts.length > 0 ? `${curveD} L ${pts[pts.length - 1].x} ${chartH} L ${pts[0].x} ${chartH} Z` : '';

  // Theme Palette Tokens
  const theme = isDarkTheme ? {
    bgModal: '#060d19',
    bgCard: '#0a1628',
    borderCard: '#13233c',
    textMain: '#ffffff',
    textSub: '#94a3b8',
    textMuted: '#64748b',
    iconBg: '#0f2744',
    iconColor: '#38bdf8',
    badgeBg: '#0f2744',
    badgeText: '#38bdf8',
    progressBg: '#13233c',
    progressFill: '#06b6d4',
    gridLine: '#13233c',
    twinBg: 'radial-gradient(circle at 50% 35%, #0d1e38 0%, #060d19 100%)'
  } : {
    bgModal: '#ffffff',
    bgCard: '#f8fafc',
    borderCard: '#e2e8f0',
    textMain: '#0f172a',
    textSub: '#334155',
    textMuted: '#64748b',
    iconBg: '#e0f2fe',
    iconColor: '#0284c7',
    badgeBg: '#f1f5f9',
    badgeText: '#0284c7',
    progressBg: '#e2e8f0',
    progressFill: '#0284c7',
    gridLine: '#e2e8f0',
    twinBg: 'radial-gradient(circle at 50% 35%, #f1f5f9 0%, #e2e8f0 100%)'
  };

  // Circular progress ring calculation (radius = 28)
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (riskScore / 100) * circumference;

  return (
    <div 
      className="modal-overlay-light" 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(2, 6, 23, 0.78)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1140px',
          width: '98%',
          maxHeight: '94vh',
          overflowY: 'auto',
          backgroundColor: theme.bgModal,
          borderRadius: '24px',
          border: `1px solid ${isDarkTheme ? '#1e293b' : '#cbd5e1'}`,
          padding: '2rem 2.25rem',
          boxShadow: isDarkTheme 
            ? '0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(6, 182, 212, 0.08)' 
            : '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          color: theme.textMain,
          transition: 'all 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.4rem'
        }}
      >
        {/* TOP BAR: Category, Title & Actions */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', borderBottom: `1px solid ${theme.borderCard}`, paddingBottom: '1.15rem' }}>
          <div>
            <div style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: isDarkTheme ? '#38bdf8' : 'var(--primary-blue)',
              marginBottom: '3px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              flexWrap: 'wrap'
            }}>
              <span>CARDIOVASCULAR PROFILE &bull; DIGITAL TWIN</span>
              <span className="pulse-beacon-circle" style={{ background: '#10b981', width: 6, height: 6 }} />
              <span style={{ color: '#10b981', fontSize: '0.68rem', fontWeight: 700 }}>
                LIVE INGEST ACTIVE &bull; 2.2s PPG REFRESH
              </span>
            </div>

            <h1 style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: theme.textMain,
              margin: 0,
              letterSpacing: '-0.02em',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              flexWrap: 'wrap'
            }}>
              Digital twin overview
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                background: theme.badgeBg,
                color: theme.badgeText,
                border: `1px solid ${theme.borderCard}`
              }}>
                {patient.name} &bull; #{patient.id ? patient.id.replace('PT-', '984') : '9848068'}
              </span>
            </h1>
          </div>

          {/* Header Controls: Theme Switcher & Close */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Live Burst Test Button */}
            <button
              onClick={triggerExertionBurst}
              disabled={isSimulatingExertion}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: isSimulatingExertion ? '#f43f5e' : (isDarkTheme ? '#1e293b' : '#f1f5f9'),
                border: `1px solid ${isSimulatingExertion ? '#f43f5e' : theme.borderCard}`,
                color: isSimulatingExertion ? '#ffffff' : theme.textSub,
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: isSimulatingExertion ? 'default' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              title="Inject simulated physical exertion to test live telemetry responsiveness"
            >
              <Zap size={12} fill={isSimulatingExertion ? '#ffffff' : 'none'} color={isSimulatingExertion ? '#ffffff' : '#f59e0b'} />
              <span>{isSimulatingExertion ? 'Exertion Active (+15 bpm)' : 'Test Pulse Surge'}</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => setIsDarkTheme(!isDarkTheme)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                borderRadius: 'var(--radius-full)',
                background: theme.bgCard,
                border: `1px solid ${theme.borderCard}`,
                color: theme.textSub,
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Toggle Light / Dark theme"
            >
              {isDarkTheme ? <Sun size={13} color="#f59e0b" /> : <MoonIcon size={13} color="#0284c7" />}
              <span>{isDarkTheme ? 'Light view' : 'Dark view'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              style={{
                background: theme.bgCard,
                border: `1px solid ${theme.borderCard}`,
                borderRadius: '50%',
                width: 34,
                height: 34,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: theme.textMuted,
                transition: 'all 0.15s ease'
              }}
            >
              <X size={17} />
            </button>
          </div>
        </div>

        {/* MAIN BODY: 2-COLUMN SPLIT (60% 4 Cards Left, 40% 3D Twin Model Right) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.9fr',
          gap: '1.5rem',
          alignItems: 'stretch'
        }}>
          {/* LEFT: 2x2 Grid of 4 Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '1.25rem'
          }}>
            {/* CARD 1: Vital signs (LIVE TELEMETRY) */}
            <div 
              style={{
                backgroundColor: theme.bgCard,
                border: `1px solid ${activeHotspot === 'heart' || activeHotspot === 'aorta' ? '#38bdf8' : theme.borderCard}`,
                borderRadius: '18px',
                padding: '1.35rem 1.45rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1.1rem',
                boxShadow: activeHotspot === 'heart' ? '0 0 20px rgba(56, 189, 248, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={() => setActiveHotspot('heart')}
              onMouseLeave={() => setActiveHotspot(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    backgroundColor: theme.iconBg,
                    color: isBeating ? '#f43f5e' : theme.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transform: isBeating ? 'scale(1.22)' : 'scale(1)',
                    transition: 'all 0.18s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                  }}>
                    <Heart size={15} fill={isBeating ? '#f43f5e' : 'none'} />
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textMain }}>Vital signs</span>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: isDarkTheme ? '#064e3b' : '#ecfdf5',
                  color: isDarkTheme ? '#6ee7b7' : '#047857',
                  border: isDarkTheme ? '1px solid #059669' : '1px solid #a7f3d0',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span className="pulse-beacon-circle" style={{ background: '#10b981', width: 5, height: 5 }} />
                  Live &bull; {currentTime}
                </span>
              </div>

              {/* 2x2 Vitals Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>Heart rate</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                    <span style={{ 
                      fontSize: '1.65rem', 
                      fontWeight: 900, 
                      color: isBeating ? '#f43f5e' : theme.textMain, 
                      lineHeight: 1,
                      transition: 'color 0.2s ease'
                    }}>
                      {liveHR}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>bpm</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>Blood pressure</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                    <span style={{ 
                      fontSize: '1.35rem', 
                      fontWeight: 900, 
                      color: isBpStage2 ? '#ef4444' : (isBpStage1 ? '#f59e0b' : theme.textMain), 
                      lineHeight: 1 
                    }}>
                      {liveSys}/{liveDia}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>mmHg</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>Blood oxygen</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 900, color: theme.textMain, lineHeight: 1 }}>
                      {liveSpo2}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: theme.textMuted }}>%</span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>Telemetry Synced</div>
                  <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#10b981', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    {secondsSinceSync === 0 ? 'Just now (0s)' : `${secondsSinceSync}s ago`}
                  </div>
                </div>
              </div>

              {/* Dynamic Telemetry Waveform Indicator */}
              <div style={{
                background: isDarkTheme ? '#071224' : '#f1f5f9',
                borderRadius: '10px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                border: `1px solid ${theme.borderCard}`
              }}>
                <span style={{ color: theme.textMuted, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Radio size={12} color="#10b981" />
                  Rhythm: <strong style={{ color: theme.textMain }}>Normal Sinus (RSA)</strong>
                </span>
                <span style={{ color: theme.textMuted }}>
                  Resting baseline: <strong style={{ color: isDarkTheme ? '#38bdf8' : 'var(--primary-blue)' }}>{restingHR} bpm</strong>
                </span>
              </div>
            </div>

            {/* CARD 2: Health metrics (LIVE MOVEMENT TELEMETRY) */}
            <div 
              style={{
                backgroundColor: theme.bgCard,
                border: `1px solid ${activeHotspot === 'kinetic' ? '#10b981' : theme.borderCard}`,
                borderRadius: '18px',
                padding: '1.35rem 1.45rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '1rem',
                boxShadow: activeHotspot === 'kinetic' ? '0 0 20px rgba(16, 185, 129, 0.2)' : 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={() => setActiveHotspot('kinetic')}
              onMouseLeave={() => setActiveHotspot(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    backgroundColor: theme.iconBg,
                    color: theme.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Activity size={15} />
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textMain }}>Health metrics</span>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: theme.badgeBg,
                  color: theme.badgeText,
                  fontWeight: 600
                }}>
                  Continuous Daily Ingest
                </span>
              </div>

              {/* Rows: Steps, Active minutes, Sleep */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: theme.textSub }}>
                    <Footprints size={14} color={theme.iconColor} />
                    <span>Steps</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: theme.textMain }}>
                      {liveSteps.toLocaleString()}
                    </span>
                    {liveStepAdd > 0 && (
                      <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>+{liveStepAdd}</span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: theme.textSub }}>
                    <Zap size={14} color={theme.iconColor} />
                    <span>Active minutes</span>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: theme.textMain }}>{activeMinutes} min</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: theme.textSub }}>
                    <Moon size={14} color={theme.iconColor} />
                    <span>Sleep duration</span>
                  </div>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: theme.textMain }}>{sleepHours}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div style={{
                  width: '100%',
                  height: '6px',
                  borderRadius: '3px',
                  backgroundColor: theme.progressBg,
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${stepsPercent}%`,
                    height: '100%',
                    backgroundColor: theme.progressFill,
                    borderRadius: '3px',
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <div style={{ fontSize: '0.72rem', color: theme.textMuted, marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{stepsPercent}% of daily movement goal</span>
                  <span>Goal: {stepsGoal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* CARD 3: Cardiovascular health (CLINICALLY CALIBRATED ML GAUGE) */}
            <div style={{
              backgroundColor: theme.bgCard,
              border: `1px solid ${theme.borderCard}`,
              borderRadius: '18px',
              padding: '1.35rem 1.45rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.95rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    backgroundColor: theme.iconBg,
                    color: theme.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShieldCheck size={15} />
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textMain }}>Cardiovascular health</span>
                </div>
                <span style={{
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  background: theme.badgeBg,
                  color: theme.badgeText,
                  fontWeight: 600
                }}>
                  Digital Twin ML
                </span>
              </div>

              {/* Risk indicator & Circular Gauge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>Risk indicator</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: riskColor, marginTop: '2px' }}>
                    {riskLabel} &bull; {riskScore}/100
                  </div>
                  <div style={{ fontSize: '0.7rem', color: theme.textMuted, marginTop: '2px' }}>
                    {isBpStage2 ? 'Stage 2 HTN Alert' : isBpStage1 ? 'Stage 1 HTN Present' : 'Normotensive profile'}
                  </div>
                </div>

                {/* Circular Gauge */}
                <div style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="64" height="64" viewBox="0 0 64 64" style={{ transform: 'rotate(-90deg)' }}>
                    <circle 
                      cx="32" 
                      cy="32" 
                      r={radius} 
                      fill="none" 
                      stroke={theme.borderCard} 
                      strokeWidth="5" 
                    />
                    <circle 
                      cx="32" 
                      cy="32" 
                      r={radius} 
                      fill="none" 
                      stroke={riskColor} 
                      strokeWidth="5"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      style={{ transition: 'stroke-dashoffset 0.6s ease' }}
                    />
                  </svg>
                  <span style={{ position: 'absolute', fontSize: '1rem', fontWeight: 900, color: theme.textMain }}>
                    {riskScore}
                  </span>
                </div>
              </div>

              {/* Dynamic Checkmarks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: liveHR <= 90 ? (isDarkTheme ? '#a7f3d0' : '#047857') : '#f59e0b' }}>
                  {liveHR <= 90 ? <Check size={13} strokeWidth={3} /> : <AlertTriangle size={13} />}
                  <span>{liveHR <= 90 ? 'Resting heart rate in range' : 'Elevated resting pulse'}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: liveSys < 135 ? (isDarkTheme ? '#a7f3d0' : '#047857') : '#ef4444' }}>
                  {liveSys < 135 ? <Check size={13} strokeWidth={3} /> : <AlertTriangle size={13} />}
                  <span>{liveSys < 135 ? 'Blood pressure in range' : `${isBpStage2 ? 'Stage 2 HTN' : 'Stage 1 HTN'} excursion`}</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: stepsPercent >= 70 ? (isDarkTheme ? '#a7f3d0' : '#047857') : '#f59e0b' }}>
                  {stepsPercent >= 70 ? <Check size={13} strokeWidth={3} /> : <AlertTriangle size={13} />}
                  <span>{stepsPercent >= 70 ? 'Activity meeting weekly goal' : 'Activity below weekly goal'}</span>
                </div>
              </div>

              <div style={{ fontSize: '0.68rem', color: theme.textMuted, borderTop: `1px solid ${theme.borderCard}`, paddingTop: '6px' }}>
                Calibrated Digital Twin estimation based on continuous telemetry & EHR.
              </div>
            </div>

            {/* CARD 4: Daily performance (LIVE TELEMETRY STREAM & SPLINE) */}
            <div style={{
              backgroundColor: theme.bgCard,
              border: `1px solid ${theme.borderCard}`,
              borderRadius: '18px',
              padding: '1.35rem 1.45rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '0.65rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    backgroundColor: theme.iconBg,
                    color: theme.iconColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Heart size={15} />
                  </div>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: theme.textMain }}>Daily performance</span>
                </div>

                {/* Mode Selector Pill: Live Stream vs Today */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: isDarkTheme ? '#071224' : '#e2e8f0',
                  borderRadius: 'var(--radius-full)',
                  padding: '2px',
                  border: `1px solid ${theme.borderCard}`
                }}>
                  <button
                    onClick={() => setChartMode('stream')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: chartMode === 'stream' ? (isDarkTheme ? '#0284c7' : '#ffffff') : 'transparent',
                      color: chartMode === 'stream' ? (isDarkTheme ? '#ffffff' : '#0284c7') : theme.textMuted,
                      border: 'none',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px'
                    }}
                  >
                    <span className="pulse-beacon-circle" style={{ background: '#10b981', width: 4, height: 4 }} />
                    Live 60s
                  </button>
                  <button
                    onClick={() => setChartMode('today')}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-full)',
                      background: chartMode === 'today' ? (isDarkTheme ? '#0284c7' : '#ffffff') : 'transparent',
                      color: chartMode === 'today' ? (isDarkTheme ? '#ffffff' : '#0284c7') : theme.textMuted,
                      border: 'none',
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Today (24h)
                  </button>
                </div>
              </div>

              {/* Chart SVG with Live Ticking Endpoint */}
              <div style={{ width: '100%', position: 'relative' }}>
                <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
                  <defs>
                    <linearGradient id="modalHrGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.35" />
                      <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal Grid Lines */}
                  {[95, 80, 65, 50].map(val => (
                    <g key={val}>
                      <line x1={padX} y1={getPtY(val)} x2={chartW - padX} y2={getPtY(val)} stroke={theme.gridLine} strokeWidth="1" />
                      <text x={padX - 4} y={getPtY(val) + 3} fill={theme.textMuted} fontSize="7.5" textAnchor="end" fontFamily="var(--font-mono)">
                        {val}
                      </text>
                    </g>
                  ))}

                  {/* Area & Spline */}
                  {areaD && <path d={areaD} fill="url(#modalHrGrad)" />}
                  {curveD && <path d={curveD} fill="none" stroke="#f43f5e" strokeWidth="2.4" strokeLinecap="round" />}

                  {/* Data Points */}
                  {activeChartData.map((d, i) => {
                    const x = getPtX(i);
                    const y = getPtY(d.hr);
                    const isLast = i === activeChartData.length - 1;
                    const isHov = hoveredPoint === i;

                    return (
                      <g key={i}>
                        {isLast && (
                          <circle 
                            cx={x} 
                            cy={y} 
                            r={isBeating ? 9 : 6} 
                            fill="#f43f5e" 
                            opacity={isBeating ? 0.45 : 0.25} 
                            style={{ transition: 'all 0.18s ease' }}
                          />
                        )}
                        <circle 
                          cx={x} 
                          cy={y} 
                          r={isLast ? 4 : (isHov ? 4.5 : 2.5)} 
                          fill="#ffffff" 
                          stroke="#f43f5e" 
                          strokeWidth={isLast ? 2.5 : 1.5}
                          style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                          onMouseEnter={() => setHoveredPoint(i)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                        {/* Time Labels (sample every 2nd point if crowded) */}
                        {(i % 2 === 0 || isLast) && (
                          <text 
                            x={x} 
                            y={chartH - 2} 
                            fill={theme.textMuted} 
                            fontSize="7" 
                            textAnchor="middle"
                          >
                            {d.time}
                          </text>
                        )}

                        {/* Tooltip */}
                        {isHov && (
                          <g>
                            <rect x={x - 26} y={Math.max(2, y - 24)} width="52" height="18" rx="4" fill="#0f172a" />
                            <text x={x} y={Math.max(14, y - 12)} fill="#ffffff" fontSize="8.5" fontWeight="800" textAnchor="middle">
                              {d.hr} bpm
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>

              <div style={{ fontSize: '0.72rem', color: theme.textMuted }}>
                {chartMode === 'stream' 
                  ? <>Real-time rolling PPG window. Active beat: <strong style={{ color: isDarkTheme ? '#38bdf8' : 'var(--primary-blue)' }}>{liveHR} bpm</strong> (Sync #{packetCount}).</>
                  : <>Readings stayed between {minHR}–{maxHR} bpm today. Latest: <strong style={{ color: isDarkTheme ? '#38bdf8' : 'var(--primary-blue)' }}>{liveHR} bpm</strong>.</>
                }
              </div>
            </div>
          </div>

          {/* RIGHT: High-Definition 3D Anatomical Body Showcase with Live Interactive Hotspots */}
          <div style={{
            position: 'relative',
            borderRadius: '20px',
            background: theme.twinBg,
            border: `1px solid ${theme.borderCard}`,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            minHeight: '480px'
          }}>
            {/* Holographic Watermark Grid */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `radial-gradient(${isDarkTheme ? '#1e293b' : '#cbd5e1'} 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
              opacity: 0.35,
              pointerEvents: 'none'
            }} />

            {/* 3D Anatomical Body Render Image */}
            <img 
              src="/assets/digital-twin-anatomy.jpg" 
              alt="3D Anatomical Digital Twin"
              style={{
                maxHeight: '94%',
                maxWidth: '92%',
                objectFit: 'contain',
                filter: isDarkTheme ? 'drop-shadow(0 0 25px rgba(6, 182, 212, 0.25))' : 'drop-shadow(0 8px 24px rgba(15, 23, 42, 0.12))',
                userSelect: 'none',
                pointerEvents: 'none'
              }}
            />

            {/* Targeting Brackets */}
            <div style={{ position: 'absolute', top: '22%', left: '26%', width: 14, height: 14, borderTop: '2px solid #06b6d4', borderLeft: '2px solid #06b6d4', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '38%', right: '26%', width: 14, height: 14, borderBottom: '2px solid #06b6d4', borderRight: '2px solid #06b6d4', pointerEvents: 'none' }} />

            {/* Futuristic Laser Body Scanning Line */}
            <div className="body-scanner-line">
              <div className="scanner-glow-beam" />
              <div className="scanner-horizontal-line" />
            </div>

            {/* 1. Pulsating Glowing Heart Beacon on Chest (Beating Live with Heart Rate) */}
            <div 
              onClick={() => setActiveHotspot(activeHotspot === 'heart' ? null : 'heart')}
              style={{
                position: 'absolute',
                top: '29%',
                left: '50%',
                transform: `translate(-50%, -50%) scale(${isBeating ? 1.28 : 1})`,
                transition: 'transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(239, 68, 68, 0.8) 0%, rgba(239, 68, 68, 0.1) 75%)',
                border: '2px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isBeating ? '0 0 35px rgba(244, 63, 94, 0.95)' : '0 0 20px rgba(244, 63, 94, 0.6)',
                cursor: 'pointer',
                zIndex: 10
              }}
              title={`Heart: ${liveHR} bpm (Click to inspect)`}
            >
              <Heart 
                size={22} 
                color="#ffffff" 
                fill="#f43f5e" 
                style={{
                  transform: isBeating ? 'scale(1.2)' : 'scale(1)',
                  transition: 'transform 0.2s ease'
                }}
              />
            </div>

            {/* Live Interactive Hotspot Detail Callout Card */}
            {activeHotspot && (
              <div style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                right: '16px',
                background: isDarkTheme ? 'rgba(10, 22, 40, 0.94)' : 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${isDarkTheme ? '#38bdf8' : '#0284c7'}`,
                borderRadius: '12px',
                padding: '8px 12px',
                fontSize: '0.74rem',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 20
              }}>
                <div>
                  <strong style={{ color: isDarkTheme ? '#38bdf8' : '#0284c7' }}>
                    {activeHotspot === 'heart' ? 'Cardiac Hotspot' : activeHotspot === 'lungs' ? 'Pulmonary Capillaries' : activeHotspot === 'aorta' ? 'Systemic Arterial Tree' : 'Peripheral Kinetic Pacing'}
                  </strong>
                  <div style={{ color: theme.textSub, marginTop: '2px' }}>
                    {activeHotspot === 'heart' && `Current Rhythm: ${liveHR} bpm • Stroke volume stable`}
                    {activeHotspot === 'lungs' && `Oxygenation: ${liveSpo2}% SpO2 • Normal alveolar diffusion`}
                    {activeHotspot === 'aorta' && `Pressure: ${liveSys}/${liveDia} mmHg • MAP: ${Math.round((liveSys + 2 * liveDia) / 3)} mmHg`}
                    {activeHotspot === 'kinetic' && `Daily Ingest: ${liveSteps.toLocaleString()} steps • ${activeMinutes} active mins`}
                  </div>
                </div>
                <button
                  onClick={() => setActiveHotspot(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.textMuted,
                    cursor: 'pointer',
                    padding: '2px'
                  }}
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Live Telemetry Ingest Badge on Top Left */}
            <div style={{
              position: 'absolute',
              top: '14px',
              left: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              background: isDarkTheme ? 'rgba(10, 22, 40, 0.9)' : '#ffffff',
              border: `1px solid ${theme.borderCard}`,
              padding: '4px 11px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.72rem',
              fontWeight: 800,
              color: isDarkTheme ? '#38bdf8' : 'var(--primary-blue)',
              backdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
            }}>
              <span className="pulse-beacon-circle" style={{ background: '#10b981', width: 6, height: 6 }} />
              <span>Telemetry Ingest &bull; #{packetCount}</span>
            </div>

            {/* Live Signal Quality on Top Right */}
            <div style={{
              position: 'absolute',
              top: '14px',
              right: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              background: isDarkTheme ? 'rgba(10, 22, 40, 0.9)' : '#ffffff',
              border: `1px solid ${theme.borderCard}`,
              padding: '4px 9px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: '#10b981',
              backdropFilter: 'blur(8px)'
            }}>
              <Wifi size={11} color="#10b981" />
              <span>0% Loss &bull; BLE 5.3</span>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR: Close Twin & Open Care Protocol */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderTop: `1px solid ${theme.borderCard}`,
          paddingTop: '1.25rem',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}>
          <div style={{ fontSize: '0.75rem', color: theme.textMuted, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />
            <span>{patient.name} &bull; Continuous PPG Telemetry Synced &bull; Updated {currentTime} (Packet #{packetCount})</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* Close Twin Button */}
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.35rem',
                borderRadius: '12px',
                background: theme.bgCard,
                border: `1px solid ${theme.borderCard}`,
                color: theme.textMain,
                fontSize: '0.84rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <X size={15} /> Close Twin
            </button>

            {/* Open Care Protocol */}
            <button
              onClick={() => {
                onClose();
                if (onOpenCareAction) onOpenCareAction();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.55rem 1.45rem',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '0.84rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                transition: 'all 0.2s ease'
              }}
            >
              <ArrowUpRight size={15} /> Open Care Protocol
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
