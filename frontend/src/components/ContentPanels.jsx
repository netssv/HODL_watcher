import React, { useState } from 'react';
import { Cpu, Info, ShieldAlert, ChevronDown, ChevronUp, Copy, Check, TrendingUp, TrendingDown } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { BaselineBadge, FriendlyProjection, fmtPct } from '../utils.jsx';

// ── Delta arrow helper ────────────────────────────────────────────────────────
function Delta({ prev, curr, fmt = (n) => `${(n * 100).toFixed(0)}%` }) {
  if (prev == null || curr == null) return null;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.005) return null;
  const up = diff > 0;
  return (
    <span style={{
      fontSize: '0.6rem', fontWeight: 700, marginLeft: '4px',
      color: up ? '#10b981' : '#f43f5e', verticalAlign: 'middle'
    }}>
      {up ? '↑' : '↓'}{fmt(Math.abs(diff))}
    </span>
  );
}

// ── Probability bar ───────────────────────────────────────────────────────────
function ProbabilityBar({ probs }) {
  return (
    <div className="probability-bar-container">
      <div className="probability-bar-down" style={{ width: `${probs.down * 100}%` }} title={`Down: ${(probs.down * 100).toFixed(0)}%`} />
      <div className="probability-bar-sideways" style={{ width: `${probs.sideways * 100}%` }} />
      <div className="probability-bar-up" style={{ width: `${probs.up * 100}%` }} />
    </div>
  );
}

// ── Three direction cards (with deltas) ───────────────────────────────────────
function DirectionCards({ probs, prevProbs, thresholdPct }) {
  const pct = n => `${(n * 100).toFixed(1)}%`;
  return (
    <div className="projection-grid">
      <div className="projection-card proj-down">
        <span className="projection-card-label">Down</span>
        <h3 className="projection-card-val">
          {(probs.down * 100).toFixed(0)}%
          <Delta prev={prevProbs?.down} curr={probs.down} />
        </h3>
        <span className="projection-card-sub">Move &lt; -{pct(thresholdPct)}</span>
      </div>
      <div className="projection-card proj-sideways">
        <span className="projection-card-label">Sideways</span>
        <h3 className="projection-card-val">
          {(probs.sideways * 100).toFixed(0)}%
          <Delta prev={prevProbs?.sideways} curr={probs.sideways} />
        </h3>
        <span className="projection-card-sub">Move within ±{pct(thresholdPct)}</span>
      </div>
      <div className="projection-card proj-up">
        <span className="projection-card-label">Up</span>
        <h3 className="projection-card-val">
          {(probs.up * 100).toFixed(0)}%
          <Delta prev={prevProbs?.up} curr={probs.up} />
        </h3>
        <span className="projection-card-sub">Move &gt; +{pct(thresholdPct)}</span>
      </div>
    </div>
  );
}

