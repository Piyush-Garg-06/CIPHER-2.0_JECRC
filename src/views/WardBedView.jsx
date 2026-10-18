import React, { useState } from 'react';
import { 
  Building2, 
  Activity, 
  Search, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import HospitalBedCard from '../components/HospitalBedCard';

export default function WardBedView({ patients = [], isLive = false, onSelectPatient }) {
  const [filter, setFilter] = useState('all'); // 'all' | 'red' | 'yellow' | 'watch' | 'green' | 'not_calibrated' | 'stale'
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // In offline mode, use defaultBedData with isSimulated: true on each entry
  const defaultBedData = [
    {
      id: "PT-8092",
      name: "Rahul Sharma",
      age: 52,
      gender: "Male",
      riskLevel: "elevated",
      riskScore: 0.0858,
      riskPercentage: 68,
      isSimulated: true,
      vitals: { heartRate: 82, restingHR: 76, hrv: 42, bloodPressure: "138/88", spo2: 97, dailySteps: 3420 }
    },
    {
      id: "PT-4421",
      name: "Eleanor Vance",
      age: 67,
      gender: "Female",
      riskLevel: "critical",
      riskScore: 0.28,
      riskPercentage: 84,
      isSimulated: true,
      vitals: { heartRate: 104, restingHR: 94, hrv: 22, bloodPressure: "156/96", spo2: 94, dailySteps: 1200 }
    },
    {
      id: "PT-1109",
      name: "David Miller",
      age: 44,
      gender: "Male",
      riskLevel: "stable",
      riskScore: 0.02,
      riskPercentage: 12,
      isSimulated: true,
      vitals: { heartRate: 64, restingHR: 58, hrv: 68, bloodPressure: "118/76", spo2: 99, dailySteps: 8740 }
    },
    {
      id: "PT-6632",
      name: "Aisha Patel",
      age: 58,
      gender: "Female",
      riskLevel: "elevated",
      riskScore: 0.06,
      riskPercentage: 54,
      isSimulated: true,
      vitals: { heartRate: 78, restingHR: 72, hrv: 38, bloodPressure: "132/84", spo2: 98, dailySteps: 4100 }
    },
    {
      id: "PT-9938",
      name: "Marcus Thorne",
      age: 61,
      gender: "Male",
      riskLevel: "stable",
      riskScore: 0.02,
      riskPercentage: 19,
      isSimulated: true,
      vitals: { heartRate: 68, restingHR: 62, hrv: 61, bloodPressure: "122/80", spo2: 98, dailySteps: 9200 }
    },
    {
      id: "PT-8006",
      name: "Vikram Singhania",
      age: 63,
      gender: "Male",
      riskLevel: "critical",
      riskScore: 0.35,
      riskPercentage: 88,
      isSimulated: true,
      vitals: { heartRate: 108, restingHR: 98, hrv: 18, bloodPressure: "162/98", spo2: 93, dailySteps: 850 }
    },
    {
      id: "PT-8007",
      name: "Anita Desai",
      age: 49,
      gender: "Female",
      riskLevel: "elevated",
      riskScore: 0.07,
      riskPercentage: 62,
      isSimulated: true,
      vitals: { heartRate: 84, restingHR: 78, hrv: 44, bloodPressure: "134/86", spo2: 97, dailySteps: 3900 }
    },
    {
      id: "PT-8008",
      name: "Sunita Nair",
      age: 55,
      gender: "Female",
      riskLevel: "stable",
      riskScore: 0.03,
      riskPercentage: 16,
      isSimulated: true,
      vitals: { heartRate: 66, restingHR: 60, hrv: 65, bloodPressure: "120/78", spo2: 99, dailySteps: 8100 }
    }
  ];

  // In live mode, build from live patients only. In offline mode, use defaultBedData.
  const sourcePatients = isLive ? patients : (patients.length > 0 ? patients : defaultBedData);

  function getSeverityRank(p) {
    const zone = (p.twinState?.triageZone || p.riskLevel || '').toLowerCase();
    const isWatch = Boolean(p.twinState?.watch || p.watch);
    if (zone === 'critical' || zone === 'red') return 0;
    if (zone === 'elevated' || zone === 'yellow') return 1;
    if (isWatch) return 2;
    if (zone === 'stable' || zone === 'green') return 3;
    return 4; // not_calibrated or unknown
  }

  // Sorted by severity: red (0), yellow (1), watch (2), green (3), not_calibrated (4)
  const sortedPatients = [...sourcePatients].sort((a, b) => getSeverityRank(a) - getSeverityRank(b));

  // Compute counts from FULL live list
  const redCount = sourcePatients.filter(p => {
    const z = (p.twinState?.triageZone || p.riskLevel || '').toLowerCase();
    return z === 'critical' || z === 'red';
  }).length;

  const yellowCount = sourcePatients.filter(p => {
    const z = (p.twinState?.triageZone || p.riskLevel || '').toLowerCase();
    return z === 'elevated' || z === 'yellow';
  }).length;

  const watchCount = sourcePatients.filter(p => {
    const z = (p.twinState?.triageZone || p.riskLevel || '').toLowerCase();
    const isW = Boolean(p.twinState?.watch || p.watch);
    return isW && z !== 'critical' && z !== 'red' && z !== 'elevated' && z !== 'yellow';
  }).length;

  const greenCount = sourcePatients.filter(p => {
    const z = (p.twinState?.triageZone || p.riskLevel || '').toLowerCase();
    const isW = Boolean(p.twinState?.watch || p.watch);
    return (z === 'stable' || z === 'green') && !isW;
  }).length;

  const notCalibratedCount = sourcePatients.filter(p => {
    const z = (p.twinState?.triageZone || p.riskLevel || '').toLowerCase();
    return z === 'not_calibrated' || !z;
  }).length;

  const staleCount = sourcePatients.filter(p => {
    return Boolean(p.twinState?.staleData || p.staleData);
  }).length;

  // Filter beds
  const filteredBeds = sortedPatients.filter(p => {
    const z = (p.twinState?.triageZone || p.riskLevel || '').toLowerCase();
    const isW = Boolean(p.twinState?.watch || p.watch);
    const isSt = Boolean(p.twinState?.staleData || p.staleData);

    let matchesFilter = true;
    if (filter === 'red') matchesFilter = (z === 'critical' || z === 'red');
    else if (filter === 'yellow') matchesFilter = (z === 'elevated' || z === 'yellow');
    else if (filter === 'watch') matchesFilter = isW;
    else if (filter === 'green') matchesFilter = (z === 'stable' || z === 'green');
    else if (filter === 'not_calibrated') matchesFilter = (z === 'not_calibrated');
    else if (filter === 'stale') matchesFilter = isSt;

    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // 8 per page pagination
  const pageSize = 8;
  const totalPages = Math.ceil(filteredBeds.length / pageSize) || 1;
  const validCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedBeds = filteredBeds.slice((validCurrentPage - 1) * pageSize, validCurrentPage * pageSize);

  const formattedDate = new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' });

  return (
    <div className="page-container" style={{ maxWidth: '1600px' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Post-discharge remote monitoring
            </h1>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              background: '#0f172a',
              color: '#ffffff',
              letterSpacing: '0.04em'
            }}>
              Post-discharge remote monitoring
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Daily wearable summaries &bull; Select any patient to inspect individual Digital Twin & Telemetry
          </p>
        </div>

        {/* Filter Chips & Search Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search patient..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '0.45rem 0.85rem 0.45rem 2rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-main)',
                fontSize: '0.8rem',
                outline: 'none',
                width: '180px'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card-hover)', borderRadius: 'var(--radius-md)', padding: '2px', border: '1px solid var(--border-light)', flexWrap: 'wrap' }}>
            <button
              onClick={() => { setFilter('all'); setCurrentPage(1); }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'all' ? 'var(--bg-card)' : 'transparent',
                fontWeight: filter === 'all' ? 700 : 500,
                fontSize: '0.74rem',
                color: filter === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              All ({sourcePatients.length})
            </button>
            <button
              onClick={() => { setFilter('red'); setCurrentPage(1); }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'red' ? '#ef4444' : 'transparent',
                fontWeight: filter === 'red' ? 700 : 500,
                fontSize: '0.74rem',
                color: filter === 'red' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Red ({redCount})
            </button>
            <button
              onClick={() => { setFilter('yellow'); setCurrentPage(1); }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'yellow' ? '#f59e0b' : 'transparent',
                fontWeight: filter === 'yellow' ? 700 : 500,
                fontSize: '0.74rem',
                color: filter === 'yellow' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Yellow ({yellowCount})
            </button>
            <button
              onClick={() => { setFilter('watch'); setCurrentPage(1); }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'watch' ? '#0284c7' : 'transparent',
                fontWeight: filter === 'watch' ? 700 : 500,
                fontSize: '0.74rem',
                color: filter === 'watch' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Watch ({watchCount})
            </button>
            <button
              onClick={() => { setFilter('green'); setCurrentPage(1); }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'green' ? '#10b981' : 'transparent',
                fontWeight: filter === 'green' ? 700 : 500,
                fontSize: '0.74rem',
                color: filter === 'green' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Green ({greenCount})
            </button>
            <button
              onClick={() => { setFilter('not_calibrated'); setCurrentPage(1); }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'not_calibrated' ? '#64748b' : 'transparent',
                fontWeight: filter === 'not_calibrated' ? 700 : 500,
                fontSize: '0.74rem',
                color: filter === 'not_calibrated' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Not calibrated ({notCalibratedCount})
            </button>
            <button
              onClick={() => { setFilter('stale'); setCurrentPage(1); }}
              style={{
                padding: '0.35rem 0.65rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: filter === 'stale' ? '#991b1b' : 'transparent',
                fontWeight: filter === 'stale' ? 700 : 500,
                fontSize: '0.74rem',
                color: filter === 'stale' ? '#ffffff' : 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              Stale ({staleCount})
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout: Left Section + 2x4 Patient Bed Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: '1.25rem',
        alignItems: 'stretch'
      }}>
        {/* LEFT SECTION */}
        <div style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRadius: '18px',
          padding: '1.5rem 1.25rem',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div>
            {/* Dynamic Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.15)',
                padding: '0.4rem 0.65rem',
                borderRadius: '8px',
                fontFamily: 'var(--font-mono)',
                fontWeight: 800,
                fontSize: '0.9rem',
                letterSpacing: '0.05em'
              }}>
                {formattedDate}
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#93c5fd', fontWeight: 600 }}>Active Cohort</div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>Remote Monitoring</div>
              </div>
            </div>

            {/* Physician Info (ONLY in offline mode) */}
            {!isLive && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '0.85rem',
                marginBottom: '1.25rem',
                border: '1px solid rgba(255, 255, 255, 0.08)'
              }}>
                <div style={{ fontSize: '0.68rem', color: '#fbcfe8', textTransform: 'uppercase', fontWeight: 700 }}>
                  Attending Physician (DEMO)
                </div>
                <div style={{ fontSize: '0.95rem', fontWeight: 800, marginTop: '2px' }}>
                  Dr. Sarah Chen, MD
                </div>
                <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                  Chief of Clinical Cardiology
                </div>
              </div>
            )}

            {/* Cohort Breakdown Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginBottom: '1.25rem' }}>
              <div style={{
                background: 'rgba(0, 0, 0, 0.25)',
                borderRadius: '10px',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Total Patients</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>{sourcePatients.length}</span>
              </div>

              <div style={{
                background: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '10px',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#fca5a5' }}>Red Alert</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#f87171' }}>{redCount}</span>
              </div>

              <div style={{
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '10px',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#fde68a' }}>Yellow Elevated</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#fbbf24' }}>{yellowCount}</span>
              </div>

              <div style={{
                background: 'rgba(2, 132, 199, 0.2)',
                border: '1px solid rgba(2, 132, 199, 0.4)',
                borderRadius: '10px',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#bae6fd' }}>Watch Flagged</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#38bdf8' }}>{watchCount}</span>
              </div>

              <div style={{
                background: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                borderRadius: '10px',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#a7f3d0' }}>Green Stable</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#34d399' }}>{greenCount}</span>
              </div>

              <div style={{
                background: 'rgba(100, 116, 139, 0.2)',
                border: '1px solid rgba(100, 116, 139, 0.4)',
                borderRadius: '10px',
                padding: '0.65rem 0.75rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Not Calibrated</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#e2e8f0' }}>{notCalibratedCount}</span>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div style={{
            paddingTop: '1rem',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.72rem',
            color: 'rgba(255, 255, 255, 0.7)',
            lineHeight: 1.45
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#93c5fd', fontWeight: 700, marginBottom: '3px' }}>
              <Activity size={12} /> Daily wearable summaries
            </div>
            Remote telemetry aggregated once daily per patient.
          </div>
        </div>

        {/* RIGHT AREA: 2 Rows x 4 Columns Hospital Bed Grid with Pagination */}
        <div style={{
          background: '#090d16',
          borderRadius: '18px',
          padding: '1.25rem',
          border: '1px solid #1e293b',
          boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          {/* Bed Grid: 4 columns across 2 rows (8 per page) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '1rem'
          }}>
            {paginatedBeds.map((patient, index) => (
              <HospitalBedCard
                key={patient.id}
                bedNumber={(validCurrentPage - 1) * pageSize + index + 1}
                patient={patient}
                onSelect={(selectedP) => onSelectPatient(selectedP)}
                isSelected={patient.id === "PT-8092"}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '1rem',
            marginTop: '1rem',
            borderTop: '1px solid #1e293b',
            color: '#94a3b8',
            fontSize: '0.78rem'
          }}>
            <span>
              Showing {filteredBeds.length > 0 ? (validCurrentPage - 1) * pageSize + 1 : 0} - {Math.min(validCurrentPage * pageSize, filteredBeds.length)} of {filteredBeds.length} patients
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                disabled={validCurrentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                style={{
                  background: validCurrentPage <= 1 ? '#1e293b' : '#334155',
                  color: validCurrentPage <= 1 ? '#64748b' : '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  cursor: validCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontWeight: 700, color: '#f8fafc' }}>
                Page {validCurrentPage} of {totalPages}
              </span>
              <button
                disabled={validCurrentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                style={{
                  background: validCurrentPage >= totalPages ? '#1e293b' : '#334155',
                  color: validCurrentPage >= totalPages ? '#64748b' : '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  cursor: validCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
