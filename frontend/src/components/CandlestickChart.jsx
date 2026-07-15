import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2 } from 'lucide-react';
import { buildBaseChart, applyCandles, applyVolume, applyEMA, applyBB, applyRSIChart } from '../utils/chartFactory';

// ── Small UI atoms ────────────────────────────────────────────────────────────
const Pill = ({ active, onClick, title, children }) => (
  <button onClick={onClick} title={title} style={{
    padding: '2px 7px', fontSize: '0.62rem', borderRadius: '4px', cursor: 'pointer',
    transition: 'all 0.15s', fontWeight: active ? 700 : 400,
    backgroundColor: active ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
    color: active ? '#a5b4fc' : 'var(--text-secondary)',
    border: `1px solid ${active ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
  }}>{children}</button>
);

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
      {['open','high','low','close'].map(k => (
        <span key={k} className="ohlc-cell">
          <span className="ohlc-label">{k[0].toUpperCase()}</span>{fmt(ohlc[k])}
        </span>
      ))}
    </div>
  );
}

// ── Main chart component ──────────────────────────────────────────────────────
export default function CandlestickChart({ isSimpleMode, predictionData, thresholdPct, globalLivePrice }) {
  const mainRef = useRef(), rsiRef = useRef();
  const chartRef = useRef(null), rsiChartRef = useRef(null);
  const candleSerRef = useRef(null), volSerRef = useRef(null);

  const [ohlc, setOhlc]       = useState(null);
  const [timeframe, setTF]    = useState('1h');
  const [emaPeriod, setEMA]   = useState(0);
  const [showBB, setBB]       = useState(false);
  const [showRSI, setRSI]     = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  const displayPrice = globalLivePrice ?? ohlc?.close ?? null;
  const darkMode = !isSimpleMode;

  // Teardown helper
  const teardown = () => {
    chartRef.current?.remove();    chartRef.current = null;
    rsiChartRef.current?.remove(); rsiChartRef.current = null;
    candleSerRef.current = null;   volSerRef.current = null;
  };

  // Build / rebuild all chart layers
  const buildAll = useCallback((data, fullscreenMode = false) => {
    teardown();
    if (!mainRef.current || !data.length) return;

    const chartHeight = fullscreenMode ? window.innerHeight - (showRSI ? 180 : 60) : (showRSI ? 400 : 480);
    const chart = buildBaseChart(mainRef.current, chartHeight, darkMode);
    candleSerRef.current = applyCandles(chart, data, predictionData, thresholdPct);
    volSerRef.current    = applyVolume(chart, data);
    if (emaPeriod) applyEMA(chart, data, emaPeriod);
    if (showBB)    applyBB(chart, data);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    if (showRSI && rsiRef.current)
      rsiChartRef.current = applyRSIChart(rsiRef.current, chart, data, darkMode);
  }, [darkMode, predictionData, thresholdPct, emaPeriod, showBB, showRSI]);

  // Fetch klines + open WebSocket
  useEffect(() => {
    let active = true;
    let ws = null;

    const load = async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${timeframe}&limit=200`);
        if (!res.ok) throw new Error('Binance fetch failed');
        const data = (await res.json()).map(d => ({
          time: Math.floor(d[0] / 1000),
          open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5],
        })).sort((a, b) => a.time - b.time);

        if (!active) return;
        setOhlc(data.at(-1));
        buildAll(data, isFullscreen);

        ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${timeframe}`);
        ws.onmessage = ({ data: raw }) => {
          if (!active || !candleSerRef.current) return;
          const k = JSON.parse(raw).k;
          const c = { time: Math.floor(k.t/1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
          candleSerRef.current.update(c);
          volSerRef.current?.update({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)' });
          setOhlc(p => p ? { ...p, high: c.high, low: c.low, close: c.close } : c);
        };
        setLoading(false);
      } catch (e) { if (active) { setErr(e.message); setLoading(false); } }
    };

    load();
    const onResize = () => {
      if (mainRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: mainRef.current.clientWidth });
      }
      if (rsiRef.current  && rsiChartRef.current) rsiChartRef.current.applyOptions({ width: rsiRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => { active = false; ws?.close(); window.removeEventListener('resize', onResize); teardown(); };
  }, [timeframe, buildAll, isFullscreen]);

  // ── JSX ───────────────────────────────────────────────────────────────────
  const Div = () => <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-color)', margin: '0 0.2rem' }} />;

  const content = (
    <section className="card" style={{ padding: 0, overflow: 'hidden', height: isFullscreen ? '100vh' : 'auto', borderRadius: isFullscreen ? 0 : '3px' }}>
      {/* Controls bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
        {['1h','4h','1d','1w'].map(tf => <Pill key={tf} active={timeframe===tf} onClick={() => setTF(tf)}>{tf.toUpperCase()}</Pill>)}
        <Div />
        <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>EMA:</span>
        {[0,9,21,50].map(p => <Pill key={p} active={emaPeriod===p} onClick={() => setEMA(emaPeriod===p ? 0 : p)} title={p ? `EMA ${p}` : 'Off'}>{p || 'Off'}</Pill>)}
        <Div />
        <Pill active={showBB}  onClick={() => setBB(b => !b)}  title="Bollinger Bands (20, 2σ)">BB</Pill>
        <Pill active={showRSI} onClick={() => setRSI(r => !r)} title="RSI (14) sub-panel">RSI</Pill>
        
        <button onClick={() => setIsFullscreen(f => !f)} className="sidebar-icon-btn" style={{ marginLeft: 'auto', width: 26, height: 26 }} title="Toggle Fullscreen">
          {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
        </button>
        {!loading && !err && <div className="chart-live-badge"><span className="live-dot" />LIVE · Binance WS</div>}
      </div>

      {/* OHLC header */}
      {ohlc && displayPrice ? <OHLCBar ohlc={ohlc} price={displayPrice} /> : <div className="ohlc-bar ohlc-bar--skeleton" />}

      {/* Main chart */}
      <div style={{ position: 'relative' }}>
        {loading && <div className="chart-overlay"><span className="chart-loading-spinner" /><span style={{ marginLeft: '.5rem', fontSize: '.75rem', color: 'var(--text-secondary)' }}>Connecting to Binance…</span></div>}
        {err     && <div className="chart-overlay" style={{ color: '#f43f5e', fontSize: '.75rem' }}>⚠ {err}</div>}
        <div ref={mainRef} style={{ width: '100%', opacity: loading || err ? 0 : 1, transition: 'opacity 0.4s' }} />
      </div>

      {/* RSI sub-panel */}
      {showRSI && (
        <div style={{ borderTop: '1px solid var(--border-color)' }}>
          <div style={{ padding: '2px 8px', fontSize: '0.55rem', color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
            RSI (14) — <span style={{ color: '#f43f5e' }}>70 OB</span> / <span style={{ color: '#10b981' }}>30 OS</span>
          </div>
          <div ref={rsiRef} style={{ width: '100%', minHeight: '120px' }} />
        </div>
      )}
    </section>
  );

  if (isFullscreen) {
    return createPortal(
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 9999, backgroundColor: 'var(--bg-card)',
        display: 'flex', flexDirection: 'column'
      }}>
        {content}
      </div>,
      document.body
    );
  }
  return content;
}
