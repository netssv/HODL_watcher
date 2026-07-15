import React from 'react';
import { EMA_COLORS } from '../utils/chartFactory';

const Pill = ({ active, onClick, title, children }) => (
  <button onClick={onClick} title={title} style={{
    padding: '2px 7px', fontSize: '0.62rem', borderRadius: '4px', cursor: 'pointer',
    transition: 'all 0.15s', fontWeight: active ? 700 : 400,
    backgroundColor: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
    color: active ? '#a5b4fc' : 'var(--text-secondary)',
    border: `1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
  }}>{children}</button>
);

const Sep = () => <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }} />;

function OHLCBar({ ohlc, price }) {
  const up  = price >= ohlc.open;
  const fmt = n => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—';
  const clr = up ? '#10b981' : '#f43f5e';
  return (
    <div className="ohlc-bar">
      <span className="ohlc-pair">BTC / USDT</span>
      <span className="ohlc-price" style={{ color: clr }}>{fmt(price)}</span>
      <span className="ohlc-change" style={{ color: clr }}>
        {up ? '+' : ''}{fmt(price - ohlc.open)} ({((price - ohlc.open) / ohlc.open * 100).toFixed(2)}%)
      </span>
      {['open', 'high', 'low', 'close'].map(k => (
        <span key={k} className="ohlc-cell">
          <span className="ohlc-label">{k[0].toUpperCase()}</span>{fmt(ohlc[k])}
        </span>
      ))}
    </div>
  );
}

export function ChartControls({ timeframe, setTF, activeEMAs, toggleEMA, showBB, setBB, showRSI, setRSI, loading, err }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <span style={{ fontSize: '0.58rem', color: 'var(--text-primary)' }}>Timeframe:</span>
        {['1h', '4h', '1d', '1w'].map(tf => (
          <Pill key={tf} active={timeframe === tf} onClick={() => setTF(tf)}>{tf.toUpperCase()}</Pill>
        ))}
        {!loading && !err && (
          <div className="chart-live-badge" style={{ marginLeft: 'auto' }}>
            <span className="live-dot" />LIVE · Binance WS
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', padding: '0.4rem 0.75rem' }}>
        <span style={{ fontSize: '0.58rem', color: 'var(--text-primary)' }}>Indicators:</span>
        <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)', marginLeft: '0.2rem' }}>EMA</span>
        {[9, 21, 50, 100, 200].map(p => (
          <Pill key={p} active={activeEMAs.includes(p)} onClick={() => toggleEMA(p)} title={`EMA ${p}`}>{p}</Pill>
        ))}
        <Sep />
        <Pill active={showBB}  onClick={() => setBB(b => !b)}  title="Bollinger Bands (20, 2σ)">BB</Pill>
        <Pill active={showRSI} onClick={() => setRSI(r => !r)} title="RSI (14) sub-panel">RSI</Pill>
      </div>
    </div>
  );
}

export function ChartHeader({ ohlc, price }) {
  if (!ohlc || !price) return <div className="ohlc-bar ohlc-bar--skeleton" />;
  return <OHLCBar ohlc={ohlc} price={price} />;
}

export function MainChartArea({ mainRef, loading, err, activeEMAs }) {
  return (
    <div style={{ position: 'relative', flexGrow: 1, minHeight: '300px' }}>
      {activeEMAs.length > 0 && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, display: 'flex', gap: '8px', pointerEvents: 'none' }}>
          {activeEMAs.map(p => (
            <span key={p} style={{ fontSize: '0.6rem', color: EMA_COLORS[p], fontWeight: 600, textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
              EMA {p}
            </span>
          ))}
        </div>
      )}
      {loading && <div className="chart-overlay"><span className="chart-loading-spinner" /><span style={{ marginLeft: '.5rem', fontSize: '.75rem', color: 'var(--text-secondary)' }}>Connecting to Binance…</span></div>}
      {err     && <div className="chart-overlay" style={{ color: '#f43f5e', fontSize: '.75rem' }}>⚠ {err}</div>}
      <div ref={mainRef} style={{ width: '100%', height: '100%', opacity: loading || err ? 0 : 1, transition: 'opacity 0.4s' }} />
    </div>
  );
}

export function RsiPanel({ rsiRef, rsiHeight, handleDragStart }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div onMouseDown={handleDragStart} title="Drag to resize"
        style={{ height: '6px', cursor: 'row-resize', backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }} />
      <div style={{ padding: '2px 8px', fontSize: '0.55rem', color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
        RSI (14) — <span style={{ color: '#f43f5e' }}>70 OB</span> / <span style={{ color: '#10b981' }}>30 OS</span>
      </div>
      <div ref={rsiRef} style={{ width: '100%', height: `${rsiHeight}px` }} />
    </div>
  );
}
