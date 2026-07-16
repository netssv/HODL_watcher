import React, { useEffect, useState } from 'react';
import { EMA_COLORS } from '../utils/chartFactory';

// ── Formatting helpers ────────────────────────────────────────────────────────
export const fmtPrice = n =>
  n == null ? '—' :
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtTime = (unixSec) => {
  if (!unixSec) return '—';
  const d = new Date(unixSec * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
         `  ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
};

// ── EMA Pill — color-keyed active border ─────────────────────────────────────
export function EmaPill({ period, active, onClick }) {
  const accent = EMA_COLORS[period] ?? '#facc15';
  return (
    <button
      onClick={onClick}
      title={`EMA ${period}`}
      className={`indicator-pill${active ? ' indicator-pill--active' : ''}`}
      style={active ? {
        '--pill-accent': accent,
        borderColor: accent,
        color: accent,
        backgroundColor: `${accent}1a`,
        boxShadow: `0 0 0 1px ${accent}55, inset 0 0 6px ${accent}22`,
      } : {}}
    >
      {period}
    </button>
  );
}

// ── Generic Indicator Pill ────────────────────────────────────────────────────
export function IndPill({ active, onClick, title, accent = 'var(--accent-brand)', children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`indicator-pill${active ? ' indicator-pill--active' : ''}`}
      style={active ? {
        borderColor: accent,
        color: accent,
        backgroundColor: `${accent}1a`,
        boxShadow: `0 0 0 1px ${accent}55`,
      } : {}}
    >
      {children}
    </button>
  );
}

export const Sep = () => (
  <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 0.2rem', flexShrink: 0 }} />
);

// ── Crosshair OHLC Tooltip ────────────────────────────────────────────────────
export function CrosshairTooltip({ chartRef }) {
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const chart = chartRef?.current;
    if (!chart) return;

    const handler = (param) => {
      if (!param.time || !param.seriesData?.size) {
        setTip(null);
        return;
      }
      const [, bar] = [...param.seriesData.entries()][0];
      if (!bar) { setTip(null); return; }

      setTip({
        time:  param.time,
        open:  bar.open,
        high:  bar.high,
        low:   bar.low,
        close: bar.close,
      });
    };

    chart.subscribeCrosshairMove(handler);
    return () => chart.unsubscribeCrosshairMove(handler);
  }, [chartRef?.current]);

  if (!tip) return null;

  const isUp = tip.close >= tip.open;
  const clr  = isUp ? 'var(--up-color)' : 'var(--down-color)';
  const change = ((tip.close - tip.open) / tip.open * 100);

  return (
    <div className="crosshair-tooltip" aria-live="polite">
      <span className="crosshair-tooltip__time">{fmtTime(tip.time)}</span>
      <div className="crosshair-tooltip__ohlc">
        <span className="crosshair-tooltip__cell">
          <span className="crosshair-tooltip__key">O</span>
          <span className="crosshair-tooltip__val">{fmtPrice(tip.open)}</span>
        </span>
        <span className="crosshair-tooltip__cell">
          <span className="crosshair-tooltip__key">H</span>
          <span className="crosshair-tooltip__val" style={{ color: 'var(--up-color)' }}>{fmtPrice(tip.high)}</span>
        </span>
        <span className="crosshair-tooltip__cell">
          <span className="crosshair-tooltip__key">L</span>
          <span className="crosshair-tooltip__val" style={{ color: 'var(--down-color)' }}>{fmtPrice(tip.low)}</span>
        </span>
        <span className="crosshair-tooltip__cell">
          <span className="crosshair-tooltip__key">C</span>
          <span className="crosshair-tooltip__val" style={{ color: clr }}>{fmtPrice(tip.close)}</span>
        </span>
        <span className="crosshair-tooltip__change" style={{ color: clr }}>
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

// ── OHLC header (live price bar) ──────────────────────────────────────────────
export function OHLCBar({ ohlc, price }) {
  const up  = price >= ohlc.open;
  const clr = up ? 'var(--up-color)' : 'var(--down-color)';
  const pnl = price - ohlc.open;
  const pct = (pnl / ohlc.open * 100).toFixed(2);
  return (
    <div className="ohlc-bar">
      <span className="ohlc-pair">BTC / USDT</span>
      <span className="ohlc-price" style={{ color: clr }}>{fmtPrice(price)}</span>
      <span className="ohlc-change" style={{ color: clr }}>
        {up ? '+' : ''}{fmtPrice(pnl)} ({up ? '+' : ''}{pct}%)
      </span>
      {['open', 'high', 'low', 'close'].map(k => (
        <span key={k} className="ohlc-cell">
          <span className="ohlc-label">{k[0].toUpperCase()}</span>{fmtPrice(ohlc[k])}
        </span>
      ))}
    </div>
  );
}

// ── Active Indicator Legend ───────────────────────────────────────────────────
export function IndicatorLegend({ activeEMAs, showBB }) {
  if (!activeEMAs.length && !showBB) return null;
  return (
    <div className="indicator-legend" aria-label="Active indicators">
      {activeEMAs.map(p => (
        <span key={p} className="indicator-legend__item" style={{ '--leg-color': EMA_COLORS[p] ?? '#facc15' }}>
          <span className="indicator-legend__swatch" />
          EMA {p}
        </span>
      ))}
      {showBB && (
        <span className="indicator-legend__item" style={{ '--leg-color': 'rgba(139,92,246,0.9)' }}>
          <span className="indicator-legend__swatch indicator-legend__swatch--dashed" />
          BB (20,2σ)
        </span>
      )}
    </div>
  );
}
