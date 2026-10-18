import React from 'react';

export default function Sparkline({ data = [20, 30, 25, 40, 45, 50, 65], level = 'elevated', width = 120, height = 36 }) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;
  const effectiveHeight = height - padding * 2;
  const effectiveWidth = width - padding * 2;

  const points = data.map((val, idx) => {
    const x = padding + (idx / (data.length - 1)) * effectiveWidth;
    const y = height - padding - ((val - min) / range) * effectiveHeight;
    return `${x},${y}`;
  }).join(' ');

  // Gradient ID
  const gradientId = `spark-grad-${level}-${Math.random().toString(36).substr(2, 9)}`;

  const getColor = () => {
    switch (level) {
      case 'critical': return '#ef4444';
      case 'elevated': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const color = getColor();

  // Area points for filled gradient
  const firstPoint = points.split(' ')[0];
  const lastPoint = points.split(' ')[points.split(' ').length - 1];
  const areaPoints = `${firstPoint.split(',')[0]},${height} ${points} ${lastPoint.split(',')[0]},${height}`;

  return (
    <svg width={width} height={height} className="sparkline-svg" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {/* End point dot */}
      {lastPoint && (
        <circle
          cx={lastPoint.split(',')[0]}
          cy={lastPoint.split(',')[1]}
          r="3"
          fill={color}
          stroke="#0b1528"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
