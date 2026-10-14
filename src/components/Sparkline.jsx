import React from 'react';

export default function Sparkline({ data = [20, 30, 25, 40, 45, 50, 65], level = 'elevated', width = 120, height = 36 }) {
  if (!data || data.length === 0) return null;

  const validNums = data.filter(val => val != null && !isNaN(val));
  if (validNums.length === 0) return null;

  const min = Math.min(...validNums);
  const max = Math.max(...validNums);
  const range = max - min || 1;
  const padding = 4;
  const effectiveHeight = height - padding * 2;
  const effectiveWidth = width - padding * 2;
  const denom = Math.max(data.length - 1, 1);

  const getColor = () => {
    switch (level) {
      case 'critical': return '#ef4444';
      case 'elevated': return '#f59e0b';
      default: return '#10b981';
    }
  };

  const color = getColor();
  const gradientId = `spark-grad-${level}-${Math.random().toString(36).substr(2, 9)}`;

  // Break points into contiguous segments across null gaps
  const segments = [];
  let currentSegment = [];

  data.forEach((val, idx) => {
    if (val != null && !isNaN(val)) {
      const x = padding + (idx / denom) * effectiveWidth;
      const y = height - padding - ((val - min) / range) * effectiveHeight;
      currentSegment.push({ x, y });
    } else {
      if (currentSegment.length > 0) {
        segments.push(currentSegment);
        currentSegment = [];
      }
    }
  });
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  // Find last valid point
  const allPoints = segments.flat();
  const lastPoint = allPoints.length > 0 ? allPoints[allPoints.length - 1] : null;

  return (
    <svg width={width} height={height} className="sparkline-svg" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>

      {segments.map((seg, sIdx) => {
        if (seg.length >= 2) {
          const ptsStr = seg.map(p => `${p.x},${p.y}`).join(' ');
          const firstP = seg[0];
          const lastP = seg[seg.length - 1];
          const areaStr = `${firstP.x},${height} ${ptsStr} ${lastP.x},${height}`;
          return (
            <React.Fragment key={sIdx}>
              <polygon points={areaStr} fill={`url(#${gradientId})`} />
              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={ptsStr}
              />
            </React.Fragment>
          );
        } else if (seg.length === 1) {
          return (
            <circle
              key={sIdx}
              cx={seg[0].x}
              cy={seg[0].y}
              r="2.5"
              fill={color}
            />
          );
        }
        return null;
      })}

      {/* End point dot */}
      {lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="3"
          fill={color}
          stroke="#0b1528"
          strokeWidth="1.5"
        />
      )}
    </svg>
  );
}
