import React from 'react';
import { Cpu, Info, ShieldAlert } from 'lucide-react';
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

// ── Risk Management card ─────────────────────────────────────────────
export function RiskManagementCard({ riskParams }) {
  if (!riskParams) return null;
  return (
    <section className="card">
      <div className="card-header">
        <h2><ShieldAlert className="w-4 h-4 text-orange-400" />Risk Management</h2>
      </div>
      <div className="strategy-grid">
        <div className="strategy-box">
          <span className="strategy-box-title">Suggested Position Size</span>
          <span className="strategy-box-action" style={{ color: '#fbbf24' }}>{riskParams.position_size_account_pct.toFixed(2)}%</span>
          <p className="strategy-box-desc">Account capital per trade</p>
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

// ── Walk-Forward validation chart ────────────────────────────────────────────
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
                <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" fontSize={9} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1117', borderColor: 'var(--border-color)', fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="Baseline" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="StrategyReturn" stroke="#fbbf24" strokeWidth={2} dot={false} />
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