// ── Advanced indicator row ────────────────────────────────────────────────────
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
          <span className="strategy-box-title" title="Relative Strength Index across 6/12/24 hour windows. >70 is overbought, <30 is oversold.">RSI 6/12/24</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem' }}>
            {rsi['6'].toFixed(1)} / {rsi['12'].toFixed(1)} / {rsi['24'].toFixed(1)}
          </span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Cost of holding long/short perpetual futures. Positive means longs pay shorts (bullish sentiment).">Funding Rate</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: fr.value > 0 ? '#10b981' : '#f43f5e' }}>
            {(fr.value * 100).toFixed(4)}%
          </span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Trend: {fr.trend}</span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Ratio of Long vs Short accounts. >1 means more traders are long.">L/S Ratio</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: ls.value > 1 ? '#10b981' : '#f43f5e' }}>
            {ls.value.toFixed(2)}
          </span>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Trend: {ls.trend}</span>
        </div>
      </div>
      <div className="status-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginTop: '0.5rem' }}>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Distance to closest large liquidation clusters. E.g. +1.5% means heavily leveraged shorts will be liquidated if price rises 1.5%.">Liq. Proximity</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem' }}>
            {snapshot.liquidation_proximity ? `+${fmtPct(snapshot.liquidation_proximity.upper, 1)} / -${fmtPct(snapshot.liquidation_proximity.lower, 1)}` : 'N/A'}
          </span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Implied Volatility, 25-delta Skew, and Put/Call Ratio. High IV = high volatility. Negative skew = puts are more expensive than calls.">IV / Skew / P/C</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem' }}>
            {snapshot.deribit_options ? `${snapshot.deribit_options.dvol.toFixed(1)} / ${(snapshot.deribit_options.skew_25d * 100).toFixed(1)}% / ${snapshot.deribit_options.put_call_ratio.toFixed(2)}` : 'N/A'}
          </span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Net amount of BTC moving into or out of exchanges. Negative flow means BTC leaving exchanges (bullish/accumulation).">Exch. Net Flow</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: snapshot.onchain?.exchange_net_flow > 0 ? '#10b981' : '#f43f5e' }}>
            {snapshot.onchain ? `${snapshot.onchain.exchange_net_flow.toFixed(1)} BTC` : 'N/A'}
          </span>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title" title="Net fiat inflow into Spot BTC ETFs. Positive flow means institutional buying.">ETF Net Flow</span>
          <span className="snapshot-val" style={{ fontSize: '0.8rem', color: snapshot.onchain?.etf_net_flow > 0 ? '#10b981' : '#f43f5e' }}>
            {snapshot.onchain ? `$${snapshot.onchain.etf_net_flow.toFixed(1)}M` : 'N/A'}
          </span>
        </div>
      </div>
      {snapshot.market_regime !== undefined && (
        <div style={{ marginTop: '0.75rem', padding: '0.5rem', backgroundColor: snapshot.market_regime === 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', borderRadius: '4px', border: `1px solid ${snapshot.market_regime === 0 ? '#f59e0b' : '#10b981'}` }}>
          <span style={{ fontSize: '0.7rem', color: snapshot.market_regime === 0 ? '#f59e0b' : '#10b981', fontWeight: 600 }}>
            {snapshot.market_regime === 1 ? 'Regime: Trending Up' : snapshot.market_regime === -1 ? 'Regime: Trending Down' : 'Regime: Ranging / Volatile'}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Projections panel ────────────────────────────────────────────────────
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
            Tested accuracy: <strong style={{ color: 'var(--text-primary)' }}>
              {(currAcc * 100).toFixed(1)}%
            </strong>
            <Delta
              prev={prevAcc}
              curr={currAcc}
              fmt={(n) => `${(n * 100).toFixed(1)}%`}
            />
            {' '}(±{(predictionData.validation_summary.std_accuracy * 100).toFixed(1)}% σ)
            <span style={{ float: 'right', fontStyle: 'italic' }}>
              {predictionData.model_prediction.confidence_note}
            </span>
          </div>
          <AdvancedIndicators snapshot={predictionData.market_snapshot} />
        </>
      )}
    </section>
  );
}

