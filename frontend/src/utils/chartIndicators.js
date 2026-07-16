import { LineSeries } from 'lightweight-charts';
import { calcEMA, calcBB, calcRSI, calcVWAP } from './chartMath';
import { buildBaseChart, EMA_COLORS } from './chartFactory';

const STYLE_SOLID  = 0;
const STYLE_DASHED = 2;

// ── EMA line ─────────────────────────────────────────────────────────────────
export function applyEMA(chart, data, period) {
  if (!period) return null;
  const ser = chart.addSeries(LineSeries, {
    color:             EMA_COLORS[period] ?? '#facc15',
    lineWidth:         period <= 21 ? 1 : period <= 50 ? 1 : 2,
    lineStyle:         STYLE_SOLID,
    priceLineVisible:  false,
    lastValueVisible:  false,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius:  3,
  });
  ser.setData(calcEMA(data, period));
  return ser;
}

// ── Bollinger Bands ───────────────────────────────────────────────────────────
export function applyBB(chart, data) {
  const { upper, lower } = calcBB(data);
  const opts = {
    color:                  'rgba(139,92,246,0.7)',
    lineWidth:              1,
    lineStyle:              STYLE_DASHED,
    priceLineVisible:       false,
    lastValueVisible:       false,
    crosshairMarkerVisible: false,
  };
  const upSer = chart.addSeries(LineSeries, opts); upSer.setData(upper);
  const dnSer = chart.addSeries(LineSeries, opts); dnSer.setData(lower);
  return { upSer, dnSer };
}

// ── RSI sub-chart (returns the chart instance) ────────────────────────────────
export function applyRSIChart(container, mainChart, data, dark) {
  const rsiChart = buildBaseChart(container, 90, dark, {
    rightPriceScale: {
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
    timeScale:    { visible: false },
    handleScroll: false,
    handleScale:  false,
  });

  const ser = rsiChart.addSeries(LineSeries, {
    color:             '#818cf8',
    lineWidth:         1,
    priceLineVisible:  false,
    lastValueVisible:  true,
  });
  ser.setData(calcRSI(data));

  // Overbought / oversold reference lines
  [
    [70, 'rgba(244,63,94,0.5)',  'OB'],
    [30, 'rgba(16,185,129,0.5)', 'OS'],
  ].forEach(([price, color, title]) =>
    ser.createPriceLine({
      price, color,
      lineWidth:        1,
      lineStyle:        STYLE_DASHED,
      axisLabelVisible: true,
      title,
    })
  );

  rsiChart.timeScale().fitContent();

  // Bidirectional time-scale sync
  mainChart.timeScale().subscribeVisibleLogicalRangeChange(r => r && rsiChart.timeScale().setVisibleLogicalRange(r));
  rsiChart.timeScale().subscribeVisibleLogicalRangeChange(r => r && mainChart.timeScale().setVisibleLogicalRange(r));

  return rsiChart;
}

// ── VWAP line ────────────────────────────────────────────────────────────────
export function applyVWAP(chart, data) {
  const ser = chart.addSeries(LineSeries, {
    color:                  '#38bdf8', // sky blue
    lineWidth:              1.5,
    lineStyle:              STYLE_DASHED,
    priceLineVisible:       false,
    lastValueVisible:       false,
    crosshairMarkerVisible: true,
    crosshairMarkerRadius:  3,
  });
  ser.setData(calcVWAP(data));
  return ser;
}
