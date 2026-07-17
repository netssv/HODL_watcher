/**
 * Lightweight-Charts series factory helpers.
 * All chart-API calls live here — no React dependency.
 * Static ESM imports only (Vite/Rolldown requirement).
 */
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts';

export const EMA_COLORS = {
  9:   '#facc15',  // yellow
  21:  '#fb923c',  // orange
  50:  '#f472b6',  // pink
  100: '#22d3ee',  // cyan
  200: '#c084fc',  // purple
};

// Line-style constants
const STYLE_SOLID  = 0;
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
    layout: {
      background: { type: 'solid', color: bg },
      textColor: txt,
      fontSize: 11,
      fontFamily: 'JetBrains Mono, monospace',
    },
    grid:   { vertLines: { color: grid }, horzLines: { color: grid } },
    crosshair: {
      mode: 1, // CROSSHAIR_MODE_NORMAL
      vertLine: {
        color: 'rgba(148,163,184,0.4)',
        width: 1,
        style: STYLE_DASHED,
        labelBackgroundColor: '#1e293b',
      },
      horzLine: {
        color: 'rgba(148,163,184,0.4)',
        width: 1,
        style: STYLE_DASHED,
        labelBackgroundColor: '#1e293b',
      },
    },
    rightPriceScale: {
      borderColor: border,
      // Give candles more room; volume will use its own overlay scale
      scaleMargins: { top: 0.06, bottom: 0.20 },
    },
    timeScale: {
      borderColor: border,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
    },
    ...extra,
  });
}

export function applyCandles(chart, data, predictionData, thresholdPct) {
  const ser = chart.addSeries(CandlestickSeries, {
    upColor: '#10b981', downColor: '#f43f5e',
    borderVisible: false,
    wickUpColor: '#10b981', wickDownColor: '#f43f5e',
  });
  ser.setData(data);

  const price = data.at(-1)?.close;
  if (!predictionData || !price) return { ser, predLines: [] };

  const predLines = [];
  const lastCandle = data.at(-1);
  const secondLast = data.at(-2);
  const tfSeconds = lastCandle && secondLast ? (lastCandle.time - secondLast.time) : 3600;

  // Project lines starting from the last candle, extending 10 intervals into the future
  const futureData = [
    { time: lastCandle.time, value: null }, // placeholder structure
    { time: lastCandle.time + tfSeconds * 12, value: null }
  ];

  const mkLine = (opts) => {
    const line = chart.addSeries(LineSeries, {
      color: opts.color,
      lineWidth: opts.lineWidth,
      lineStyle: opts.lineStyle,
      priceLineVisible: false,
      lastValueVisible: opts.axisLabelVisible,
      crosshairMarkerVisible: false,
      title: opts.title,
    });
    line.setData([
      { time: lastCandle.time, value: opts.price },
      { time: lastCandle.time + tfSeconds * 20, value: opts.price }
    ]);
    predLines.push({ line, color: opts.color });
  };

  // ── ATR-derived SL / TP bands ─────────────────────────────────────────────
  // dynamic_sl_pct = 2×ATR/price  |  dynamic_tp_pct = 3×ATR/price
  const rm = predictionData.risk_management;
  const slPct = rm?.dynamic_sl_pct > 0 ? rm.dynamic_sl_pct / 100 : thresholdPct;
  const tpPct = rm?.dynamic_tp_pct > 0 ? rm.dynamic_tp_pct / 100 : thresholdPct * 1.5;
  const slPctFmt = (slPct * 100).toFixed(2);
  const tpPctFmt = (tpPct * 100).toFixed(2);

  mkLine({ price: price * (1 + tpPct), color: 'rgba(16,185,129,0.90)', lineWidth: 2, lineStyle: STYLE_SOLID,  axisLabelVisible: true, title: `🎯 Long Exit +${tpPctFmt}%` });
  mkLine({ price: price * (1 - tpPct), color: 'rgba(16,185,129,0.55)', lineWidth: 2, lineStyle: STYLE_DASHED, axisLabelVisible: true, title: `🎯 Short Exit -${tpPctFmt}%` });
  mkLine({ price: price * (1 + slPct), color: 'rgba(244,63,94,0.55)',  lineWidth: 2, lineStyle: STYLE_DASHED, axisLabelVisible: true, title: `🛑 Short Stop +${slPctFmt}%` });
  mkLine({ price: price * (1 - slPct), color: 'rgba(244,63,94,0.90)', lineWidth: 2, lineStyle: STYLE_SOLID,  axisLabelVisible: true, title: `🛑 Long Stop -${slPctFmt}%` });

  // ── Liquidation proximity levels ─────────────────────────────────────────
  const liq = predictionData.market_snapshot?.liquidation_proximity;
  if (liq) {
    const LIQ_COLOR = 'rgba(251,191,36,0.9)';
    mkLine({ price: price * (1 + (liq.upper || 0.02)),        color: LIQ_COLOR, lineWidth: 2, lineStyle: STYLE_DASHED, axisLabelVisible: true, title: 'Liq↑' });
    mkLine({ price: price * (1 - Math.abs(liq.lower || 0.02)), color: LIQ_COLOR, lineWidth: 2, lineStyle: STYLE_DASHED, axisLabelVisible: true, title: 'Liq↓' });
  }


  // ── Directional prediction marker ─────────────────────────────────────────
  const { up, down, sideways } = predictionData.model_prediction.direction_probabilities;
  const [dir, prob] =
    up > down && up > sideways ? ['up', up] :
    down > sideways            ? ['down', down] :
                                 ['sideways', sideways];
  createSeriesMarkers(ser, [{
    time:     data.at(-1).time,
    position: dir === 'down' ? 'aboveBar' : 'belowBar',
    color:    dir === 'up' ? '#10b981' : dir === 'down' ? '#f43f5e' : '#94a3b8',
    shape:    dir === 'up' ? 'arrowUp' : dir === 'down' ? 'arrowDown' : 'circle',
    text:     `${dir.toUpperCase()} ${(prob * 100).toFixed(0)}%`,
    size:     1,
  }]);

  return { ser, predLines };
}

// ── Volume histogram (proper sub-panel with own scale, capped height) ─────────
export function applyVolume(chart, data) {
  const ser = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'vol',
  });
  chart.priceScale('vol').applyOptions({
    scaleMargins: { top: 0.84, bottom: 0.01 },
  });
  ser.setData(data.map(d => ({
    time:  d.time,
    value: d.volume ?? 0,
    color: d.close >= d.open
      ? 'rgba(16,185,129,0.45)'
      : 'rgba(244,63,94,0.45)',
  })));
  return ser;
}
