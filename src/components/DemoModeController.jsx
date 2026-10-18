import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Sparkles 
} from 'lucide-react';
import { DEMO_SIMULATION_STEPS } from '../services/patientData';

export default function DemoModeController({ 
  currentStepIndex, 
  onStepChange, 
  isPlaying, 
  onTogglePlay, 
  onReset 
}) {
  const [speed, setSpeed] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const steps = DEMO_SIMULATION_STEPS;
  const activeStep = steps[currentStepIndex] || steps[0];

  useEffect(() => {
    let timer;
    if (isPlaying) {
      const intervalMs = 3500 / speed;
      timer = setInterval(() => {
        if (currentStepIndex < steps.length - 1) {
          onStepChange(currentStepIndex + 1);
        } else {
          onTogglePlay(false);
        }
      }, intervalMs);
    }
    return () => clearInterval(timer);
  }, [isPlaying, currentStepIndex, steps.length, onStepChange, onTogglePlay, speed]);

  const progressPercent = (currentStepIndex / (steps.length - 1)) * 100;

  return (
    <div className="bottom-player-bar-light">
      {/* Left Play / Pause & Controls (matching reference) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <button
          onClick={() => onTogglePlay(!isPlaying)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 'var(--radius-sm)',
            background: isPlaying ? '#0284c7' : '#10b981',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transition: 'all var(--transition)'
          }}
          title={isPlaying ? 'Pause Simulation' : 'Play 14-Day Simulation'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} fill="#fff" />}
        </button>

        <button
          onClick={() => onStepChange(Math.max(0, currentStepIndex - 1))}
          disabled={currentStepIndex === 0}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentStepIndex === 0 ? '#cbd5e1' : '#64748b',
            cursor: currentStepIndex === 0 ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <SkipBack size={15} />
        </button>

        <button
          onClick={() => onStepChange(Math.min(steps.length - 1, currentStepIndex + 1))}
          disabled={currentStepIndex === steps.length - 1}
          style={{
            background: 'transparent',
            border: 'none',
            color: currentStepIndex === steps.length - 1 ? '#cbd5e1' : '#64748b',
            cursor: currentStepIndex === steps.length - 1 ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          <SkipForward size={15} />
        </button>

        <button
          onClick={onReset}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Reset Simulation"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      {/* Center Scrubber Track with Milestones */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        <div 
          className="player-scrubber-track-light"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickPos = (e.clientX - rect.left) / rect.width;
            const targetStep = Math.round(clickPos * (steps.length - 1));
            onStepChange(targetStep);
          }}
        >
          <div className="player-scrubber-fill-light" style={{ width: `${progressPercent}%` }}>
            <div className="player-scrubber-pin-light" />
          </div>
        </div>

        {/* Milestone Labels */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontFamily: 'var(--font-mono)' }}>
          {steps.map((s, idx) => (
            <span
              key={s.stepIndex}
              onClick={() => onStepChange(idx)}
              style={{
                cursor: 'pointer',
                color: idx === currentStepIndex ? '#0f172a' : idx < currentStepIndex ? '#0284c7' : '#94a3b8',
                fontWeight: idx === currentStepIndex ? 700 : 500
              }}
            >
              {s.dayLabel} {idx === currentStepIndex ? `• ${s.title}` : ''}
            </span>
          ))}
        </div>
      </div>

      {/* Right Controls: Speed & Sound */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <button
          onClick={() => setSpeed(speed === 1.0 ? 2.0 : 1.0)}
          style={{
            background: '#f1f5f9',
            border: '1px solid #e2e8f0',
            borderRadius: 'var(--radius-sm)',
            padding: '0.2rem 0.55rem',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: '#0f172a',
            cursor: 'pointer'
          }}
        >
          {speed.toFixed(1)}x
        </button>

        <button
          onClick={() => setIsMuted(!isMuted)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center'
          }}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    </div>
  );
}
