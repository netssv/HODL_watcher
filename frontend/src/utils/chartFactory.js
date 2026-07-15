/**
 * Lightweight-Charts series factory helpers.
 * All chart-API calls live here — no React dependency.
 * Static ESM imports only (Vite/Rolldown requirement).
 */
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import { calcEMA, calcBB, calcRSI } from './chartMath';

const EMA_COLORS   = { 9: '#facc15', 21: '#60a5fa', 50: '#f472b6' };
const STYLE_DASHED = 2;
const STYLE_DOTTED = 3;

// ── Base chart factory ────────────────────────────────────────────────────────
export function buildBaseChart(container, height, dark, extra = {}) {
  const bg     = dark ? '#0a0c10'                 : '#f8fafc';
  const txt    = dark ? '#6b7280'                 : '#475569';
  const grid   = dark ? 'rgba(255,255,255,0.04)'  : 'rgba(0,0,0,0.04)';
  const border = dark ? 'rgba(255,255,255,0.07)'  : '#e2e8f0';
  return createChart(container, {
    width:  container.clientWidth,
    height,
    layout: { background: { type: 'solid', color: bg }, textColor: txt, fontSize: 11, fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif' },
    grid:   { vertLines: { color: grid }, horzLines: { color: grid } },
    crosshair: {
      vertLine: { color: 'rgba(59,130,246,0.5)', labelBackgroundColor: '#3b82f6' },
      horzLine: { color: 'rgba(59,130,246,0.5)', labelBackgroundColor: '#3b82f6' },
    },
    rightPriceScale: { borderColor: border },
    timeScale: { borderColor: border, timeVisible: true, secondsVisible: false },
    ...extra,
  });
}

// ── Candle series + price lines + prediction marker ───────────────────────────
export function applyCandles(chart, data, predictionData, thresholdPct) {
  const ser = chart.addSeries(CandlestickSeries, {
    upColor: '#10b981', downColor: '#f43f5e',
    borderVisible: false, wickUpColor: '#10b981', wickDownColor: '#f43f5e',
  });
  ser.setData(data);

  const price = data.at(-1)?.close;
  if (!predictionData || !price) return ser;

  // Volatility boundary lines
  [
    [thresholdPct,  'rgba(16,185,129,0.7)', `+${(thresholdPct * 100).toFixed(1)}%`],
    [-thresholdPct, 'rgba(244,63,94,0.7)',  `-${(thresholdPct * 100).toFixed(1)}%`],
  ].forEach(([delta, color, title]) =>
    ser.createPriceLine({ price: price * (1 + delta), color, lineWidth: 1, lineStyle: STYLE_DASHED, axisLabelVisible: true, title })
  );

  // Liquidation proximity (Coinglass)
  const liq = predictionData.market_snapshot?.liquidation_proximity;
  if (liq) {
    ser.createPriceLine({ price: price * (1 + (liq.upper || 0.02)),          color: '#f59e0b', lineWidth: 1, lineStyle: STYLE_DOTTED, axisLabelVisible: true, title: '⚡ Liq ↑' });
    ser.createPriceLine({ price: price * (1 - Math.abs(liq.lower || 0.02)), color: '#f59e0b', lineWidth: 1, lineStyle: STYLE_DOTTED, axisLabelVisible: true, title: '⚡ Liq ↓' });
  }

  // Directional prediction marker
  const { up, down, sideways } = predictionData.model_prediction.direction_probabilities;
  const [dir, prob] = up > down && up > sideways ? ['up', up] : down > sideways ? ['down', down] : ['sideways', sideways];
  createSeriesMarkers(ser, [{
    time:     data.at(-1).time,
    position: dir === 'down' ? 'aboveBar' : 'belowBar',
    color:    dir === 'up' ? '#10b981' : dir === 'down' ? '#f43f5e' : '#9ca3af',
    shape:    dir === 'up' ? 'arrowUp' : dir === 'down' ? 'arrowDown' : 'circle',
    text:     `${dir.toUpperCase()} ${(prob * 100).toFixed(0)}%`,
  }]);
  return ser;
}

// ── Volume histogram ──────────────────────────────────────────────────────────
export function applyVolume(chart, data) {
  const ser = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'vol' });
  chart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  ser.setData(data.map(d => ({
    time: d.time, value: d.volume ?? 0,
    color: d.close >= d.open ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)',
  })));
  return ser;
}

// ── EMA line ─────────────────────────────────────────────────────────────────
export function applyEMA(chart, data, period) {
  if (!period) return null;
  const ser = chart.addSeries(LineSeries, {
    color: EMA_COLORS[period] ?? '#facc15',
    lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
  });
  ser.setData(calcEMA(data, period));
  return ser;
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────
export function applyBB(chart, data) {
  const { upper, lower } = calcBB(data);
  const opts = { color: 'rgba(139,92,246,0.6)', lineWidth: 1, lineStyle: STYLE_DASHED, priceLineVisible: false, lastValueVisible: false };
  const upSer = chart.addSeries(LineSeries, opts); upSer.setData(upper);
  const dnSer = chart.addSeries(LineSeries, opts); dnSer.setData(lower);
  return { upSer, dnSer };
}

// ── RSI sub-chart (returns the chart instance) ────────────────────────────────
export function applyRSIChart(container, mainChart, data, dark) {
  const rsiChart = buildBaseChart(container, 90, dark, {
    rightPriceScale: { scaleMargins: { top: 0.1, bottom: 0.1 } },
    timeScale: { visible: false },
    handleScroll: false,
    handleScale: false,
  });
  const ser = rsiChart.addSeries(LineSeries, { color: '#818cf8', lineWidth: 1, priceLineVisible: false });
  ser.setData(calcRSI(data));
  [
    [70, 'rgba(244,63,94,0.4)',  'OB'],
    [30, 'rgba(16,185,129,0.4)', 'OS'],
  ].forEach(([price, color, title]) =>
    ser.createPriceLine({ price, color, lineWidth: 1, lineStyle: STYLE_DASHED, axisLabelVisible: true, title })
  );
  rsiChart.timeScale().fitContent();

  // Bidirectional time-scale sync
  mainChart.timeScale().subscribeVisibleLogicalRangeChange(r => r && rsiChart.timeScale().setVisibleLogicalRange(r));
  rsiChart.timeScale().subscribeVisibleLogicalRangeChange(r => r && mainChart.timeScale().setVisibleLogicalRange(r));
  return rsiChart;
}
