import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { CandlestickSeries, HistogramSeries, LineSeries, createChart, createSeriesMarkers } from 'lightweight-charts';
import { usePracticeSession } from '../hooks/usePracticeSession.js';
import { calcVWAP } from '../utils/chartMath';

const API = 'https://api.binance.com/api/v3/klines';
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');
const parse = raw => raw.map(x => ({ time: Math.floor(x[0] / 1000), open: +x[1], high: +x[2], low: +x[3], close: +x[4], volume: +x[5] }));
const SCENARIOS = { day: { label: 'Daily · 1 day', days: 1 }, short: { label: 'Short · 3 days', days: 3 }, medium: { label: 'Medium · 7 days', days: 7 }, month: { label: 'Month · 30 days', days: 30 } };
const TIMEFRAMES = { '15m': 'Scalping · 15m', '1h': '1 hour', '4h': '4 hours', '1d': '1 day' };
const timeframeHours = { '15m': 0.25, '1h': 1, '4h': 4, '1d': 24 };
const EMA_PERIODS = [20, 35, 50, 200];
const EMA_COLORS = { 20: '#f59e0b', 35: '#a78bfa', 50: '#34d399', 200: '#f43f5e' };
const Help = ({ text }) => <span title={text} aria-label={text} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 17, height: 17, marginLeft: 4, border: '1px solid var(--text-secondary)', borderRadius: '50%', fontSize: 11, cursor: 'help' }}>?</span>;

