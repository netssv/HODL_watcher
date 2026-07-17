import { useState, useEffect } from 'react';

/**
 * Tracks the chart's visible vertical price range in real time.
 * Subscribes to both time-scale changes and wheel events so vertical
 * price-axis zooms are also captured.
 */
export function useVisiblePriceRange(chartRef, candleSerRef, mainRef, chartVersion) {
  const [range, setRange] = useState(null);

  useEffect(() => {
    const chart = chartRef.current;
    const ser = candleSerRef.current;
    const el = mainRef.current;
    if (!chart || !ser || !el) return;

    const update = () => {
      const h = el.clientHeight;
      const high = ser.coordinateToPrice(0);
      const low  = ser.coordinateToPrice(h);
      if (high != null && low != null && high > low) {
        setRange({ high, low });
      }
    };

    // Fires on horizontal pan / time-axis zoom
    chart.timeScale().subscribeVisibleLogicalRangeChange(update);

    // Fires on vertical price-axis zoom (wheel on price scale or Ctrl+scroll)
    const onWheel = () => requestAnimationFrame(update);
    el.addEventListener('wheel', onWheel, { passive: true });

    update(); // seed immediately
    return () => {
      try { chart.timeScale().unsubscribeVisibleLogicalRangeChange(update); } catch (_) {}
      el.removeEventListener('wheel', onWheel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartVersion]);

  return range;
}

