import React, { useEffect, useRef } from 'react';

export default function ECGWaveform({ bpm = 82, riskLevel = 'elevated', height = 64 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 300);
    let h = (canvas.height = height);

    const handleResize = () => {
      if (canvas && canvas.parentElement) {
        width = canvas.width = canvas.parentElement.clientWidth;
        h = canvas.height = height;
      }
    };
    window.addEventListener('resize', handleResize);

    const points = [];
    const maxPoints = Math.floor(width / 2);
    for (let i = 0; i < maxPoints; i++) {
      points.push(h / 2);
    }

    let phase = 0;
    // Speed proportional to BPM
    const speed = (bpm / 60) * 0.08;

    const getColor = () => {
      switch (riskLevel) {
        case 'critical': return '#ef4444';
        case 'elevated': return '#f59e0b';
        default: return '#00d2ff';
      }
    };

    const draw = () => {
      phase += speed;
      const cycle = phase % (Math.PI * 2);
      let yOffset = 0;

      // ECG P-Q-R-S-T synthetic mathematical waveform
      if (cycle > 0.8 && cycle < 1.1) {
        // P Wave
        yOffset = Math.sin((cycle - 0.8) / 0.3 * Math.PI) * (h * 0.12);
      } else if (cycle >= 1.25 && cycle < 1.35) {
        // Q dip
        yOffset = -Math.sin((cycle - 1.25) / 0.1 * Math.PI) * (h * 0.15);
      } else if (cycle >= 1.35 && cycle < 1.5) {
        // R peak (tall positive spike)
        yOffset = Math.sin((cycle - 1.35) / 0.15 * Math.PI) * (h * 0.42);
      } else if (cycle >= 1.5 && cycle < 1.62) {
        // S dip
        yOffset = -Math.sin((cycle - 1.5) / 0.12 * Math.PI) * (h * 0.22);
      } else if (cycle >= 1.8 && cycle < 2.3) {
        // T wave
        yOffset = Math.sin((cycle - 1.8) / 0.5 * Math.PI) * (h * 0.18);
      }

      const nextVal = h / 2 - yOffset + (Math.random() - 0.5) * 1.5;
      points.push(nextVal);
      if (points.length > maxPoints) {
        points.shift();
      }

      ctx.clearRect(0, 0, width, h);

      // Grid background lines
      ctx.strokeStyle = 'rgba(0, 210, 255, 0.05)';
      ctx.lineWidth = 1;
      const gridSize = 16;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // ECG Wave line
      const strokeColor = getColor();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = strokeColor;
      ctx.shadowBlur = 8;

      ctx.beginPath();
      for (let i = 0; i < points.length; i++) {
        const x = (i / (maxPoints - 1)) * width;
        const y = points[i];
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Leading pulse head point
      const lastX = width;
      const lastY = points[points.length - 1];
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx.fill();

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [bpm, riskLevel, height]);

  return (
    <div className="ecg-canvas-wrap" style={{ height }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
      <div style={{
        position: 'absolute',
        bottom: '4px',
        right: '8px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.65rem',
        color: 'var(--text-muted)',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
        <span>LEAD II • {bpm} BPM</span>
      </div>
    </div>
  );
}
