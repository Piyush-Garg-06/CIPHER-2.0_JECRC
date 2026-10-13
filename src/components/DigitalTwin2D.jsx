import React, { useState } from 'react';
import { 
  Heart, 
  Brain, 
  Wind, 
  Activity, 
  Zap, 
  Pill, 
  Watch, 
  ArrowUpRight, 
  Radio, 
  Droplet,
  Layers,
  Sparkles
} from 'lucide-react';
import OrganDetailPanel from './OrganDetailPanel';

export default function DigitalTwin2D({ 
  patient, 
  onOpenRealTimeModal, 
  onOpenCardioReport, 
  onSelectCareAction 
}) {
  const [activeOrgan, setActiveOrgan] = useState('heart');
  const [hoveredOrgan, setHoveredOrgan] = useState(null);

  const heartDuration = Math.max(0.4, 60 / (patient.vitals.heartRate || 75));

  const hotspots = [
    {
      id: 'brain',
      label: 'Autonomic Tone',
      icon: Brain,
      top: '7%',
      left: '50%',
      color: '#c084fc',
      status: patient.hotspots.brain?.status || 'stable'
    },
    {
      id: 'lungs',
      label: 'Respiratory',
      icon: Wind,
      top: '24%',
      left: '39%',
      color: '#38bdf8',
      status: patient.hotspots.lungs?.status || 'stable'
    },
    {
      id: 'heart',
      label: 'Cardiovascular Core',
      icon: Heart,
      top: '28%',
      left: '54%',
      color: '#ef4444',
      status: patient.hotspots.heart?.status || 'elevated',
      isHeart: true
    },
    {
      id: 'medication',
      label: 'Metabolic & Rx',
      icon: Pill,
      top: '39%',
      left: '38%',
      color: '#34d399',
      status: patient.hotspots.medication?.status || 'stable'
    },
    {
      id: 'vascular',
      label: 'Vascular Hemodynamics',
      icon: Activity,
      top: '48%',
      left: '51%',
      color: '#fbbf24',
      status: patient.hotspots.vascular?.status || 'elevated'
    },
    {
      id: 'activity',
      label: 'Mobility & Exertion',
      icon: Zap,
      top: '75%',
      left: '42%',
      color: '#60a5fa',
      status: patient.hotspots.activity?.status || 'elevated'
    }
  ];

  return (
    <div className="twin-hero-card" style={{ '--heart-duration': `${heartDuration}s` }}>
      {/* Top Section matching Screenshot 1: "Real Time Data Monitoring" & Apple Watch Pill with Arrow Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 20 }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff' }}>
            Real Time Data Monitoring
          </h2>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Cardiovascular Digital Twin Core Telemetry
          </div>
        </div>

        {/* Apple Watch Pill & Circular Expanding Radar Beacon Button (matching reference) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div 
            className="realtime-pill-btn"
            onClick={onOpenRealTimeModal}
          >
            <Watch size={15} color="var(--accent-cyan)" />
            <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>Apple Watch</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>8 data types</span>
          </div>

          <div
            className="beacon-circle-btn"
            onClick={onOpenRealTimeModal}
            title="Open Real Time Data Monitoring View"
          >
            <ArrowUpRight size={18} />
          </div>
        </div>
      </div>

      {/* Vitals HUD Overlay above Body (matching reference: Blood pressure 130/85 mmHg, Resting Heart Rate 65 bpm) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2.5rem',
        margin: '0.85rem 0',
        zIndex: 20
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fda4af' }} /> Blood pressure
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
            {patient.vitals.bloodPressure} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>mmHg</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--risk-stable)' }} /> Resting Heart Rate
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: '#fff' }}>
            {patient.vitals.restingHR || 65} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>bpm</span>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-cyan)' }} /> rMSSD HRV
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, fontFamily: 'var(--font-mono)', color: patient.vitals.hrvChange7d < 0 ? 'var(--risk-elevated)' : '#fff' }}>
            {patient.vitals.hrv} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>ms</span>
          </div>
        </div>
      </div>

      {/* Center 2D Anatomy Canvas */}
      <div className="twin-body-container">
        {/* Holographic glowing pulse rings behind heart */}
        <div style={{
          position: 'absolute',
          top: '28%',
          left: '54%',
          transform: 'translate(-50%, -50%)',
          width: '140px',
          height: '140px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(245, 158, 11, 0.2) 40%, transparent 70%)',
          filter: 'blur(10px)',
          pointerEvents: 'none',
          zIndex: 2,
          animation: 'heart-thump var(--heart-duration, 0.73s) infinite ease-in-out'
        }} />

        {/* Anatomical Human Body Graphic */}
        <img
          src="/assets/human-anatomy.png"
          alt="Anatomical 2D Digital Twin"
          className="twin-anatomy-img"
        />

        {/* Interactive Hotspots */}
        {hotspots.map((hotspot) => {
          const Icon = hotspot.icon;
          const isActive = activeOrgan === hotspot.id;
          const isHovered = hoveredOrgan === hotspot.id;

          return (
            <div
              key={hotspot.id}
              className={`body-hotspot ${hotspot.isHeart ? 'heart-hotspot' : ''} ${isActive ? 'active' : ''}`}
              style={{ top: hotspot.top, left: hotspot.left }}
              onClick={() => {
                setActiveOrgan(hotspot.id);
                if (hotspot.id === 'heart' && onOpenCardioReport) {
                  // also allow opening cardio report or contextual drawer
                }
              }}
              onMouseEnter={() => setHoveredOrgan(hotspot.id)}
              onMouseLeave={() => setHoveredOrgan(null)}
            >
              <div className="hotspot-ring" style={{ color: hotspot.color }} />

              <div className={`hotspot-beacon ${hotspot.status}`}>
                <Icon size={16} />
              </div>

              {(isHovered || isActive) && (
                <div style={{
                  position: 'absolute',
                  left: 'calc(100% + 10px)',
                  whiteSpace: 'nowrap',
                  background: 'rgba(11, 18, 32, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(0, 210, 255, 0.4)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: '#fff',
                  boxShadow: '0 0 15px rgba(0, 210, 255, 0.3)',
                  pointerEvents: 'none',
                  zIndex: 30
                }}>
                  {hotspot.label}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating Organ Detail Drawer if organ is selected */}
      {activeOrgan && patient.hotspots[activeOrgan] && (
        <OrganDetailPanel
          activeOrgan={activeOrgan}
          organData={patient.hotspots[activeOrgan]}
          patient={patient}
          onClose={() => setActiveOrgan(null)}
          onSelectCareAction={onSelectCareAction}
        />
      )}

      {/* Bottom Hint */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', zIndex: 10, marginTop: '0.5rem' }}>
        <span>Click anatomical beacon to inspect biometric subsystem</span>
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
          Wearable Telemetry Stream Active (DEMO)
        </span>
      </div>
    </div>
  );
}
