import React from 'react';
import {
  EmaPill,
  IndPill,
  Sep,
  CrosshairTooltip,
  OHLCBar,
  IndicatorLegend
} from './ChartSubComponents';
import { LiqProfilePanel } from './LiqProfilePanel';

// ── Chart Controls ────────────────────────────────────────────────────────────
export function ChartControls({ timeframe, setTF, activeEMAs, toggleEMA, showBB, setBB, showRSI, setRSI, showVWAP, setVWAP, showLiqMap, setLiqMap, showPredLines, setPredLines, loading, err, loadingMore, rangePreset, setRangePreset }) {
  return (
    <div className="chart-controls">
      {/* Row 1 — timeframe + LIVE badge */}
      <div className="chart-controls__row chart-controls__row--tf">
        <span className="chart-controls__label">Timeframe</span>
        <div className="chart-controls__group">
          {['1h', '4h', '1d', '1w'].map(tf => (
            <button
              key={tf}
              onClick={() => setTF(tf)}
              className={`tf-pill${timeframe === tf ? ' tf-pill--active' : ''}`}
            >
              {tf.toUpperCase()}
            </button>
          ))}
        </div>
        <Sep />
        <span className="chart-controls__label">Range</span>
        <div className="chart-controls__group">
          {['3D', '7D', '1M', 'ALL'].map(r => (
            <button
              key={r}
              onClick={() => setRangePreset(r)}
              className={`tf-pill${rangePreset === r ? ' tf-pill--active' : ''}`}
            >
              {r}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {loadingMore && (
            <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span className="chart-loading-spinner" style={{ width: 8, height: 8 }} />
              Loading history…
            </span>
          )}
          {!loading && !err && (
            <div className="chart-live-badge">
              <span className="live-dot" />LIVE · Binance WS
            </div>
          )}
        </div>
      </div>

      {/* Row 2 — indicator toggles */}
      <div className="chart-controls__row chart-controls__row--ind">
        <span className="chart-controls__label">Indicators</span>
        <span className="chart-controls__sublabel">EMA</span>
        <div className="chart-controls__group">
          {[9, 21, 50, 100, 200].map(p => (
            <EmaPill key={p} period={p} active={activeEMAs.includes(p)} onClick={() => toggleEMA(p)} />
          ))}
        </div>
        <Sep />
        <div className="chart-controls__group">
          <IndPill active={showBB}        onClick={() => setBB(b => !b)}         title="Bollinger Bands (20, 2σ)"  accent="rgba(139,92,246,0.9)">BB</IndPill>
          <IndPill active={showVWAP}      onClick={() => setVWAP(v => !v)}       title="Volume Weighted Average Price" accent="#38bdf8">VWAP</IndPill>
          <IndPill active={showRSI}       onClick={() => setRSI(r => !r)}        title="RSI (14) sub-panel"        accent="#818cf8">RSI</IndPill>
          <IndPill active={showPredLines} onClick={() => setPredLines(p => !p)}  title="Prediction ±% lines"      accent="rgba(16,185,129,0.9)">PRED</IndPill>
          <IndPill active={showLiqMap}    onClick={() => setLiqMap(l => !l)}     title="Liquidation Heatmap"      accent="rgba(251,191,36,0.9)">LIQ</IndPill>
        </div>
      </div>
    </div>
  );
}


// ── Chart Header (OHLC bar) ───────────────────────────────────────────────────
export function ChartHeader({ ohlc, price }) {
  if (!ohlc || !price) return <div className="ohlc-bar ohlc-bar--skeleton" />;
  return <OHLCBar ohlc={ohlc} price={price} />;
}

// ── Main Chart Area ───────────────────────────────────────────────────────────
export function MainChartArea({ mainRef, loading, err, activeEMAs, showBB, chartRef, predictionData, showLiqMap, displayPrice, visibleRange }) {
  const snapshot = predictionData?.market_snapshot;
  const hasProfile = showLiqMap && (snapshot?.liq_heatmap || snapshot?.liquidation_proximity) && !loading && !err;

  return (
    // Outer row: chart pane + liquidation profile panel side-by-side
    <div style={{ display: 'flex', flexDirection: 'row', flexGrow: 1, minHeight: '300px', width: '100%', overflow: 'hidden' }}>

      {/* Chart pane — fills remaining width, resizes automatically via ResizeObserver */}
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <IndicatorLegend activeEMAs={activeEMAs} showBB={showBB} />
        <CrosshairTooltip chartRef={chartRef} />
        {loading && (
          <div className="chart-overlay">
            <span className="chart-loading-spinner" />
            <span style={{ marginLeft: '.5rem', fontSize: '.75rem', color: 'var(--text-secondary)' }}>
              Connecting to Binance…
            </span>
          </div>
        )}
        {err && (
          <div className="chart-overlay" style={{ color: '#f43f5e', fontSize: '.75rem' }}>⚠ {err}</div>
        )}
        <div
          ref={mainRef}
          style={{ position: 'absolute', inset: 0, opacity: loading || err ? 0 : 1, transition: 'opacity 0.4s' }}
        />
      </div>

      {/* Liquidation profile panel — sibling, not overlay */}
      {hasProfile && (
        <LiqProfilePanel predictionData={predictionData} currentPrice={displayPrice} visibleRange={visibleRange} />
      )}
    </div>
  );
}

// ── RSI Sub-panel ─────────────────────────────────────────────────────────────
export function RsiPanel({ rsiRef, rsiHeight, handleDragStart }) {
  return (
    <div className="rsi-panel">
      <div
        className="rsi-panel__handle"
        onMouseDown={handleDragStart}
        title="Drag to resize RSI panel"
        role="separator"
        aria-orientation="horizontal"
      />
      <div className="rsi-panel__label">
        RSI (14)
        <span className="rsi-panel__ob"> 70 OB</span>
        <span className="rsi-panel__sep"> / </span>
        <span className="rsi-panel__os"> 30 OS</span>
      </div>
      <div ref={rsiRef} style={{ width: '100%', height: `${rsiHeight}px` }} />
    </div>
  );
}
