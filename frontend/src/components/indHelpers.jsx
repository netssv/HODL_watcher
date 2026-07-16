import React from 'react';

export const fmtNum = (n, d = 2) => (n != null && !isNaN(n) ? Number(n).toFixed(d) : 'N/A');

export function trendArrow(trend) {
  if (!trend) return null;
  const t = String(trend).toLowerCase();
  if (t === 'rising') return <span className="ind-trend ind-trend--up">↑</span>;
  if (t === 'falling') return <span className="ind-trend ind-trend--down">↓</span>;
  return <span className="ind-trend ind-trend--flat">→</span>;
}

export function numTrend(val, neutral = 0, invertColor = false) {
  if (val == null || (typeof val === 'number' && isNaN(val))) return null;
  const up = val > neutral;
  const cls = invertColor
    ? (up ? 'ind-trend--down' : 'ind-trend--up')
    : (up ? 'ind-trend--up' : 'ind-trend--down');
  return <span className={`ind-trend ${cls}`}>{up ? '↑' : '↓'}</span>;
}

export function InfoExpander({ definition }) {
  return (
    <details className="ind-info">
      <summary>What is this?</summary>
      <div className="ind-info-body">{definition}</div>
    </details>
  );
}

export function IndicatorCard({ label, value, valueCls = '', gloss, trend, definition }) {
  return (
    <div className="ind-card">
      <span className="ind-label">{label}</span>
      <div className={`ind-value ${valueCls}`}>
        {value}
        {trend}
      </div>
      {gloss && <p className="ind-gloss">{gloss}</p>}
      {definition && <InfoExpander definition={definition} />}
    </div>
  );
}

export function IndicatorGroup({ title, cols, children }) {
  return (
    <div className="indicator-group">
      <div className="indicator-group-header">
        <span className="indicator-group-label">{title}</span>
      </div>
      <div className={`indicator-card-grid indicator-card-grid--${cols}`}>
        {children}
      </div>
    </div>
  );
}
