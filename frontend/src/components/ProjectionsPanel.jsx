import React, { useState } from 'react';
import { BaselineBadge, FriendlyProjection } from '../utils.jsx';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AdvancedIndicators } from './AdvancedIndicators.jsx';

function Delta({ prev, curr, fmt = n => `${(n * 100).toFixed(0)}%` }) {
  if (prev == null || curr == null) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.005) return null;
  const up = diff > 0;
  return (
    <span style={{ fontSize: '0.88rem', fontWeight: 700, marginLeft: '4px', color: up ? '#10b981' : '#f43f5e', verticalAlign: 'middle' }}>
      {up ? '↑' : '↓'}{fmt(Math.abs(diff))}
    </span>
  );
}

function ProbabilityBar({ probs }) {
  return (
    <div className="probability-bar-container">
      <div className="probability-bar-down" style={{ width: `${probs.down * 100}%` }} title={`Down: ${(probs.down * 100).toFixed(0)}%`} />
      <div className="probability-bar-sideways" style={{ width: `${probs.sideways * 100}%` }} />
      <div className="probability-bar-up" style={{ width: `${probs.up * 100}%` }} />
    </div>
  );
}

function DirectionCards({ probs, prevProbs, thresholdPct }) {
  const pct = n => `${(n * 100).toFixed(1)}%`;
  const dirs = [
    { key: 'down', label: 'Down', cls: 'proj-down', sub: `Move < -${pct(thresholdPct)}` },
    { key: 'sideways', label: 'Sideways', cls: 'proj-sideways', sub: `Move within ±${pct(thresholdPct)}` },
    { key: 'up', label: 'Up', cls: 'proj-up', sub: `Move > +${pct(thresholdPct)}` },
  ];
  return (
    <div className="projection-grid">
      {dirs.map(({ key, label, cls, sub }) => (
        <div key={key} className={`projection-card ${cls}`}>
          <span className="projection-card-label">{label}</span>
          <h3 className="projection-card-val">
            {(probs[key] * 100).toFixed(0)}%
            <Delta prev={prevProbs?.[key]} curr={probs[key]} />
          </h3>
          <span className="projection-card-sub">{sub}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectionsPanel({ predictionData, prevPredictionData, isSimpleMode, thresholdPct }) {
  const [expanded, setExpanded] = useState(true);
  if (!predictionData) return null;
  const probs = predictionData.model_prediction.direction_probabilities;
  const prevProbs = prevPredictionData?.model_prediction?.direction_probabilities;
  const currAcc = predictionData.validation_summary.mean_accuracy;
  const prevAcc = prevPredictionData?.validation_summary?.mean_accuracy;

  return (
    <section className="card">
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
        <div className="card-header" style={{ marginBottom: expanded ? '0.75rem' : 0 }}>
          <h2>Directional Projections ({predictionData.meta?.horizon_hours ?? 24}h)</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <BaselineBadge status={predictionData.validation_summary.accuracy_vs_naive_baseline} />
            {expanded ? <ChevronUp size={12} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-secondary)' }} />}
          </div>
        </div>
      </button>
      {expanded && (
        <>
          {isSimpleMode ? (
            <div style={{ padding: '0.5rem 0' }}>
              <FriendlyProjection payload={predictionData} />
              <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem', textAlign: 'center', lineHeight: 1.5 }}>
                The model's most probable direction. Walk-forward testing verifies consistency.
              </p>
            </div>
          ) : (
            <>
              <DirectionCards probs={probs} prevProbs={prevProbs} thresholdPct={thresholdPct} />
              <ProbabilityBar probs={probs} />
              <div style={{ marginTop: '0.75rem', padding: '0.65rem', border: '1px solid var(--border-color)', fontSize: '0.90rem', color: 'var(--text-secondary)' }}>
                Tested accuracy: <strong style={{ color: 'var(--text-primary)' }}>{(currAcc * 100).toFixed(1)}%</strong>
                <Delta prev={prevAcc} curr={currAcc} fmt={n => `${(n * 100).toFixed(1)}%`} />
                {' '}(±{(predictionData.validation_summary.std_accuracy * 100).toFixed(1)}% σ)
                <span style={{ float: 'right', fontStyle: 'italic' }}>{predictionData.model_prediction.confidence_note}</span>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
