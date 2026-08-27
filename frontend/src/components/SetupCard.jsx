import React, { useState } from 'react';
import { Sliders, Activity, PanelLeftClose, PanelRightClose, Settings, RefreshCw, Clock } from 'lucide-react';
import { WIDGET_NAMES, allInactiveIds, InactiveWidgetRow, InactiveIconBtn } from './WidgetTray.jsx';
import { LineChart, ShieldCheck, Zap } from 'lucide-react';

const WIDGET_ICONS = {
  projections: <Sliders size={18} />,
  chart:       <LineChart size={18} />,
  strategy:    <ShieldCheck size={18} />,
  risk:        <Activity size={18} />,
  llm:         <Settings size={18} />,
  validation:  <Zap size={18} />,
};

function SliderRow({ label, value, display, min, max, step, onChange }) {
  return (
    <div className="slider-group">
      <div className="slider-header">
        <span>{label}</span>
        <span className="value">{display}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} className="slider-input" />
    </div>
  );
}

function FeatureBadges({ featureConfig, setFeatureConfig, playClick }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <h3 style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700, marginBottom: '0.4rem' }}>
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

export default function SetupCard({
  isSimpleMode, horizonHours, setHorizonHours,
  selectHorizon,
  thresholdPct, setThresholdPct, featureConfig, setFeatureConfig,
  trainLoading, handleTrain, playClick, collapsed, toggleCollapse,
  cooldownRemaining = 0,
  hiddenWidgets, minimizedWidgets, restoreWidget,
  predictionData, loading, fetchPrediction,
}) {
  const [expanded, setExpanded] = useState(true);
  const [showCustomize, setShowCustomize] = useState(false);
  const allInactive = allInactiveIds(hiddenWidgets, minimizedWidgets);
  const freshness = predictionData?.meta?.data_freshness || {};
  const freshnessRows = Object.entries(freshness).filter(([, value]) => value);
  const formatTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  };
  const formatKey = key => key.replace(/_last_update|_/g, ' ').trim().replace(/\b\w/g, c => c.toUpperCase());

  if (collapsed) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button className="sidebar-icon-btn" onClick={toggleCollapse} title="Expand Sidebar">
          <PanelRightClose size={18} />
        </button>
      </div>
    );
  }

  return (
    <>
      <section className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header" style={{ marginBottom: '0.75rem' }}>
          <h2><Sliders className="w-4 h-4 text-blue-500" />{isSimpleMode ? 'HODL controls' : 'Projections Setup'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button onClick={toggleCollapse} className="btn-icon sidebar-collapse-btn" title="Collapse Sidebar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <PanelLeftClose size={20} />
            </button>
          </div>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          <div className="setup-action-grid">
            <button className="btn btn-secondary" onClick={() => { playClick(); setShowCustomize(v => !v); }}>
              <Settings size={14} /> {isSimpleMode ? 'Tune the stack' : 'Customize model'}
            </button>
            <button className="btn btn-primary" onClick={() => { playClick(); fetchPrediction(true); }} disabled={loading || trainLoading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> {isSimpleMode ? 'Check the chain' : 'Refresh data'}
            </button>
          </div>
          <>
              {showCustomize ? <div style={{ padding: '0.7rem', marginBottom: '0.7rem', border: '1px solid var(--border-color)', borderRadius: 5, background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.65rem' }}>{isSimpleMode ? 'Choose how far ahead to read the trail before retuning the stack.' : 'Choose the forecast horizon, movement threshold, and data groups used during recalibration.'}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Forecast horizon</div>
                <div className="badge-group" style={{ marginBottom: '0.65rem' }}>
                  {[4, 24, 72].map(hours => (
                    <button
                      key={hours}
                      onClick={() => selectHorizon(hours)}
                      className={`badge-btn ${horizonHours === hours ? 'badge-btn-active' : ''}`}
                      title={hours > 24 ? 'Long-range horizon: use with extra caution' : `Retrain for a ${hours}-hour forecast horizon`}
                    >
                      {hours}h
                    </button>
                  ))}
                </div>
                {horizonHours > 24 && (
                  <div style={{ fontSize: '0.74rem', color: '#fbbf24', marginBottom: '0.65rem' }}>
                    72h is a long-range view; treat it as higher uncertainty, not a clear BTC path.
                  </div>
                )}
                <SliderRow label="Volatility Boundary" display={`${(thresholdPct * 100).toFixed(2)}%`} min="0.001" max="0.03" step="0.001" value={thresholdPct} onChange={e => setThresholdPct(parseFloat(e.target.value))} />
                <FeatureBadges featureConfig={featureConfig} setFeatureConfig={setFeatureConfig} playClick={playClick} />
              </div> : <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.7rem' }}>{isSimpleMode ? `${horizonHours}h stack horizon · ${Object.values(featureConfig).filter(Boolean).length} data groups watching` : `${horizonHours}h forecast · ±${(thresholdPct * 100).toFixed(2)}% boundary · ${Object.values(featureConfig).filter(Boolean).length} data groups active`}</div>}
          </>
          <button onClick={() => { playClick(); handleTrain(); }} disabled={trainLoading || cooldownRemaining > 0} className="btn-recalibrate">
            {trainLoading ? <><span className="chart-loading-spinner" style={{ marginRight: '0.5rem' }} />Calibrating...</> : cooldownRemaining > 0 ? `Wait ${Math.ceil(cooldownRemaining / 60000)}m` : isSimpleMode ? 'Retune all horizons' : 'Calibrate'}
          </button>
          {trainLoading && <div className="train-progress"><div className="train-progress-bar" /></div>}
          <div style={{ marginTop: '0.8rem', paddingTop: '0.65rem', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.78rem', fontWeight: 700 }}><Clock size={13} /> {isSimpleMode ? 'Last chain check' : 'Last data received'}</div>
            {freshnessRows.length ? freshnessRows.map(([key, value]) => <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}><span>{formatKey(key)}</span><span>{formatTime(value)}</span></div>) : <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>No freshness data yet.</div>}
          </div>
        </div>
      </section>

      {!isSimpleMode && allInactive.length > 0 && (
        <section className="card">
          <div className="card-header" style={{ marginBottom: '0.5rem' }}>
            <h2><Activity className="w-4 h-4 text-blue-400" />Inactive Widgets</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {allInactive.map(id => (
              <InactiveWidgetRow key={id} id={id} isMinimized={minimizedWidgets?.includes(id)}
                icon={WIDGET_ICONS[id]} name={WIDGET_NAMES[id] || id} onRestore={() => restoreWidget(id)} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
