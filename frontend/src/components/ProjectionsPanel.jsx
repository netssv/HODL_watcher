import React from 'react';
import { BaselineBadge, FriendlyProjection, fmtPct } from '../utils.jsx';

function Delta({ prev, curr, fmt = n => `${(n * 100).toFixed(0)}%` }) {
  if (prev == null || curr == null) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.005) return null;
  const up = diff > 0;
  return (
    <span style={{ fontSize: '0.6rem', fontWeight: 700, marginLeft: '4px', color: up ? '#10b981' : '#f43f5e', verticalAlign: 'middle' }}>
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

function AdvancedIndicators({ snapshot }) {
  const { rsi, funding_rate: fr, long_short_ratio: ls, liquidation_proximity: liq, deribit_options: opt, onchain, market_regime } = snapshot;
  const regimeColor = market_regime === 0 ? '#f59e0b' : '#10b981';
  const regimeLabel = market_regime === 1 ? 'Regime: Trending Up' : market_regime === -1 ? 'Regime: Trending Down' : 'Regime: Ranging / Volatile';
  return (
    <div style={{ marginTop: '1.25rem' }}>
      <h3 style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: '0.5rem' }}>Advanced Indicators</h3>
      <div className="status-grid" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className="strategy-box">
          <span className="strategy-box-title" title=">70 overbought, <30 oversold">RSI 6/12/24</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem' }}>{rsi['6'].toFixed(1)} / {rsi['12'].toFixed(1)} / {rsi['24'].toFixed(1)}</span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Positive = longs pay shorts">Funding Rate</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: fr.value > 0 ? '#10b981' : '#f43f5e' }}>{(fr.value * 100).toFixed(4)}%</span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Trend: {fr.trend}</span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title=">1 = more longs">L/S Ratio</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: ls.value > 1 ? '#10b981' : '#f43f5e' }}>{ls.value.toFixed(2)}</span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Trend: {ls.trend}</span>
        </div>
      </div>
      <div className="status-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: '0.5rem' }}>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Distance to liquidation clusters">Liq. Proximity</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem' }}>{liq ? `+${fmtPct(liq.upper, 1)} / -${fmtPct(liq.lower, 1)}` : 'N/A'}</span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="IV / 25d Skew / Put-Call Ratio">IV / Skew / P/C</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem' }}>{opt ? `${opt.dvol.toFixed(1)} / ${(opt.skew_25d * 100).toFixed(1)}% / ${opt.put_call_ratio.toFixed(2)}` : 'N/A'}</span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Negative = BTC leaving exchanges (bullish)">Exch. Net Flow</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: onchain?.exchange_net_flow > 0 ? '#10b981' : '#f43f5e' }}>{onchain ? `${onchain.exchange_net_flow.toFixed(1)} BTC` : 'N/A'}</span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Positive = institutional buying">ETF Net Flow</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: onchain?.etf_net_flow > 0 ? '#10b981' : '#f43f5e' }}>{onchain ? `$${onchain.etf_net_flow.toFixed(1)}M` : 'N/A'}</span>
        </div>
      </div>
      {market_regime !== undefined && (
        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: `${regimeColor}1a`, borderRadius: '4px', border: `1px solid ${regimeColor}` }}>
          <span style={{ fontSize: '0.7rem', color: regimeColor, fontWeight: 600 }}>{regimeLabel}</span>
        </div>
      )}
    </div>
  );
}

export function ProjectionsPanel({ predictionData, prevPredictionData, isSimpleMode, thresholdPct }) {
  if (!predictionData) return null;
  const probs = predictionData.model_prediction.direction_probabilities;
  const prevProbs = prevPredictionData?.model_prediction?.direction_probabilities;
  const currAcc = predictionData.validation_summary.mean_accuracy;
  const prevAcc = prevPredictionData?.validation_summary?.mean_accuracy;

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
          <DirectionCards probs={probs} prevProbs={prevProbs} thresholdPct={thresholdPct} />
          <ProbabilityBar probs={probs} />
          <div style={{ marginTop: '0.75rem', padding: '0.65rem', border: '1px solid var(--border-color)', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
            Tested accuracy: <strong style={{ color: 'var(--text-primary)' }}>{(currAcc * 100).toFixed(1)}%</strong>
            <Delta prev={prevAcc} curr={currAcc} fmt={n => `${(n * 100).toFixed(1)}%`} />
            {' '}(±{(predictionData.validation_summary.std_accuracy * 100).toFixed(1)}% σ)
            <span style={{ float: 'right', fontStyle: 'italic' }}>{predictionData.model_prediction.confidence_note}</span>
          </div>
          <AdvancedIndicators snapshot={predictionData.market_snapshot} />
        </>
      )}
    </section>
  );
}
