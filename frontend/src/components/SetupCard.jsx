import React, { useState } from 'react';
import { Sliders, Activity, PanelLeftClose, PanelRightClose, ChevronDown, ChevronUp } from 'lucide-react';
import { WIDGET_NAMES, allInactiveIds, InactiveWidgetRow, InactiveIconBtn } from './WidgetTray.jsx';
import { LineChart, ShieldCheck, Settings, Zap } from 'lucide-react';

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
  thresholdPct, setThresholdPct, featureConfig, setFeatureConfig,
  trainLoading, handleTrain, playClick, collapsed, toggleCollapse,
  hiddenWidgets, minimizedWidgets, restoreWidget,
}) {
  const [expanded, setExpanded] = useState(true);
  const allInactive = allInactiveIds(hiddenWidgets, minimizedWidgets);

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
          <h2><Sliders className="w-4 h-4 text-blue-500" />Projections Setup</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <button onClick={toggleCollapse} className="btn-icon" title="Collapse Sidebar"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '2px' }}>
              <PanelLeftClose size={16} />
            </button>
          </div>
        </div>
        <div style={{ marginTop: '0.5rem' }}>
          {!isSimpleMode && (
            <>
              <SliderRow label="Horizon Hours"     display={`${horizonHours}h`}                   min="4"     max="168" step="4"     value={horizonHours}  onChange={e => setHorizonHours(parseInt(e.target.value))} />
              <SliderRow label="Volatility Boundary" display={`${(thresholdPct * 100).toFixed(2)}%`} min="0.001" max="0.03" step="0.001" value={thresholdPct} onChange={e => setThresholdPct(parseFloat(e.target.value))} />
              <FeatureBadges featureConfig={featureConfig} setFeatureConfig={setFeatureConfig} playClick={playClick} />
            </>
          )}
          <button onClick={() => { playClick(); handleTrain(); }} disabled={trainLoading} className="btn-recalibrate">
            {trainLoading ? <><span className="chart-loading-spinner" style={{ marginRight: '0.5rem' }} />Calibrating...</> : 'Recalibrate Model'}
          </button>
          {trainLoading && <div className="train-progress"><div className="train-progress-bar" /></div>}
        </div>
      </section>

      {allInactive.length > 0 && (
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
