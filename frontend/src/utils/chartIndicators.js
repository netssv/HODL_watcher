import { LineSeries } from 'lightweight-charts';
import { calcEMA, calcBB, calcRSI, calcVWAP } from './chartMath';
import { buildBaseChart, EMA_COLORS } from './chartFactory';

const STYLE_SOLID  = 0;
const STYLE_DASHED = 2;

// ── Bollinger Bands Transparent Shading Primitive ────────────────────────────
class BollingerBandsPrimitive {
  constructor(upData, dnData) {
    this._upData = upData;
    this._dnData = dnData;
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
  attached({ chart, series, requestUpdate }) {
    this._chart = chart;
    this._series = series;
    this._requestUpdate = requestUpdate;
    if (requestUpdate) requestUpdate();
  }
  detached() {
    this._chart = null;
    this._series = null;
    this._requestUpdate = null;
  }
  updateData(upData, dnData) {
    this._upData = upData;
    this._dnData = dnData;
    if (this._requestUpdate) this._requestUpdate();
  }
  update() {}
  paneViews() {
    return [new BollingerBandsPaneView(this)];
  }
}

class BollingerBandsPaneView {
  constructor(primitive) {
    this._primitive = primitive;
  }
  renderer() {
    return new BollingerBandsRenderer(this._primitive);
  }
}

class BollingerBandsRenderer {
  constructor(primitive) {
    this._primitive = primitive;
  }
  draw(target) {
    const primitive = this._primitive;
    const chart = primitive._chart;
    const series = primitive._series;
    if (!chart || !series || !primitive._upData.length) return;

    const timeScale = chart.timeScale();
    target.useMediaCoordinateSpace(scope => {
      const ctx = scope.context;
      const points = [];

      for (let i = 0; i < primitive._upData.length; i++) {
        const upPt = primitive._upData[i];
        const dnPt = primitive._dnData[i];
        const x = timeScale.timeToCoordinate(upPt.time);
        const yUp = series.priceToCoordinate(upPt.value);
        const yDn = series.priceToCoordinate(dnPt.value);

        if (x !== null && yUp !== null && yDn !== null) {
          points.push({ x, yUp, yDn });
        }
      }

      if (points.length < 2) return;

      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].yUp);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].yUp);
      }
      for (let i = points.length - 1; i >= 0; i--) {
        ctx.lineTo(points[i].x, points[i].yDn);
      }
      ctx.closePath();

      ctx.fillStyle = 'rgba(168, 85, 247, 0.11)'; // Shaded band color (slightly higher opacity for visibility)
      ctx.fill();
    });
  }
}

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
export function applyBB(chart, data, candlestickSeries) {
  const { upper, lower } = calcBB(data);
  
  // Calculate middle band (20 SMA basis)
  const middle = data.map((d, i) => {
    if (i < 19) return { time: d.time, value: d.close };
    const slice = data.slice(i - 19, i + 1).map(x => x.close);
    const mean = slice.reduce((a, b) => a + b, 0) / 20;
    return { time: d.time, value: +mean.toFixed(2) };
  });

  const opts = {
    color: 'rgba(168, 85, 247, 0.45)', // Purple/Violet
    lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  };

  // Upper boundary line
  const upSer = chart.addSeries(LineSeries, opts);
  upSer.setData(upper);

  // Lower boundary line
  const dnSer = chart.addSeries(LineSeries, opts);
  dnSer.setData(lower);

  // Middle basis line
  const midSer = chart.addSeries(LineSeries, {
    color: 'rgba(168, 85, 247, 0.3)',
    lineWidth: 1,
    lineStyle: STYLE_DASHED,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  midSer.setData(middle);

  // Attach canvas primitive for transparent shading between lines
  const primitive = new BollingerBandsPrimitive(upper, lower);
  candlestickSeries.attachPrimitive(primitive);

  return { upSer, dnSer, midSer, primitive };
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
