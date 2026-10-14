import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { getModelCard } from '../services/api';
import { getRiskTooltip } from '../utils/formatters';

export default function RiskForecastChart({ 
  trajectory = [], 
  twinState = null, 
  modelCard: propModelCard = null,
  patientName = 'Patient' 
}) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [fetchedModelCard, setFetchedModelCard] = useState(null);

  useEffect(() => {
    if (!propModelCard) {
      let isMounted = true;
      getModelCard().then(card => {
        if (isMounted) setFetchedModelCard(card);
      }).catch(() => {});
      return () => { isMounted = false; };
    }
  }, [propModelCard]);

  const modelCard = propModelCard || fetchedModelCard;
  const yellowCutoff = modelCard?.yellowCutoff ?? null;
  const redCutoff = modelCard?.redCutoff ?? null;

  const hasForwardCone = Array.isArray(twinState?.forwardCone) && twinState.forwardCone.length > 0;
  const scoreHistory = Array.isArray(twinState?.scoreHistory) ? twinState.scoreHistory : [];
  const hasScoreHistory = scoreHistory.length > 0;

  const currentZone = (twinState?.triageZone || '').toLowerCase();
  const isTodayGreen = currentZone === 'green';
  const coneEndP50 = hasForwardCone ? twinState.forwardCone[twinState.forwardCone.length - 1]?.p50 : null;
  const isGreenWithRedProjection = Boolean(isTodayGreen && redCutoff != null && coneEndP50 != null && coneEndP50 > redCutoff);

  // Build chart points from scoreHistory and forwardCone
  let chartPoints = [];

  const todayP50 = twinState?.p50 ?? (trajectory.find(t => t.day === 'Today')?.observed ?? null);
  const todayP10 = twinState?.p10 ?? todayP50;
  const todayP90 = twinState?.p90 ?? todayP50;

  if (hasScoreHistory) {
    chartPoints = scoreHistory.map(sh => ({
      day: `Day ${sh.day}`,
      observed: sh.p50,
      predicted: null,
      lowerCI: null,
      upperCI: null
    }));
  }

  if (todayP50 !== null) {
    chartPoints.push({
      day: 'Today',
      observed: hasScoreHistory ? todayP50 : null,
      predicted: todayP50,
      lowerCI: todayP10,
      upperCI: todayP90
    });
  }

  if (hasForwardCone) {
    twinState.forwardCone.forEach(fc => {
      chartPoints.push({
        day: `+${fc.day_ahead}d`,
        observed: null,
        predicted: fc.p50,
        lowerCI: fc.p10,
        upperCI: fc.p90,
        scenario: fc.scenario
      });
    });
  }

  if (chartPoints.length === 0) return null;

  // Dynamic Y-axis: 0 to max(cone p90, 0.15) rounded up, never fixed 0-1
  const coneP90s = hasForwardCone ? twinState.forwardCone.map(fc => fc.p90).filter(v => v != null) : [];
  let rawMax = Math.max(...coneP90s, 0.15);
  if (redCutoff != null && redCutoff > rawMax) {
    rawMax = redCutoff;
  }
  const yMax = Math.max(0.15, Math.ceil(rawMax * 10) / 10);

  const width = 640;
  const height = 240;
  const padding = { top: 25, right: 30, bottom: 40, left: 45 };

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const totalPoints = chartPoints.length;
  const getX = (index) => padding.left + (index / (Math.max(totalPoints - 1, 1))) * plotWidth;
  const getY = (val) => padding.top + (1 - (val / yMax)) * plotHeight;

  const todayIndex = chartPoints.findIndex(t => t.day === 'Today');

  // Select at most 8 evenly spaced x-axis labels (including Today, bounds) to prevent overlap
  const getVisibleXLabelIndices = () => {
    if (totalPoints <= 8) {
      return new Set(Array.from({ length: totalPoints }, (_, i) => i));
    }
    const selected = new Set();
    selected.add(0);
    selected.add(totalPoints - 1);
    if (todayIndex >= 0) {
      selected.add(todayIndex);
    }
    const maxLabels = 8;
    const step = (totalPoints - 1) / (maxLabels - 1);
    for (let k = 1; k < maxLabels - 1; k++) {
      const idx = Math.round(k * step);
      if (todayIndex >= 0 && Math.abs(idx - todayIndex) < 2) continue;
      selected.add(idx);
    }
    const sorted = Array.from(selected).sort((a, b) => a - b);
    if (sorted.length > 8) {
      const downsampled = new Set();
      downsampled.add(0);
      downsampled.add(totalPoints - 1);
      if (todayIndex >= 0) downsampled.add(todayIndex);
      const remainingSlots = 8 - downsampled.size;
      const candidates = sorted.filter(idx => !downsampled.has(idx));
      const candStep = (candidates.length - 1) / Math.max(1, remainingSlots - 1);
      for (let s = 0; s < remainingSlots; s++) {
        downsampled.add(candidates[Math.min(Math.round(s * candStep), candidates.length - 1)]);
      }
      return downsampled;
    }
    return selected;
  };

  const visibleXIndices = getVisibleXLabelIndices();

  // SVG Paths
  let observedPath = '';
  chartPoints.forEach((t, i) => {
    if (t.observed !== null) {
      const x = getX(i);
      const y = getY(t.observed);
      if (observedPath === '') {
        observedPath = `M ${x} ${y}`;
      } else {
        observedPath += ` L ${x} ${y}`;
      }
    }
  });

  let predictedPath = '';
  if (hasForwardCone) {
    chartPoints.forEach((t, i) => {
      if (t.predicted !== null) {
        const x = getX(i);
        const y = getY(t.predicted);
        if (predictedPath === '') {
          predictedPath = `M ${x} ${y}`;
        } else {
          predictedPath += ` L ${x} ${y}`;
        }
      }
    });
  }

  let ciUpperPoints = [];
  let ciLowerPoints = [];
  if (hasForwardCone) {
    chartPoints.forEach((t, i) => {
      if (t.upperCI !== null && t.lowerCI !== null) {
        const x = getX(i);
        ciUpperPoints.push(`${x},${getY(t.upperCI)}`);
        ciLowerPoints.unshift(`${x},${getY(t.lowerCI)}`);
      }
    });
  }
  const ciAreaPath = ciUpperPoints.length > 0 ? `M ${ciUpperPoints.join(' L ')} L ${ciLowerPoints.join(' L ')} Z` : '';

  // Grid tick values (4 steps)
  const yTicks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  return (
    <div className="clean-card">
      {/* Title & Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <TrendingUp size={16} color="var(--primary-blue)" /> 7-Day Cardiovascular Risk Trajectory & Forecast
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Projection assumes today's trend continues unchanged for 7 days. The trend is estimated from a few noisy days. Not a prediction, not validated.
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem' }}>
          {hasScoreHistory && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 14, height: 3, background: 'var(--primary-blue)', display: 'inline-block', borderRadius: 2 }} />
              <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Observed Data</span>
            </div>
          )}
          {hasForwardCone && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 14, height: 3, background: '#ef4444', display: 'inline-block', borderRadius: 2, borderTop: '2px dashed #ef4444' }} />
                <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Predicted (p50)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span style={{ width: 12, height: 10, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'inline-block', borderRadius: 2 }} />
                <span style={{ color: 'var(--text-muted)' }}>p10-p90 Uncertainty Band</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* SVG Chart Area */}
      <div style={{ position: 'relative', width: '100%', overflowX: 'auto', background: '#ffffff', borderRadius: 'var(--radius-md)', padding: '0.5rem' }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="ci-light-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(239, 68, 68, 0.25)" />
              <stop offset="100%" stopColor="rgba(245, 158, 11, 0.1)" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {yTicks.map((val, idx) => {
            const y = getY(val);
            return (
              <g key={idx}>
                <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#e2e8f0" strokeDasharray="3 3" />
                <text x={padding.left - 8} y={y + 4} fill="#94a3b8" fontSize="10" textAnchor="end" fontFamily="var(--font-mono)">
                  {(val * 100).toFixed(0)}%
                </text>
              </g>
            );
          })}

          {/* Yellow Cutoff Dashed Line */}
          {yellowCutoff != null && yellowCutoff <= yMax && (
            <g>
              <line 
                x1={padding.left} 
                y1={getY(yellowCutoff)} 
                x2={width - padding.right} 
                y2={getY(yellowCutoff)} 
                stroke="#f59e0b" 
                strokeDasharray="4 4" 
                strokeWidth="1.5" 
              />
              <text 
                x={width - padding.right} 
                y={getY(yellowCutoff) - 4} 
                fill="#d97706" 
                fontSize="9" 
                fontWeight="700" 
                textAnchor="end" 
                fontFamily="var(--font-mono)"
              >
                {`Yellow ${(yellowCutoff * 100).toFixed(1)}%`}
              </text>
            </g>
          )}

          {/* Red Cutoff Dashed Line */}
          {redCutoff != null && redCutoff <= yMax && (
            <g>
              <line 
                x1={padding.left} 
                y1={getY(redCutoff)} 
                x2={width - padding.right} 
                y2={getY(redCutoff)} 
                stroke="#ef4444" 
                strokeDasharray="4 4" 
                strokeWidth="1.5" 
              />
              <text 
                x={width - padding.right} 
                y={getY(redCutoff) - 4} 
                fill="#dc2626" 
                fontSize="9" 
                fontWeight="700" 
                textAnchor="end" 
                fontFamily="var(--font-mono)"
              >
                {`Red ${(redCutoff * 100).toFixed(1)}%`}
              </text>
            </g>
          )}

          {/* Today Milestone Line */}
          {todayIndex !== -1 && (
            <g>
              <line
                x1={getX(todayIndex)}
                y1={padding.top}
                x2={getX(todayIndex)}
                y2={height - padding.bottom}
                stroke="var(--primary-blue)"
                strokeDasharray="4 4"
                strokeWidth="1.5"
              />
              <rect
                x={getX(todayIndex) - 22}
                y={padding.top - 18}
                width={44}
                height={16}
                rx="3"
                fill="var(--primary-blue)"
              />
              <text
                x={getX(todayIndex)}
                y={padding.top - 6}
                fill="#ffffff"
                fontSize="9"
                fontWeight="700"
                textAnchor="middle"
                fontFamily="var(--font-mono)"
              >
                TODAY
              </text>
            </g>
          )}

          {/* Projection only message if green with red projection */}
          {isGreenWithRedProjection && (
            <text
              data-testid="projection-green-svg-text"
              x={width - padding.right}
              y={padding.top - 8}
              fill="#059669"
              fontSize="9.5"
              fontWeight="700"
              textAnchor="end"
              fontFamily="var(--font-mono)"
            >
              Projection only: today's zone is Green.
            </text>
          )}

          {/* Confidence Interval Band */}
          {ciAreaPath && (
            <path
              data-testid="forecast-cone"
              d={ciAreaPath}
              fill="url(#ci-light-gradient)"
              stroke="rgba(239, 68, 68, 0.4)"
              strokeWidth="1"
              strokeDasharray={isGreenWithRedProjection ? "6 4" : "none"}
            />
          )}

          {/* Observed Line */}
          {observedPath && (
            <path d={observedPath} fill="none" stroke="var(--primary-blue)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}

          {/* Predicted Line */}
          {predictedPath && (
            <path
              data-testid="forecast-predicted-line"
              d={predictedPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeDasharray={isGreenWithRedProjection ? "6 4" : "5 4"}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Data Points */}
          {chartPoints.map((t, i) => {
            const x = getX(i);
            const isToday = i === todayIndex;
            const val = t.observed !== null ? t.observed : t.predicted;
            if (val === null) return null;
            const y = getY(val);
            const isPredicted = t.predicted !== null && !isToday;

            return (
              <g
                key={i}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredPoint({ ...t, index: i, x, y })}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={isToday ? 5.5 : 3.5}
                  fill={isToday ? 'var(--primary-blue)' : isPredicted ? '#ef4444' : 'var(--primary-blue)'}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
                {visibleXIndices.has(i) && (
                  <text
                    x={x}
                    y={height - padding.bottom + 18}
                    fill={isToday ? 'var(--primary-blue)' : '#64748b'}
                    fontSize="9.5"
                    fontWeight={isToday ? '700' : '500'}
                    textAnchor="middle"
                    fontFamily="var(--font-mono)"
                  >
                    {t.day}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(hoveredPoint.x, width - 180)}px`,
              top: `${Math.max(10, hoveredPoint.y - 70)}px`,
              background: '#ffffff',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.4rem 0.65rem',
              boxShadow: 'var(--shadow-modal)',
              pointerEvents: 'none',
              zIndex: 40,
              fontSize: '0.75rem',
              minWidth: '150px'
            }}
          >
            <div style={{ fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.2rem', marginBottom: '0.25rem' }}>
              {hoveredPoint.day} {hoveredPoint.day === 'Today' ? '(Current)' : ''}
            </div>
            {hoveredPoint.observed !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--primary-blue)', gap: '0.5rem' }}>
                <span>Observed:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {hoveredPoint.observed > 0.50 ? 'over 50% (approx.)' : `~${Math.round(hoveredPoint.observed * 100)}%`}
                </span>
              </div>
            )}
            {hoveredPoint.predicted !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', gap: '0.5rem' }}>
                <span>Predicted:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                  {hoveredPoint.predicted > 0.50 ? 'over 50% (approx.)' : `~${Math.round(hoveredPoint.predicted * 100)}%`}
                </span>
              </div>
            )}
            {getRiskTooltip(Math.max(hoveredPoint.observed ?? 0, hoveredPoint.predicted ?? 0), modelCard) && (
              <div style={{ marginTop: '0.35rem', paddingTop: '0.3rem', borderTop: '1px solid #f1f5f9', fontSize: '0.66rem', color: '#64748b', lineHeight: 1.35 }}>
                {getRiskTooltip(Math.max(hoveredPoint.observed ?? 0, hoveredPoint.predicted ?? 0), modelCard)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Projection only note if green with red projection */}
      {isGreenWithRedProjection && (
        <div
          data-testid="projection-green-line"
          style={{
            marginTop: '0.65rem',
            padding: '0.45rem 0.75rem',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            borderRadius: 'var(--radius-sm)',
            color: '#065f46',
            fontSize: '0.78rem',
            fontWeight: 600
          }}
        >
          Projection only: today's zone is Green.
        </div>
      )}

      {/* Caption */}
      <div
        className="forecast-caption"
        style={{
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          lineHeight: 1.45
        }}
      >
        Projection assumes today's trend continues unchanged for 7 days. The trend is estimated from a few noisy days. Not a prediction, not validated.
      </div>
    </div>
  );
}
