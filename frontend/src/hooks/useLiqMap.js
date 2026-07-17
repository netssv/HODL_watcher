import { useEffect, useRef } from 'react';

/**
 * Custom canvas primitive to draw horizontal liquidation segments that terminate when hit by wicks.
 */
class LiquidationHeatmapPrimitive {
  constructor(candles) {
    this._candles = candles;
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
  updateData(candles) {
    this._candles = candles;
    if (this._requestUpdate) this._requestUpdate();
  }
  update() {}
  paneViews() {
    return [new LiquidationHeatmapPaneView(this)];
  }
}

class LiquidationHeatmapPaneView {
  constructor(primitive) {
    this._primitive = primitive;
  }
  renderer() {
    return new LiquidationHeatmapRenderer(this._primitive);
  }
}

class LiquidationHeatmapRenderer {
  constructor(primitive) {
    this._primitive = primitive;
  }
  draw(target) {
    const primitive = this._primitive;
    const chart = primitive._chart;
    const series = primitive._series;
    if (!chart || !series || !primitive._candles.length) return;

    const timeScale = chart.timeScale();
    const recentCandles = primitive._candles.slice(-50);
    const OFFSETS = [0.005, 0.010, 0.018, 0.028, 0.040];
    const COLORS = {
      0.005: 'rgba(253,224,71,0.18)', // yellow
      0.010: 'rgba(251,191,36,0.14)', // orange
      0.018: 'rgba(249,115,22,0.11)',  // dark orange
      0.028: 'rgba(6,182,212,0.08)',  // cyan
      0.040: 'rgba(16,185,129,0.06)',  // green
    };

    target.useMediaCoordinateSpace(scope => {
      const ctx = scope.context;
      const dprH = scope.horizontalPixelRatio;
      const dprV = scope.verticalPixelRatio;

      // Spawn segments historically
      for (let i = 0; i < recentCandles.length - 2; i += 3) {
        const spawnCandle = recentCandles[i];
        
        OFFSETS.forEach(offset => {
          const color = COLORS[offset];
          const levels = [
            { val: spawnCandle.close * (1 - offset), type: 'long' },
            { val: spawnCandle.close * (1 + offset), type: 'short' }
          ];

          levels.forEach(({ val, type }) => {
            let hitIndex = -1;
            // Walk forward to find if hit
            for (let j = i + 1; j < recentCandles.length; j++) {
              const checkCandle = recentCandles[j];
              if (type === 'long' && checkCandle.low <= val) {
                hitIndex = j;
                break;
              }
              if (type === 'short' && checkCandle.high >= val) {
                hitIndex = j;
                break;
              }
            }

            const endCandle = hitIndex !== -1 ? recentCandles[hitIndex] : recentCandles[recentCandles.length - 1];
            
            const x1 = timeScale.timeToCoordinate(spawnCandle.time);
            const x2 = timeScale.timeToCoordinate(endCandle.time);
            const y = series.priceToCoordinate(val);

            if (x1 !== null && x2 !== null && y !== null) {
              ctx.beginPath();
              ctx.moveTo(x1 * dprH, y * dprV);
              ctx.lineTo(x2 * dprH, y * dprV);
              ctx.strokeStyle = color;
              ctx.lineWidth = 2 * dprV;
              ctx.stroke();
            }
          });
        });
      }
    });
  }
}

/**
 * Hook to render dynamic liquidation layers on the chart.
 */
export function useLiqMap(chartRef, candleSerRef, candlesRef, showLiqMap, displayPrice, predictionData) {
  const primitiveRef = useRef(null);
  const liqPriceLinesRef = useRef([]);

  useEffect(() => {
    const chart = chartRef.current;
    const ser = candleSerRef.current;
    if (!chart || !ser) return;

    // Clear old primitive
    if (primitiveRef.current) {
      try { ser.detachPrimitive(primitiveRef.current); } catch (_) {}
      primitiveRef.current = null;
    }

    // Clear old price lines
    liqPriceLinesRef.current.forEach(line => { try { ser.removePriceLine(line); } catch (_) {} });
    liqPriceLinesRef.current = [];

    if (!showLiqMap) return;
    const price = candlesRef.current?.at(-1)?.close ?? displayPrice;
    if (!price || !candlesRef.current?.length) return;

    // 1. Attach custom canvas primitive for historical swept segments
    const primitive = new LiquidationHeatmapPrimitive(candlesRef.current);
    ser.attachPrimitive(primitive);
    primitiveRef.current = primitive;

    // 2. Draw current active liquidation targets as bold price lines (extending right into future)
    const liq = predictionData?.market_snapshot?.liquidation_proximity;
    if (liq) {
      const upperPrice = price * (1 + (liq.upper || 0.02));
      const lowerPrice = price * (1 - Math.abs(liq.lower || 0.02));

      // Upper Liq Price Line (Shorts)
      liqPriceLinesRef.current.push(ser.createPriceLine({
        price: upperPrice,
        color: '#fb923c', // Orange
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: 'Liq Shorts ⚡',
      }));

      // Lower Liq Price Line (Longs)
      liqPriceLinesRef.current.push(ser.createPriceLine({
        price: lowerPrice,
        color: '#10b981', // Green
        lineWidth: 2,
        lineStyle: 0, // Solid
        axisLabelVisible: true,
        title: 'Liq Longs ⚡',
      }));
    }

    return () => {
      if (primitiveRef.current) {
        try { ser.detachPrimitive(primitiveRef.current); } catch (_) {}
        primitiveRef.current = null;
      }
      liqPriceLinesRef.current.forEach(line => { try { ser.removePriceLine(line); } catch (_) {} });
      liqPriceLinesRef.current = [];
    };
  }, [showLiqMap, displayPrice, predictionData, chartRef, candleSerRef, candlesRef]);

  // Update primitive data when new candles load
  useEffect(() => {
    if (primitiveRef.current && candlesRef.current?.length) {
      primitiveRef.current.updateData(candlesRef.current);
    }
  }, [candlesRef.current]);
}

