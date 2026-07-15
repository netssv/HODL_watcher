import React from 'react';
import { Cpu, Info } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { BaselineBadge, FriendlyProjection } from '../utils.jsx';
import CandlestickChart from './CandlestickChart';

// ── Probability bar ──────────────────────────────────────────────────────────
function ProbabilityBar({ probs }) {
  return (
    <div className="probability-bar-container">
      <div className="probability-bar-down" style={{ width: `${probs.down * 100}%` }} title={`Down: ${(probs.down * 100).toFixed(0)}%`} />
      <div className="probability-bar-sideways" style={{ width: `${probs.sideways * 100}%` }} />
      <div className="probability-bar-up" style={{ width: `${probs.up * 100}%` }} />
    </div>
  );
}

// ── Three direction cards ────────────────────────────────────────────────────
function DirectionCards({ probs, thresholdPct }) {
  const pct = n => `${(n * 100).toFixed(1)}%`;
  return (
    <div className="projection-grid">
      <div className="projection-card proj-down">
        <span className="projection-card-label">Down</span>
        <h3 className="projection-card-val">{(probs.down * 100).toFixed(0)}%</h3>
        <span className="projection-card-sub">Move &lt; -{pct(thresholdPct)}</span>
      </div>
      <div className="projection-card proj-sideways">
        <span className="projection-card-label">Sideways</span>
        <h3 className="projection-card-val">{(probs.sideways * 100).toFixed(0)}%</h3>
        <span className="projection-card-sub">Move within ±{pct(thresholdPct)}</span>
      </div>
      <div className="projection-card proj-up">
        <span className="projection-card-label">Up</span>
        <h3 className="projection-card-val">{(probs.up * 100).toFixed(0)}%</h3>
        <span className="projection-card-sub">Move &gt; +{pct(thresholdPct)}</span>
      </div>
    </div>
  );
}

// ── Advanced indicator row ───────────────────────────────────────────────────
function AdvancedIndicators({ snapshot }) {
  const rsi = snapshot.rsi;
  const fr = snapshot.funding_rate;
  const ls = snapshot.long_short_ratio;
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h3 style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: '0.5rem' }}>
        Advanced Indicators
      </h3>
      <div className="status-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="strategy-box">
          <span className="strategy-box-title">RSI 6/12/24</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem' }}>
            {rsi['6'].toFixed(1)} / {rsi['12'].toFixed(1)} / {rsi['24'].toFixed(1)}
          </span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title">Funding Rate</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: fr.value > 0 ? '#10b981' : '#f43f5e' }}>
            {(fr.value * 100).toFixed(4)}%
          </span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Trend: {fr.trend}</span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title">L/S Ratio</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: ls.value > 1 ? '#10b981' : '#f43f5e' }}>
            {ls.value.toFixed(2)}
          </span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Trend: {ls.trend}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Projections panel ───────────────────────────────────────────────────
export function ProjectionsPanel({ predictionData, isSimpleMode, thresholdPct }) {
  if (!predictionData) return null;
  const probs = predictionData.model_prediction.direction_probabilities;
  return (
    <section className="card">
      <div className="card-header">
        <h2>Directional Projections ({predictionData.meta?.horizon_hours ?? 24}h)</h2>
        <BaselineBadge status={predictionData.validation_summary.accuracy_vs_naive_baseline} />
      </div>

      {isSimpleMode ? (
        <div style={{ padding: '0.5rem 0' }}>
          <FriendlyProjection payload={predictionData} />
          <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem', textAlign: 'center', lineHeight: 1.5 }}>
            The model's most probable direction. Walk-forward testing verifies consistency.
          </p>
        </div>
      ) : (
        <>
          <DirectionCards probs={probs} thresholdPct={thresholdPct} />
          <ProbabilityBar probs={probs} />
          <div style={{ marginTop: '0.75rem', padding: '0.65rem', border: '1px solid var(--border-color)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            Tested accuracy: <strong style={{ color: 'var(--text-primary)' }}>
              {(predictionData.validation_summary.mean_accuracy * 100).toFixed(1)}%
            </strong> (±{(predictionData.validation_summary.std_accuracy * 100).toFixed(1)}% σ)
            <span style={{ float: 'right', fontStyle: 'italic' }}>
              {predictionData.model_prediction.confidence_note}
            </span>
          </div>
          <AdvancedIndicators snapshot={predictionData.market_snapshot} />
        </>
      )}

      <CandlestickChart isSimpleMode={isSimpleMode} predictionData={predictionData} thresholdPct={thresholdPct} />
    </section>
  );
}

// ── Strategy Recommendation card ─────────────────────────────────────────────
export function StrategyCard({ strategy }) {
  if (!strategy) return null;
  const color = strategy.recommendation.includes('LONG') ? '#10b981'
    : strategy.recommendation.includes('SHORT') ? '#f43f5e' : '#94a3b8';
  return (
    <section className="card">
      <div className="card-header">
        <h2><Cpu className="w-4 h-4 text-emerald-400" />Strategy (LLM Agent)</h2>
        <span style={{ fontSize: '0.55rem', color: '#818cf8', fontWeight: 700, textTransform: 'uppercase' }}>
          {strategy.agentName}
        </span>
      </div>
      <div className="strategy-grid">
        <div className="strategy-box">
          <span className="strategy-box-title">Action</span>
          <span className="strategy-box-action" style={{ color }}>{strategy.recommendation}</span>
          <p className="strategy-box-desc">{strategy.action}</p>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title">Rationale</span>
          <p className="strategy-box-desc">{strategy.rationale}</p>
        </div>
      </div>
    </section>
  );
}

// ── Walk-Forward validation chart ────────────────────────────────────────────
export function ValidationChart({ trainingReport }) {
  const data = trainingReport?.folds?.map(f => ({
    fold: `F${f.fold}`,
    Accuracy: parseFloat((f.accuracy * 100).toFixed(1)),
    Baseline: parseFloat((f.majority_baseline * 100).toFixed(1)),
  })) || [];

  return (
    <section className="card">
      <div className="card-header"><h2>Walk-Forward Validation Trend</h2></div>
      {data.length > 0 ? (
        <div style={{ height: '176px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="fold" stroke="var(--text-muted)" fontSize={9} />
              <YAxis stroke="var(--text-muted)" fontSize={9} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#0d1117', borderColor: 'var(--border-color)', fontSize: 11 }} />
              <Line type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Baseline" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={1} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="empty-chart-container">
          <Info className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          <span>No calibration data. Click "Recalibrate Model" to run walk-forward validation.</span>
        </div>
      )}
    </section>
  );
}
