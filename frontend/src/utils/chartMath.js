/**
 * Chart math utilities — pure functions, no side effects, no React.
 * Import these wherever indicator calculations are needed.
 */

/** Exponential Moving Average */
export function calcEMA(data, period) {
  const k = 2 / (period + 1);
  let ema = data[0]?.close ?? 0;
  return data.map(d => {
    ema = d.close * k + ema * (1 - k);
    return { time: d.time, value: +ema.toFixed(2) };
  });
}

/** Bollinger Bands — returns { upper, lower } arrays */
export function calcBB(data, period = 20, mult = 2) {
  const upper = [], lower = [];
  for (let i = period - 1; i < data.length; i++) {
    const slice = data.slice(i - period + 1, i + 1).map(d => d.close);
    const mean  = slice.reduce((a, b) => a + b, 0) / period;
    const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    upper.push({ time: data[i].time, value: +(mean + mult * std).toFixed(2) });
    lower.push({ time: data[i].time, value: +(mean - mult * std).toFixed(2) });
  }
  return { upper, lower };
}

/** Wilder-smoothed RSI */
export function calcRSI(data, period = 14) {
  let gains = 0, losses = 0;
  for (let i = 1; i <= period && i < data.length; i++) {
    const d = data[i].close - data[i - 1].close;
    d > 0 ? (gains += d) : (losses -= d);
  }
  let avgGain = gains / period, avgLoss = losses / period;
  const result = [];
  for (let i = period; i < data.length; i++) {
    if (i > period) {
      const d = data[i].close - data[i - 1].close;
      avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push({ time: data[i].time, value: +(100 - 100 / (1 + rs)).toFixed(2) });
  }
  return result;
}

/** Volume Weighted Average Price */
export function calcVWAP(data) {
  let sumPV = 0;
  let sumVol = 0;
  let session = null;
  return data.map(d => {
    // Crypto trades 24/7, so use UTC calendar days as deterministic VWAP
    // sessions. A rolling cumulative VWAP changes when history is loaded.
    const day = Math.floor(d.time / 86400);
    if (day !== session) {
      session = day;
      sumPV = 0;
      sumVol = 0;
    }
    const typ = (d.high + d.low + d.close) / 3;
    const vol = d.volume ?? 0;
    sumPV += typ * vol;
    sumVol += vol;
    return { time: d.time, value: +(sumVol > 0 ? sumPV / sumVol : d.close).toFixed(2) };
  });
}