// ── Strategy Recommendation card ──────────────────────────────────────────────
export function StrategyCard({ strategy }) {
  if (!strategy) return null;
  const isLowConfidence = strategy.isLowConfidence;
  const color = isLowConfidence ? '#94a3b8' :
    strategy.recommendation.includes('LONG') ? '#10b981'
    : strategy.recommendation.includes('SHORT') ? '#f43f5e' : '#94a3b8';
  const Icon = strategy.recommendation.includes('LONG') ? TrendingUp
    : strategy.recommendation.includes('SHORT') ? TrendingDown : null;

  return (
    <section className="card" style={{ opacity: isLowConfidence ? 0.75 : 1 }}>
      <div className="card-header">
        <h2><Cpu className="w-4 h-4 text-emerald-400" />Strategy</h2>
        {isLowConfidence && (
          <span style={{ fontSize: '0.55rem', backgroundColor: 'rgba(148,163,184,0.15)', color: '#94a3b8', padding: '2px 6px', borderRadius: '999px', fontWeight: 600 }}>
            LOW CONFIDENCE — NO ACTION
          </span>
        )}
      </div>
      <div className="strategy-grid">
        <div className="strategy-box" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '0.75rem' }}>
          <span className="strategy-box-title">Action</span>
          <span className="strategy-box-action" style={{ color, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {Icon && <Icon size={14} />}
            {strategy.recommendation}
          </span>
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

// ── Risk Management card ──────────────────────────────────────────────────────
export function RiskManagementCard({ riskParams }) {
  if (!riskParams) return null;
  const isLeveraged = riskParams.leverage > 1.0;
  return (
    <section className="card">
      <div className="card-header">
        <h2><ShieldAlert className="w-4 h-4 text-orange-400" />Risk Management</h2>
      </div>
      <div className="strategy-grid">
        <div className="strategy-box">
          <span className="strategy-box-title" title="Notional position size based on target risk and ATR stop loss distance.">
            Suggested Position Size <Info className="w-3 h-3 inline text-gray-400" style={{verticalAlign: 'text-bottom'}} />
          </span>
          <span className="strategy-box-action" style={{ color: '#fbbf24' }}>
            {riskParams.position_size_notional_pct.toFixed(2)}%
          </span>
          {isLeveraged ? (
            <p className="strategy-box-desc">
              {riskParams.actual_risk_pct.toFixed(1)}% Risk, {riskParams.leverage.toFixed(1)}x Lev = {(riskParams.position_size_notional_pct / riskParams.leverage).toFixed(1)}% Margin
            </p>
          ) : (
            <p className="strategy-box-desc">
              {riskParams.actual_risk_pct.toFixed(1)}% Account Risk (No Lev)
            </p>
          )}
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title">Dynamic SL / TP</span>
          <div>
            <span className="snapshot-val" style={{ fontSize: '0.8rem', color: '#f43f5e' }}>-{riskParams.dynamic_sl_pct.toFixed(1)}%</span>
            <span className="snapshot-val" style={{ fontSize: '0.8rem', color: '#10b981', marginLeft: '0.5rem' }}>+{riskParams.dynamic_tp_pct.toFixed(1)}%</span>
          </div>
          <p className="strategy-box-desc">Based on recent volatility (ATR)</p>
        </div>
      </div>
    </section>
  );
}

// ── LLM Agent Payload card (collapsible) ─────────────────────────────────────
export function LLMPayloadCard({ payload }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!payload) return null;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2><Cpu className="w-4 h-4 text-emerald-400" />LLM Agent Payload</h2>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>
            Paste this JSON into any LLM to generate custom strategies.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button
            onClick={copyToClipboard}
            title="Copy JSON to clipboard"
            style={{
              backgroundColor: copied ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)',
              color: copied ? '#10b981' : '#60a5fa',
              border: `1px solid ${copied ? '#10b981' : '#3b82f6'}`,
              borderRadius: '4px', padding: '3px 8px', fontSize: '0.65rem',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem' }}
          >
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Collapse' : 'Expand for raw JSON'}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ backgroundColor: '#0d1117', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginTop: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
          <pre style={{ margin: 0, fontSize: '0.65rem', color: '#a5b4fc', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}

// ── Walk-Forward validation chart ─────────────────────────────────────────────
export function ValidationChart({ trainingReport }) {
  const data = trainingReport?.folds?.map(f => ({
    fold: `F${f.fold}`,
    Accuracy: parseFloat((f.accuracy * 100).toFixed(1)),
    Baseline: parseFloat((f.majority_baseline * 100).toFixed(1)),
    StrategyReturn: parseFloat((f.trading?.final_return * 100).toFixed(1) || 0),
    BHReturn: parseFloat((f.trading?.bh_final_return * 100).toFixed(1) || 0),
  })) || [];

  const trading = trainingReport?.overall?.trading_metrics;

  return (
    <section className="card">
      <div className="card-header"><h2>Walk-Forward Validation Trend</h2></div>
      {data.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {trading && (
            <div className="status-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div className="strategy-box"><span className="strategy-box-title">Sharpe Ratio</span><span className="snapshot-val" style={{fontSize:'0.8rem'}}>{trading.mean_sharpe.toFixed(2)}</span></div>
              <div className="strategy-box"><span className="strategy-box-title">Max Drawdown</span><span className="snapshot-val" style={{fontSize:'0.8rem',color:'#f43f5e'}}>{(trading.mean_max_drawdown * 100).toFixed(1)}%</span></div>
              <div className="strategy-box"><span className="strategy-box-title">Win Rate</span><span className="snapshot-val" style={{fontSize:'0.8rem',color:'#10b981'}}>{(trading.mean_win_rate * 100).toFixed(1)}%</span></div>
              <div className="strategy-box"><span className="strategy-box-title">Avg Fold Return</span><span className="snapshot-val" style={{fontSize:'0.8rem'}}>{(trading.mean_strategy_return * 100).toFixed(1)}%</span></div>
            </div>
          )}
          <div style={{ height: '176px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fold" stroke="var(--text-muted)" fontSize={9} />
                <YAxis yAxisId="left" stroke="var(--text-muted)" fontSize={9} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" fontSize={9} label={{ value: 'Return %', angle: 90, position: 'insideRight', fill: '#fbbf24', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1117', borderColor: 'var(--border-color)', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line yAxisId="left" type="monotone" dataKey="Accuracy" name="Model Accuracy" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="Baseline" name="Naive Baseline" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="StrategyReturn" name="Strategy P&L" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
