import React, { useState } from 'react';
import { Sliders, ShieldCheck, ChevronDown, ChevronUp, Activity, LineChart, PanelLeftClose, PanelRightClose, Settings, Zap } from 'lucide-react';
import { getConnectorStatus } from '../utils.jsx';

// ── Horizon & Threshold sliders ──────────────────────────────────────────────
function Sliders_({ horizonHours, setHorizonHours, thresholdPct, setThresholdPct }) {
  return (
    <>
      <div className="slider-group">
        <div className="slider-header">
          <span>Horizon Hours</span>
          <span className="value">{horizonHours}h</span>
        </div>
        <input
          type="range" min="4" max="168" step="4"
          value={horizonHours}
          onChange={e => setHorizonHours(parseInt(e.target.value))}
          className="slider-input"
        />
      </div>
      <div className="slider-group">
        <div className="slider-header">
          <span>Volatility Boundary</span>
          <span className="value">{(thresholdPct * 100).toFixed(2)}%</span>
        </div>
        <input
          type="range" min="0.001" max="0.03" step="0.001"
          value={thresholdPct}
          onChange={e => setThresholdPct(parseFloat(e.target.value))}
          className="slider-input"
        />
      </div>
    </>
  );
}

// ── Feature toggle badges ────────────────────────────────────────────────────
function FeatureBadges({ featureConfig, setFeatureConfig, playClick }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: '0.4rem' }}>
        Features active
      </h3>
      <div className="badge-group">
        {Object.keys(featureConfig).map(key => (
          <button
            key={key}
            onClick={() => { playClick(); setFeatureConfig({ ...featureConfig, [key]: !featureConfig[key] }); }}
            className={`badge-btn ${featureConfig[key] ? 'badge-btn-active' : ''}`}
          >
            {key.replace('include_', '')}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── API Pipeline status grid (collapsible) ───────────────────────────────────
export function ApiPipelineCard({ gaps, error }) {
  const [expanded, setExpanded] = useState(false);
  const connectors = [
    { key: 'binance', name: 'Binance' },
    { key: 'coinglass', name: 'Coinglass' },
    { key: 'deribit', name: 'Deribit' },
    { key: 'onchain', name: 'Onchain' },
    { key: 'etf_flows', name: 'ETF Flows' },
    { key: 'fear_greed', name: 'Sentiment' },
    { key: 'fred', name: 'FRED Macro' },
  ];
  const statuses = connectors.map(c => ({ ...c, st: getConnectorStatus(c.key, gaps, error) }));
  const onlineCount = statuses.filter(c => c.st.label === 'Online').length;
  const total = connectors.length;
  const allOk = onlineCount === total;

  return (
    <section className="card" style={{ flex: 1 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <div className="card-header" style={{ marginBottom: 0 }}>
          <h2><ShieldCheck className="w-4 h-4 text-emerald-400" />API Pipeline</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '999px',
              backgroundColor: allOk ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)',
              color: allOk ? '#10b981' : '#f43f5e',
            }}>
              {onlineCount}/{total} online {allOk ? '✓' : '⚠'}
            </span>
            {expanded ? <ChevronUp size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="status-grid" style={{ marginTop: '0.5rem' }}>
          {statuses.map(({ key, name, st }) => (
            <div key={key} className="status-item">
              <span className="status-name">{name}</span>
              <span className={`status-badge ${st.color}`}>{st.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ── Signal Change Log ─────────────────────────────────────────────────────────
export function SignalLogCard({ log }) {
  if (!log || log.length === 0) return null;
  return (
    <section className="card" style={{ flex: 1 }}>
      <div className="card-header">
        <h2><Activity className="w-4 h-4 text-blue-400" />Signal Log</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {log.slice(0, 3).map((entry, i) => (
          <div key={i} style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', borderLeft: '2px solid #3b82f6', paddingLeft: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '1px' }}>
              {new Date(entry.time).toLocaleTimeString()}
            </span>
            {entry.messages.map((m, j) => (
              <span key={j} style={{ display: 'block', color: 'var(--text-secondary)' }}>{m}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Market Snapshot card ─────────────────────────────────────────────────────
export function MarketSnapshotCard({ predictionData, livePrice, lastFetchedTime, isSimpleMode, collapsed }) {
  if (!predictionData) return null;
  const displayed = livePrice ?? predictionData.market_snapshot.price;
  const fmtPrice = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fg = predictionData.market_snapshot.fear_greed_index;
  
  if (collapsed) {
    return (
      <button className="sidebar-icon-btn" title="Market Snapshot">
        <LineChart size={18} />
      </button>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Market Snapshot</h2>
        <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>
          {lastFetchedTime ? new Date(lastFetchedTime).toLocaleTimeString() : ''}
        </span>
      </div>
      <div className="snapshot-grid">
        <div className="snapshot-box">
          <span className="snapshot-label">Price</span>
          <span className="snapshot-val" style={{ color: isSimpleMode ? '#0f172a' : '#fff' }}>
            ${fmtPrice(displayed)}
          </span>
        </div>
        <div className="snapshot-box">
          <span className="snapshot-label">Fear &amp; Greed</span>
          <span className="snapshot-val" style={{ color: fg > 60 ? '#10b981' : '#f43f5e' }}>{fg}</span>
        </div>
      </div>
    </section>
  );
}

// ── Main Setup/Recalibrate card ──────────────────────────────────────────────
export default function SetupCard({
  isSimpleMode, horizonHours, setHorizonHours,
  thresholdPct, setThresholdPct, featureConfig, setFeatureConfig,
  trainLoading, handleTrain, playClick, collapsed, toggleCollapse
}) {
  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center' }}>
        <button className="sidebar-icon-btn" onClick={toggleCollapse} title="Expand Sidebar" style={{ marginBottom: '0.5rem' }}>
          <PanelRightClose size={18} />
        </button>
        <button className="sidebar-icon-btn" title="Projections Setup">
          <Settings size={18} />
        </button>
        <button className="sidebar-icon-btn" title="API Pipeline">
          <Zap size={18} />
        </button>
      </div>
    );
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2><Sliders className="w-4 h-4 text-blue-500" />Projections Setup</h2>
        <button onClick={toggleCollapse} className="btn-icon" title="Collapse Sidebar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <PanelLeftClose size={16} />
        </button>
      </div>

      {!isSimpleMode && (
        <>
          <Sliders_
            horizonHours={horizonHours} setHorizonHours={setHorizonHours}
            thresholdPct={thresholdPct} setThresholdPct={setThresholdPct}
          />
          <FeatureBadges
            featureConfig={featureConfig} setFeatureConfig={setFeatureConfig} playClick={playClick}
          />
        </>
      )}

      <button
        onClick={() => { playClick(); handleTrain(); }}
        disabled={trainLoading}
        className="btn-recalibrate"
      >
        {trainLoading ? (
          <><span className="chart-loading-spinner" style={{ marginRight: '0.5rem' }} />Calibrating...</>
        ) : 'Recalibrate Model'}
      </button>

      {trainLoading && (
        <div className="train-progress">
          <div className="train-progress-bar" />
        </div>
      )}
    </section>
  );
}
