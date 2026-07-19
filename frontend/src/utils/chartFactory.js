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
  if (!predictionData || !price) return { ser, predLines: [], trendLines: [] };

  const predLines = [];
  const trendLines = [];
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

  // Draw the forecast as a path, not a synthetic candle. A second candle at
  // the edge of the historical series is visually easy to mistake for live
  // data and causes the direction/forecast markers to overlap.
  const horizonHours = predictionData.validation_summary?.horizon_hours
    ?? predictionData.validation_summary?.horizon_periods
    ?? predictionData.meta?.horizon_hours
    ?? 24;
  // Keep the forecast at its real horizon. Rounding it to a candle interval
  // made a 24h forecast jump one full week/month on larger timeframes.
  const futureTime = lastCandle.time + horizonHours * 3600;
  const move = thresholdPct * (0.65 + prob * 0.35);
  const projectedClose = dir === 'up' ? price * (1 + move) : dir === 'down' ? price * (1 - move) : price;
  const projectionColor = dir === 'up' ? 'rgba(63,118,101,0.42)' : dir === 'down' ? 'rgba(198,93,75,0.42)' : 'rgba(167,163,155,0.42)';
  const projection = chart.addSeries(LineSeries, {
    color: projectionColor,
    lineWidth: 2,
    lineStyle: STYLE_DASHED,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
    title: `${horizonHours}h forecast`,
  });
  projection.setData([
    { time: lastCandle.time, value: price },
    { time: futureTime, value: projectedClose },
  ]);
  createSeriesMarkers(projection, [{
    time: futureTime,
    // Use the opposite lane from the direction marker on the last candle so
    // DOWN/UP probability text cannot collide with the forecast label.
    position: dir === 'down' ? 'belowBar' : 'aboveBar',
    color: projectionColor,
    // Point back toward the projected endpoint from the opposite label lane.
    shape: dir === 'down' ? 'arrowUp' : dir === 'up' ? 'arrowDown' : 'circle',
    text: `${horizonHours}h forecast`,
    size: 1,
  }]);

  // Lightweight trader-style structure lines: connect a recent swing low and
  // high from each half of the visible history, avoiding a noisy best-fit line.
  const swingWindow = data.slice(-60);
  const midpoint = Math.max(1, Math.floor(swingWindow.length / 2));
  const firstHalf = swingWindow.slice(0, midpoint);
  const secondHalf = swingWindow.slice(midpoint);
  if (firstHalf.length && secondHalf.length) {
    const supportPoints = [
      firstHalf.reduce((a, b) => b.low < a.low ? b : a),
      secondHalf.reduce((a, b) => b.low < a.low ? b : a),
    ];
    const resistancePoints = [
      firstHalf.reduce((a, b) => b.high > a.high ? b : a),
      secondHalf.reduce((a, b) => b.high > a.high ? b : a),
    ];
    [[supportPoints, 'rgba(34,211,238,0.95)', 'Support'], [resistancePoints, 'rgba(251,191,36,0.95)', 'Resistance']]
      .forEach(([points, color, title]) => {
        points.sort((a, b) => a.time - b.time);
        const [first, second] = points;
        const elapsed = second.time - first.time;
        const firstValue = first.low ?? first.high;
        const secondValue = second.low ?? second.high;
        const slope = elapsed ? (secondValue - firstValue) / elapsed : 0;
        const projectionTime = second.time + Math.max(elapsed, 1);
        const projectionValue = secondValue + slope * (projectionTime - second.time);
        const trend = chart.addSeries(LineSeries, {
          color, lineWidth: 1, lineStyle: STYLE_DASHED,
          priceLineVisible: false, lastValueVisible: true,
          crosshairMarkerVisible: false, title,
        });
        trend.applyOptions({ lineWidth: 2 });
        trend.setData([
          { time: first.time, value: firstValue },
          { time: second.time, value: secondValue },
          { time: projectionTime, value: projectionValue },
        ]);
        trendLines.push({ line: trend, color });
      });
  }

  return { ser, predLines, trendLines };
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
