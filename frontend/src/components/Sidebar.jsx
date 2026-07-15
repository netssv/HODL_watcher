import React from 'react';
import { Sliders, ShieldCheck, RefreshCw } from 'lucide-react';
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

// ── API Pipeline status grid ─────────────────────────────────────────────────
export function ApiPipelineCard({ gaps, error }) {
  const connectors = [
    { key: 'binance', name: 'Binance' },
    { key: 'fear_greed', name: 'Sentiment' },
    { key: 'fred', name: 'FRED Macro' },
    { key: 'coingecko', name: 'CoinGecko' },
  ];
  return (
    <section className="card">
      <div className="card-header">
        <h2><ShieldCheck className="w-4 h-4 text-emerald-400" />API Pipeline</h2>
      </div>
      <div className="status-grid">
        {connectors.map(({ key, name }) => {
          const st = getConnectorStatus(key, gaps, error);
          return (
            <div key={key} className="status-item">
              <span className="status-name">{name}</span>
              <span className={`status-badge ${st.color}`}>{st.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Market Snapshot card ─────────────────────────────────────────────────────
export function MarketSnapshotCard({ predictionData, livePrice, lastFetchedTime, isSimpleMode }) {
  if (!predictionData) return null;
  const displayed = livePrice ?? predictionData.market_snapshot.price;
  const fmtPrice = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fg = predictionData.market_snapshot.fear_greed_index;
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
  trainLoading, handleTrain, playClick,
}) {
  return (
    <section className="card">
      <div className="card-header">
        <h2><Sliders className="w-4 h-4 text-blue-500" />Projections Setup</h2>
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
