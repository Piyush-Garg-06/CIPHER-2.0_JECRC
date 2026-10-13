import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, 
  TrendingUp, 
  Sparkles, 
  Cpu, 
  ShieldCheck, 
  AlertTriangle 
} from 'lucide-react';
import RiskForecastChart from '../components/RiskForecastChart';
import ExplainabilityPanel from '../components/ExplainabilityPanel';
import ExpectedVsActual from '../components/ExpectedVsActual';
import RiskBadge from '../components/RiskBadge';
import { getModelCard } from '../services/api';

export default function PredictionsView({ patient, patients = [], onSelectPatient }) {
  const [selectedPatientId, setSelectedPatientId] = useState(patient.id);
  const [modelCard, setModelCard] = useState(null);
  const [modelCardLoaded, setModelCardLoaded] = useState(false);

  const currentPatient = patients.find(p => p.id === selectedPatientId) || patient;

  useEffect(() => {
    let isMounted = true;
    async function loadCard() {
      try {
        const card = await getModelCard();
        if (isMounted) {
          setModelCard(card);
          setModelCardLoaded(true);
        }
      } catch (err) {
        if (isMounted) {
          setModelCard(null);
          setModelCardLoaded(true);
        }
      }
    }
    loadCard();
    return () => { isMounted = false; };
  }, []);

  const isStale = Boolean(currentPatient.twinState?.staleData || currentPatient.staleData);
  const staleDays = currentPatient.twinState?.dataAgeDays ?? currentPatient.dataAgeDays ?? 0;
  const scoreDay = currentPatient.twinState?.scoreDay ?? currentPatient.scoreDay ?? 1;

  return (
    <div className="page-container">
      {/* Header Banner */}
      <div className="clean-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 'var(--radius-md)',
              background: 'var(--primary-blue-subtle)',
              color: 'var(--primary-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <BrainCircuit size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Predictive Risk Intelligence & Explainable AI (XAI)
              </h1>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                7-day readmission risk from a regularised logistic regression (synthetic-data demonstration)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Focus Patient:</span>
            <select
              value={selectedPatientId}
              onChange={(e) => {
                setSelectedPatientId(e.target.value);
                const p = patients.find(pt => pt.id === e.target.value);
                if (p) onSelectPatient(p);
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
                  {p.name} ({(p.twinState?.triageZone || p.riskLevel || 'stable').toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Stale Data Warning Banner */}
      {isStale && (
        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius-md)',
          padding: '0.75rem 1rem',
          color: '#92400e',
          fontSize: '0.82rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: 600
        }}>
          <AlertTriangle size={16} color="#d97706" />
          <span>No new reading for {staleDays} days; showing last valid score (day {scoreDay})</span>
        </div>
      )}

      {/* Model Stats */}
      <div className="grid-3">
        <div className="clean-card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Model discrimination (held-out test, synthetic)
          </div>
          {modelCard && modelCard.rocAuc ? (
            <>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary-blue)', fontFamily: 'var(--font-heading)' }}>
                {(modelCard.rocAuc.mean * 100).toFixed(1)}% <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>AUC-ROC</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                95% CI: [{(modelCard.rocAuc.ci[0] * 100).toFixed(1)}%, {(modelCard.rocAuc.ci[1] * 100).toFixed(1)}%] &bull; Prevalence: {(modelCard.testPositiveRate * 100).toFixed(1)}%
              </div>
              <div style={{ fontSize: '0.7rem', color: '#0369a1', fontWeight: 600, marginTop: '0.2rem' }}>
                0.5 = coin flip, 1.0 = perfect. Not the chance that this patient is readmitted. (synthetic data only)
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: '0.4rem' }}>
              Model card unavailable
            </div>
          )}
        </div>

        <div className="clean-card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Forecast Window
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'var(--font-heading)' }}>
            7 Days
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Updates when a new daily reading arrives
          </div>
        </div>

        <div className="clean-card">
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            Active Patient State
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem' }}>
            <RiskBadge
              level={currentPatient.twinState?.triageZone || currentPatient.riskLevel}
              score={currentPatient.twinState?.p50 ?? currentPatient.riskScore}
              watch={currentPatient.twinState?.watch ?? currentPatient.watch}
              redSource={currentPatient.twinState?.redSource ?? currentPatient.redSource}
            />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{currentPatient.name}</span>
          </div>
          {Array.isArray(currentPatient.twinState?.forwardCone) && currentPatient.twinState.forwardCone.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
              Projected 7-day risk if the current trend continues: ~{Math.round((currentPatient.twinState.p50 ?? currentPatient.twinState.forwardCone[0].p50) * 100)}% -&gt; ~{Math.round(currentPatient.twinState.forwardCone[currentPatient.twinState.forwardCone.length - 1].p50 * 100)}% (approx.)
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid-2">
        <RiskForecastChart
          trajectory={currentPatient.riskTrajectory}
          twinState={currentPatient.twinState}
          modelCard={modelCard}
          patientName={currentPatient.name}
        />

        <ExplainabilityPanel
          factors={currentPatient.explainabilityFactors}
          twinState={currentPatient.twinState}
          summaryText={currentPatient.summaryText}
          patientName={currentPatient.name}
          riskLevel={currentPatient.twinState?.triageZone || currentPatient.riskLevel}
        />
      </div>

      <ExpectedVsActual patient={currentPatient} />
    </div>
  );
}