export default function PracticeView({ onExit }) {
  const [mode, setMode] = useState('hodl');
  const [candles, setCandles] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadedData, setLoadedData] = useState([]);
  const [scenarioStart, setScenarioStart] = useState(0);
  const [warmupCandles, setWarmupCandles] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [running, setRunning] = useState(false);
  const [cash, setCash] = useState(1000);
  const [btc, setBtc] = useState(0);
  const [trades, setTrades] = useState([]);
  const [sizePct, setSizePct] = useState(25);
  const [manualAmount, setManualAmount] = useState('');
  const [direction, setDirection] = useState('long');
  const [leverage, setLeverage] = useState(1);
  const [slPct, setSlPct] = useState('');
  const [tpPct, setTpPct] = useState('');
  const [slType, setSlType] = useState('percent');
  const [tpType, setTpType] = useState('percent');
  const [position, setPosition] = useState(null);
  const [scenario, setScenario] = useState('medium');
  const [timeframe, setTimeframe] = useState('1h');
  const [showVWAP, setShowVWAP] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [practiceContext, setPracticeContext] = useState([]);
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem('hodl-practice-welcome-seen') !== '1');
  const [showProTip, setShowProTip] = useState(() => localStorage.getItem('hodl-practice-pro-tip-seen') !== '1');
  const chartRef = useRef(null);
  const chartNodeRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const indicatorSeriesRef = useRef({ emas: {}, upper: null, lower: null, vwap: null, volume: null });
  const markersRef = useRef(null);
  const initialViewportKeyRef = useRef('');
  const session = usePracticeSession(candles, 1, history.length);

  const loadScenario = async () => {
    setLoadError('');
    const maxLength = Math.ceil(30 * 24 / timeframeHours[timeframe]);
    const warmup = Math.ceil(365 * 24 / timeframeHours[timeframe]);
    const required = warmup + maxLength;
    const fetchTarget = required + maxLength;
    let data = [];
    while (data.length < fetchTarget) {
      const end = data.length ? `&endTime=${data[0].time * 1000 - 1}` : '';
      const res = await fetch(`${API}?symbol=BTCUSDT&interval=${timeframe}&limit=${Math.min(1000, fetchTarget - data.length)}${end}`);
      if (!res.ok) throw new Error(`Binance returned HTTP ${res.status}`);
      const page = parse(await res.json());
      if (!page.length) break;
      data = [...page, ...data];
      if (page.length < 1000) break;
    }
    if (data.length < required) throw new Error(`Not enough historical ${timeframe} data for the ${SCENARIOS[scenario].days}-day scenario.`);
    const start = warmup + Math.floor(Math.random() * (data.length - warmup - maxLength + 1));
    setLoadedData(data);
    setScenarioStart(start);
    setWarmupCandles(warmup);
    setRunning(false); setCash(1000); setBtc(0); setTrades([]); setPosition(null);
  };
  useEffect(() => { loadScenario().catch(error => setLoadError(error.message)); }, [timeframe]);
  useEffect(() => {
    fetch(`${API_BASE}/api/practice/context`)
      .then(response => response.ok ? response.json() : Promise.reject(new Error('context unavailable')))
      .then(payload => setPracticeContext(payload.data ?? []))
      .catch(() => setPracticeContext([]));
  }, []);
  useEffect(() => {
    if (!loadedData.length) return;
    const length = Math.ceil(SCENARIOS[scenario].days * 24 / timeframeHours[timeframe]);
    const preRoll = loadedData.slice(Math.max(0, scenarioStart - warmupCandles), scenarioStart);
    setHistory(preRoll);
    setCandles([...preRoll, ...loadedData.slice(scenarioStart, scenarioStart + length)]);
  }, [scenario, loadedData, scenarioStart, warmupCandles]);
  useEffect(() => { if (candles.length) session.resetSession(); }, [candles, session.resetSession]);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(session.advanceCandle, 2000);
    return () => clearInterval(timer);
  }, [running, session.advanceCandle]);

  useEffect(() => {
    if (!chartNodeRef.current) return undefined;
    chartRef.current?.remove();
    const chart = createChart(chartNodeRef.current, {
      height: Math.max(480, Math.floor(window.innerHeight * 0.65)),
      layout: { background: { color: '#0a0d12' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: 'rgba(148,163,184,0.08)' }, horzLines: { color: 'rgba(148,163,184,0.08)' } },
      timeScale: { timeVisible: true, rightOffset: 4 },
    });
    chartRef.current = chart;
    candleSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981', downColor: '#f43f5e', borderVisible: false,
      wickUpColor: '#10b981', wickDownColor: '#f43f5e',
    });
    EMA_PERIODS.forEach(period => {
      indicatorSeriesRef.current.emas[period] = chart.addSeries(LineSeries, { color: EMA_COLORS[period], lineWidth: period === 20 ? 2 : 1, title: `EMA ${period}` });
    });
    indicatorSeriesRef.current.upper = chart.addSeries(LineSeries, { color: 'rgba(96,165,250,0.65)', lineWidth: 1, lineStyle: 2, title: 'BB upper' });
    indicatorSeriesRef.current.lower = chart.addSeries(LineSeries, { color: 'rgba(96,165,250,0.65)', lineWidth: 1, lineStyle: 2, title: 'BB lower' });
    indicatorSeriesRef.current.vwap = chart.addSeries(LineSeries, { color: '#38bdf8', lineWidth: 2, title: 'VWAP — volume-weighted average price' });
    indicatorSeriesRef.current.volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' }, priceScaleId: 'volume', title: 'Volume',
      color: 'rgba(148,163,184,0.35)',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    markersRef.current = createSeriesMarkers(candleSeriesRef.current, []);
    return () => { chart.remove(); chartRef.current = null; candleSeriesRef.current = null; };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current || !candles.length) return;
    candleSeriesRef.current.setData(candles.slice(0, session.candleIndex + 1));
    const source = candles.slice(0, session.candleIndex + 1);
    const closes = source.map(c => c.close);
    const ema = Object.fromEntries(EMA_PERIODS.map(period => [period, []]));
    const upper = []; const lower = [];
    const previous = Object.fromEntries(EMA_PERIODS.map(period => [period, null]));
    source.forEach((candle, index) => {
      const window = closes.slice(Math.max(0, index - 19), index + 1);
      const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
      const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length;
      EMA_PERIODS.forEach(period => {
        previous[period] = previous[period] === null ? mean : (candle.close * (2 / (period + 1))) + (previous[period] * (1 - 2 / (period + 1)));
        ema[period].push({ time: candle.time, value: previous[period] });
      });
      upper.push({ time: candle.time, value: mean + 2 * Math.sqrt(variance) });
      lower.push({ time: candle.time, value: mean - 2 * Math.sqrt(variance) });
    });
    EMA_PERIODS.forEach(period => indicatorSeriesRef.current.emas[period]?.setData(ema[period]));
    indicatorSeriesRef.current.upper?.setData(upper);
    indicatorSeriesRef.current.lower?.setData(lower);
    indicatorSeriesRef.current.vwap?.setData(showVWAP ? calcVWAP(source) : []);
    indicatorSeriesRef.current.volume?.setData(showVolume ? source.map(c => ({
      time: c.time, value: c.volume ?? 0,
      color: c.close >= c.open ? 'rgba(16,185,129,0.42)' : 'rgba(244,63,94,0.42)',
    })) : []);
    markersRef.current?.setMarkers(trades.filter(t => t.candleIndex <= session.candleIndex).map(t => ({
      time: t.timestamp ? Math.floor(new Date(t.timestamp).getTime() / 1000) : candles[t.candleIndex]?.time,
      position: t.side === 'sell' || t.side === 'close' || t.side === 'short' ? 'aboveBar' : 'belowBar',
      color: t.side === 'sell' || t.side === 'close' || t.side === 'short' ? '#f43f5e' : '#10b981',
      shape: t.side === 'sell' || t.side === 'close' || t.side === 'short' ? 'arrowDown' : 'arrowUp',
      text: t.side.toUpperCase(),
      size: 2,
    })) || []);
    // Position a new scenario at the decision candle once. After that, the
    // user's pan/zoom is authoritative; replay updates must not move it.
    const viewportKey = `${candles[0]?.time ?? ''}:${candles.length}:${history.length}`;
    if (session.candleIndex === history.length && initialViewportKeyRef.current !== viewportKey) {
      chartRef.current?.timeScale().scrollToRealTime();
      initialViewportKeyRef.current = viewportKey;
    }
  }, [candles, history, session.candleIndex, trades, showVWAP, showVolume]);

  const price = session.candle?.close || 0;
  const context = session.candle ? practiceContext.reduce((best, point) =>
    !best || Math.abs(new Date(point.timestamp) - session.candle.time * 1000) < Math.abs(new Date(best.timestamp) - session.candle.time * 1000) ? point : best, null) : null;
  const contextGuidance = context?.fear_greed >= 75 ? 'Extreme greed — avoid chasing strength.' : context?.fear_greed <= 24 ? 'Extreme fear — volatility and liquidation risk are elevated.' : context?.dxy && context.dxy > 105 ? 'Strong dollar — BTC may face macro pressure.' : 'Macro context is neutral.';
  const notional = Math.min(Number(manualAmount) || cash * sizePct / 100, cash);
  const quantity = price ? notional * (mode === 'pro' ? leverage : 1) / price : 0;
  const stopPrice = slPct ? (slType === 'price' ? Number(slPct) : price * (direction === 'short' ? 1 + Number(slPct) / 100 : 1 - Number(slPct) / 100)) : null;
  const takePrice = tpPct ? (tpType === 'price' ? Number(tpPct) : price * (direction === 'short' ? 1 - Number(tpPct) / 100 : 1 + Number(tpPct) / 100)) : null;
  const liquidationPrice = mode === 'pro' ? price * (direction === 'short' ? 1 + 1 / leverage - 0.005 : 1 - 1 / leverage + 0.005) : null;
  const unrealized = position ? (position.side === 'short' ? (position.entry - price) : (price - position.entry)) * position.quantity : 0;
  const equity = cash + btc * price + (position ? position.margin + unrealized : 0);
  // Base-tier simulated fees: VIP 0, no BNB discount; market fills are takers.
  const feeRate = mode === 'pro' ? 0.0005 : 0.001;
  const feeLabel = mode === 'pro' ? '0.05% futures taker' : '0.10% spot taker';
  const trade = side => {
    if (position || !quantity || (mode === 'hodl' && side !== 'buy' && !btc)) return;
    const result = session.executeTrade({ side, quantity: mode === 'hodl' ? quantity : quantity, price });
    if (!result.ok) return;
    setRunning(true);
    setTrades(old => [...old, result.trade]);
    if (mode === 'hodl') {
      setCash(v => v - result.trade.notional);
      setBtc(v => v + quantity);
      setPosition({ side: 'long', entry: price, quantity, margin: result.trade.notional, stopPrice, takePrice, leverage: 1 });
    }
    else { setCash(v => v - notional); setPosition({ side, entry: price, quantity, margin: notional, stopPrice, takePrice, leverage }); }
  };
  const closePosition = reason => {
    if (!position) return;
    const pnl = (position.side === 'short' ? position.entry - price : price - position.entry) * position.quantity;
    const result = session.executeTrade({ side: 'close', quantity: position.quantity, price });
    if (!result.ok) return;
    setCash(v => v + position.margin + pnl);
    setBtc(v => Math.max(0, v - position.quantity));
    setTrades(old => [...old, { ...result.trade, reason }]);
    setPosition(null);
  };
  useEffect(() => {
    if (!position || !session.candle) return;
    const { high, low } = session.candle;
    if (position.side === 'long' && position.stopPrice && low <= position.stopPrice) closePosition('stop loss');
    else if (position.side === 'short' && position.stopPrice && high >= position.stopPrice) closePosition('stop loss');
    else if (position.side === 'long' && position.takePrice && high >= position.takePrice) closePosition('take profit');
    else if (position.side === 'short' && position.takePrice && low <= position.takePrice) closePosition('take profit');
    else if (mode === 'pro' && ((position.side === 'long' && low <= position.entry * (1 - 1 / position.leverage + 0.005)) || (position.side === 'short' && high >= position.entry * (1 + 1 / position.leverage - 0.005)))) closePosition('liquidation');
  }, [session.candleIndex]);

  return <main className="container" style={{ minHeight: '80vh', position: 'relative' }}>
    {showWelcome && <div className="card" style={{ position: 'relative', border: '1px solid #fbbf24', background: 'rgba(251,191,36,0.08)' }}><button className="btn btn-secondary" style={{ position: 'absolute', right: 10, top: 10 }} onClick={() => { localStorage.setItem('hodl-practice-welcome-seen', '1'); setShowWelcome(false); }}>Got it</button><h2>Welcome to Practice Mode</h2><p>Trade with virtual money while replaying real historical BTC candles. HODL is simple spot trading; PRO adds leverage, shorting, and liquidation risk. Nothing here can place a live order.</p></div>}
    <header className="header">
      <div className="header-title"><h1>Practice Mode</h1><p>Paper sats only · no live orders · learn the candles</p></div>
      <div className="header-buttons"><button className="btn btn-secondary" onClick={onExit}>Exit Practice</button></div>
    </header>
    <section className="card" style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <strong>Scenario replay</strong><span style={{ color: '#fbbf24', fontWeight: 700 }}>PRACTICE ONLY</span>
        <button className={`btn ${mode === 'hodl' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setMode('hodl')}>HODL</button>
        <button className={`btn ${mode === 'pro' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setMode('pro'); setShowProTip(localStorage.getItem('hodl-practice-pro-tip-seen') !== '1'); }}>PRO</button>
        <label>Scenario <select value={scenario} onChange={e => setScenario(e.target.value)}>{Object.entries(SCENARIOS).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}</select></label>
        <label>Timeframe <select value={timeframe} onChange={e => setTimeframe(e.target.value)}>{Object.entries(TIMEFRAMES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <span style={{ color: 'var(--text-secondary)' }}>Learn:</span>
        <button className={`btn ${showVWAP ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowVWAP(v => !v)} title="VWAP shows the average traded price weighted by volume">VWAP</button>
        <button className={`btn ${showVolume ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowVolume(v => !v)} title="Volume shows how much BTC traded in each candle">Volume</button>
        <button className="btn btn-secondary" onClick={() => setRunning(v => !v)} disabled={!session.candle}>{running ? <Pause size={14} /> : <Play size={14} />} {running ? 'Pause' : 'Play'}</button>
        <button className="btn btn-secondary" onClick={() => loadScenario().catch(error => setLoadError(error.message))}><RotateCcw size={14} /> Random scenario</button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)' }}>{Math.max(1, session.candleIndex - history.length + 1)} / {Math.max(0, candles.length - history.length)} practice candles</span>
      </div>
    </section>
    {loadError && <div className="card" style={{ marginBottom: '0.75rem', color: '#fbbf24', borderColor: '#fbbf24' }}>⚠ {loadError}</div>}
    <div className="practice-market-layout" style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch', minHeight: 'clamp(560px, 70vh, 900px)' }}>
      <section className="card practice-market-chart" style={{ flex: '1 1 74%', minWidth: 0, display: 'flex', flexDirection: 'column', padding: '0.75rem', position: 'relative' }}>
        <div style={{ position: 'absolute', zIndex: 3, top: 18, left: 18, display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '0.55rem 0.8rem', borderRadius: 8, background: 'rgba(10,13,18,0.88)', border: '1px solid rgba(148,163,184,0.22)', boxShadow: '0 6px 18px rgba(0,0,0,0.25)' }}><strong>Account</strong><span>Cash <b>${cash.toFixed(2)}</b></span><span>BTC <b>{btc.toFixed(6)}</b></span><span>Equity <b>${equity.toFixed(2)}</b></span></div>
        <div ref={chartNodeRef} style={{ width: '100%', flex: 1, minHeight: 480 }} />
        <div style={{ color: 'var(--text-secondary)', paddingTop: '0.5rem' }}>Current {timeframe} candle: {session.candle ? new Date(session.candle.time * 1000).toISOString().replace('T', ' ').slice(0, 16) : 'loading'} · ${price.toFixed(2)}</div>
        <div style={{ color: 'var(--text-secondary)', paddingTop: '0.35rem' }}>Fear &amp; Greed: {context?.fear_greed ?? 'unavailable'}{context?.fear_greed_classification ? ` · ${context.fear_greed_classification}` : ''} · DXY: {context?.dxy?.toFixed(2) ?? 'unavailable'} · {contextGuidance}</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: 12, paddingTop: '0.45rem' }}>{EMA_PERIODS.map(period => <span key={period} style={{ color: EMA_COLORS[period] }}>EMA {period}</span>)}<span style={{ color: '#60a5fa' }}>Bollinger Bands</span>{showVWAP && <span style={{ color: '#38bdf8' }}>VWAP · volume-weighted average price</span>}{showVolume && <span>Volume · trading activity</span>}<span>Fear &amp; Greed · historical mood</span><span>DXY · dollar pressure</span></div>
      </section>
      <aside className="card practice-market-desk" style={{ flex: '0 0 330px', maxWidth: 350, overflowY: 'auto', padding: '1rem' }}><h2 style={{ marginTop: 0 }}>Trade desk · {mode.toUpperCase()}</h2>
        {mode === 'pro' && showProTip && <div style={{ padding: '0.65rem', marginBottom: '0.75rem', borderLeft: '3px solid #fbbf24', background: 'rgba(251,191,36,0.08)' }}>Beginner tip: try HODL first if leverage is new to you. <button className="btn btn-secondary" onClick={() => { localStorage.setItem('hodl-practice-pro-tip-seen', '1'); setShowProTip(false); }}>Dismiss</button></div>}
        <fieldset style={{ marginBottom: '0.75rem' }}><legend>Position Size</legend><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{[25, 50, 75, 100].map(p => <button key={p} className={`btn ${sizePct === p ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setSizePct(p); setManualAmount(''); }}>{p}%</button>)}</div>
        <label>Amount ($) <input value={manualAmount} onChange={e => setManualAmount(e.target.value)} placeholder={`${notional.toFixed(2)}`} /></label>
        <p>Preview: {quantity.toFixed(6)} BTC · ${notional.toFixed(2)} {mode === 'pro' ? `margin · ${leverage}x` : ''}</p></fieldset>
        <fieldset><legend>Risk Management</legend>{mode === 'pro' && <><div><button className={`btn ${direction === 'long' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDirection('long')}>LONG</button> <button className={`btn ${direction === 'short' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setDirection('short')}>SHORT</button></div><label>Leverage <Help text="Leverage controls how large your position is compared with your margin." /><select value={leverage} onChange={e => setLeverage(+e.target.value)}>{[1, 2, 3, 5, 10].map(x => <option key={x}>{x}</option>)}</select></label></>}
        <div><label>Stop loss <Help text="Automatically closes the position if price moves against you." /><select value={slType} onChange={e => setSlType(e.target.value)}><option value="percent">%</option><option value="price">Price</option></select> <input value={slPct} onChange={e => setSlPct(e.target.value)} placeholder="optional" /></label> {stopPrice && <span>${stopPrice.toFixed(2)}</span>}</div>
        <div><label>Take profit <Help text="Automatically closes the position when your target is reached." /><select value={tpType} onChange={e => setTpType(e.target.value)}><option value="percent">%</option><option value="price">Price</option></select> <input value={tpPct} onChange={e => setTpPct(e.target.value)} placeholder="optional" /></label> {takePrice && <span>${takePrice.toFixed(2)}</span>}</div>
        {liquidationPrice && <p>Liquidation <Help text="The estimated price where a leveraged position is force-closed." />: ${liquidationPrice.toFixed(2)}</p>}<p>Fee preview: ${(notional * feeRate).toFixed(2)} ({feeLabel})</p></fieldset>
        <button className="btn btn-primary" onClick={() => trade(mode === 'hodl' ? 'buy' : direction)} disabled={!session.canTrade || !!position || !price}>{mode === 'hodl' ? 'CONFIRM BUY' : `CONFIRM ${direction.toUpperCase()}`}</button>
        {mode === 'hodl' && <button className="btn btn-secondary" onClick={() => closePosition('manual close')} disabled={!session.canTrade || !position}>SELL BTC</button>}
        {position && <div style={{ marginTop: '0.75rem' }}><strong>Open {position.side.toUpperCase()}</strong><div>Entry ${position.entry.toFixed(2)} · PnL ${unrealized.toFixed(2)}</div><button className="btn btn-secondary" onClick={() => closePosition('manual close')}>CLOSE POSITION</button></div>}
        <p style={{ color: 'var(--text-secondary)' }}>{session.cooldownRemaining ? `Cooldown: ${session.cooldownRemaining} candle` : 'Ready for a deliberate decision.'}</p>
      </aside>
    </div>
    <details className="card" style={{ marginTop: '0.75rem' }}><summary style={{ cursor: 'pointer', fontWeight: 700 }}>Trade log {trades.length ? `(${trades.length})` : ''}</summary><div style={{ maxHeight: 180, overflowY: 'auto', marginTop: '0.75rem' }}>{trades.length ? trades.map(t => <div key={t.id}>{t.side.toUpperCase()} · {t.displayTimestamp} · ${t.fillPrice.toFixed(2)} · {t.quantity.toFixed(6)} BTC</div>) : <p style={{ color: 'var(--text-secondary)' }}>No practice trades yet.</p>}</div></details>
  </main>;
}
