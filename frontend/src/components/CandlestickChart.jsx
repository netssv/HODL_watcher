import React, { useRef, useState, useCallback, useEffect } from 'react';
import { LineSeries } from 'lightweight-charts';
import { buildBaseChart, applyCandles, applyVolume } from '../utils/chartFactory';
import { applyEMA, applyBB, applyRSIChart, applyVWAP } from '../utils/chartIndicators';
import { calcEMA, calcBB, calcRSI, calcVWAP } from '../utils/chartMath';
import { useChartData, useRsiResize, useChartResize, fetchOlderCandles } from '../hooks/useChartData';
import { useLiqMap } from '../hooks/useLiqMap';
import { useVisiblePriceRange } from '../hooks/useVisiblePriceRange';
import { ChartControls, ChartHeader, MainChartArea, RsiPanel } from './ChartUI';

export default function CandlestickChart({ predictionData, thresholdPct, globalLivePrice }) {
  const mainRef = useRef(), rsiRef = useRef();
  const chartRef = useRef(null), rsiChartRef = useRef(null);
  const candleSerRef = useRef(null), volSerRef = useRef(null);
  const emaSeriesRef = useRef({}), bbSeriesRef = useRef(null), rsiSeriesRef = useRef(null);
  const vwapSeriesRef = useRef(null), predLinesRef = useRef([]), trendLinesRef = useRef([]);
  const loadingMoreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [timeframe, setTF]            = useState('4h');
  const [activeEMAs, setActiveEMAs]   = useState([]);
  const [showBB, setBB]               = useState(false);
  const [showRSI, setRSI]             = useState(false);
  const [showVWAP, setVWAP]           = useState(false);
  const [showLiqMap, setLiqMap]       = useState(true);
  const [showPredLines, setPredLines] = useState(true);
  const [showTrendLines, setTrendLines] = useState(false);
  const [chartVersion, setChartVersion] = useState(0);
  const [rangePreset, setRangePreset] = useState('7D');

  const teardown = () => {
    chartRef.current?.remove();    chartRef.current = null;
    rsiChartRef.current?.remove(); rsiChartRef.current = null;
    candleSerRef.current = null;   volSerRef.current = null;
    emaSeriesRef.current = {};     bbSeriesRef.current = null;
    rsiSeriesRef.current = null;   vwapSeriesRef.current = null;
    predLinesRef.current = [];
    trendLinesRef.current = [];
  };

  const buildAll = useCallback((data) => {
    teardown();
    if (!mainRef.current || !data.length) return;
    const chart = buildBaseChart(mainRef.current, Math.max(mainRef.current.clientHeight, 300), true);
    const { ser, predLines, trendLines } = applyCandles(chart, data, predictionData, thresholdPct);
    candleSerRef.current = ser;
    predLinesRef.current = predLines;
    trendLinesRef.current = trendLines;
    trendLines.forEach(({ line, color }) => line.applyOptions({ color: showTrendLines ? color : 'transparent' }));
    volSerRef.current    = applyVolume(chart, data);
    chart.timeScale().setVisibleLogicalRange({
      from: data.length - 100,
      to: data.length + 8, // Adds some blank space on the right for future lines
    });
    chartRef.current = chart;
    setChartVersion(v => v + 1); // triggers visible range subscription
  }, [predictionData, thresholdPct]);

  const { rsiHeight, handleDragStart } = useRsiResize(rsiChartRef, mainRef, chartRef);
  const { ohlc, loading, err, candlesRef } = useChartData(timeframe, buildAll);
  useChartResize(mainRef, chartRef, rsiRef, rsiChartRef);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candlesRef.current?.length) return;

    // Adding/removing a series makes Lightweight Charts recalculate its
    // scales. Keep the user's current viewport; indicator toggles should only
    // change what is drawn.
    const timeRange = chart.timeScale().getVisibleLogicalRange();
    const priceRange = chart.priceScale('right').getVisibleRange();

    Object.entries(emaSeriesRef.current).forEach(([p, ser]) => {
      if (!activeEMAs.includes(Number(p)) && ser) {
        try { chart.removeSeries(ser); } catch (_) {}
        delete emaSeriesRef.current[p];
      }
    });
    activeEMAs.forEach(p => {
      if (!emaSeriesRef.current[p]) emaSeriesRef.current[p] = applyEMA(chart, candlesRef.current, p);
    });

    if (showBB && !bbSeriesRef.current) {
      bbSeriesRef.current = applyBB(chart, candlesRef.current, candleSerRef.current);
    } else if (!showBB && bbSeriesRef.current) {
      try {
        if (bbSeriesRef.current.upSer) chart.removeSeries(bbSeriesRef.current.upSer);
        if (bbSeriesRef.current.dnSer) chart.removeSeries(bbSeriesRef.current.dnSer);
        if (bbSeriesRef.current.midSer) chart.removeSeries(bbSeriesRef.current.midSer);
        if (bbSeriesRef.current.primitive) candleSerRef.current.detachPrimitive(bbSeriesRef.current.primitive);
      } catch (_) {}
      bbSeriesRef.current = null;
    }


    if (showVWAP && !vwapSeriesRef.current) {
      vwapSeriesRef.current = applyVWAP(chart, candlesRef.current);
    } else if (!showVWAP && vwapSeriesRef.current) {
      try { chart.removeSeries(vwapSeriesRef.current); } catch (_) {}
      vwapSeriesRef.current = null;
    }

    if (showRSI && !rsiChartRef.current && rsiRef.current) {
      const rsiChart = applyRSIChart(rsiRef.current, chart, candlesRef.current, true);
      rsiChart.applyOptions({ height: rsiHeight });
      rsiChartRef.current = rsiChart;
      rsiSeriesRef.current = rsiChart.series?.()[0] ?? null;
    } else if (!showRSI && rsiChartRef.current) {
      try { rsiChartRef.current.remove(); } catch (_) {}
      rsiChartRef.current = null; rsiSeriesRef.current = null;
    }

    const restore = () => {
      if (!chartRef.current) return;
      if (timeRange) {
        chartRef.current.timeScale().setVisibleLogicalRange(timeRange);
        rsiChartRef.current?.timeScale().setVisibleLogicalRange(timeRange);
      }
      if (priceRange) chartRef.current.priceScale('right').setVisibleRange(priceRange);
    };

    // Series attachment and the RSI panel resize can each trigger another
    // autoscale pass. Restore after those layout passes as well.
    let frame = requestAnimationFrame(() => {
      restore();
      frame = requestAnimationFrame(() => {
        restore();
        frame = requestAnimationFrame(restore);
      });
    });
    const timer = setTimeout(restore, 100);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [activeEMAs, showBB, showRSI, showVWAP, loading, timeframe, chartVersion]);

  useEffect(() => {
    if (!chartRef.current) return;
    const ts = chartRef.current.timeScale();
    const onRangeChange = async (range) => {
      if (!range || range.from > 30 || loadingMoreRef.current || !candlesRef.current.length) return;
      loadingMoreRef.current = true; setLoadingMore(true);
      try {
        const oldestTime = candlesRef.current[0].time;
        const older = await fetchOlderCandles(timeframe, oldestTime);
        const newCandles = older.filter(c => c.time < oldestTime);
        if (newCandles.length && candleSerRef.current) {
          const merged = [...newCandles, ...candlesRef.current];
          candlesRef.current = merged;
          candleSerRef.current.setData(merged);
          volSerRef.current?.setData(merged.map(c => ({
            time: c.time, value: c.volume,
            color: c.close >= c.open ? 'rgba(16,185,129,0.45)' : 'rgba(244,63,94,0.45)',
          })));
          Object.entries(emaSeriesRef.current).forEach(([p, ser]) => ser?.setData(calcEMA(merged, Number(p))));
          if (bbSeriesRef.current) {
            const { upper, lower } = calcBB(merged);
            bbSeriesRef.current.upSer?.setData(upper);
            bbSeriesRef.current.dnSer?.setData(lower);
            const middle = merged.map((d, i) => {
              if (i < 19) return { time: d.time, value: d.close };
              const slice = merged.slice(i - 19, i + 1).map(x => x.close);
              const mean = slice.reduce((a, b) => a + b, 0) / 20;
              return { time: d.time, value: +mean.toFixed(2) };
            });
            bbSeriesRef.current.midSer?.setData(middle);
            bbSeriesRef.current.primitive?.updateData(upper, lower);
          }


          vwapSeriesRef.current?.setData(calcVWAP(merged));
          rsiSeriesRef.current?.setData(calcRSI(merged));
        }
      } catch (_) {}
      loadingMoreRef.current = false; setLoadingMore(false);
    };
    ts.subscribeVisibleLogicalRangeChange(onRangeChange);
    return () => ts.unsubscribeVisibleLogicalRangeChange(onRangeChange);
  }, [timeframe, chartRef.current]);

  useEffect(() => {
    const onTick = ({ detail: c }) => {
      candleSerRef.current?.update(c);
      volSerRef.current?.update({
        time: c.time, value: c.volume,
        color: c.close >= c.open ? 'rgba(16,185,129,0.45)' : 'rgba(244,63,94,0.45)',
      });
    };
    window.addEventListener('chart:tick', onTick);
    return () => window.removeEventListener('chart:tick', onTick);
  }, []);

  const displayPrice = globalLivePrice ?? ohlc?.close ?? null;
  const visibleRange = useVisiblePriceRange(chartRef, candleSerRef, mainRef, chartVersion);

  // Custom hook handles moving historical bands + future horizontal active liquidation lines
  useLiqMap(chartRef, candleSerRef, candlesRef, showLiqMap, displayPrice, predictionData, chartVersion);

  useEffect(() => {
    predLinesRef.current.forEach(({ line, color }) => {
      try { line.applyOptions({ color: showPredLines ? color : 'transparent' }); } catch (_) {}
    });
  }, [showPredLines, chartVersion]);

  useEffect(() => {
    trendLinesRef.current.forEach(({ line, color }) => {
      try { line.applyOptions({ color: showTrendLines ? color : 'transparent' }); } catch (_) {}
    });
  }, [showTrendLines, chartVersion]);

  useEffect(() => {
    const chart = chartRef.current;
    const candles = candlesRef.current;
    if (!chart || !candles?.length) return;
    const SECS = { '3D': 259200, '7D': 604800, '1M': 2592000 };
    const s = SECS[rangePreset];
    if (!s) { chart.timeScale().fitContent(); return; }
    const last = candles.at(-1).time;
    const fromIdx = candles.findIndex(c => c.time >= last - s);
    chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, fromIdx - 2), to: candles.length + 8 });
  }, [rangePreset, chartVersion]);

  const toggleEMA = (p) => setActiveEMAs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, height: '100%', borderRadius: 0, border: 'none', display: 'flex', flexDirection: 'column' }}>
      <ChartControls timeframe={timeframe} setTF={setTF} activeEMAs={activeEMAs} toggleEMA={toggleEMA}
        showBB={showBB} setBB={setBB} showRSI={showRSI} setRSI={setRSI} showVWAP={showVWAP} setVWAP={setVWAP}
        showLiqMap={showLiqMap} setLiqMap={setLiqMap} showPredLines={showPredLines} setPredLines={setPredLines}
        showTrendLines={showTrendLines} setTrendLines={setTrendLines}
        loading={loading} err={err} loadingMore={loadingMore}
        rangePreset={rangePreset} setRangePreset={setRangePreset} />
      <ChartHeader ohlc={ohlc} price={displayPrice} />
      <MainChartArea mainRef={mainRef} loading={loading} err={err} activeEMAs={activeEMAs} showBB={showBB} chartRef={chartRef} predictionData={predictionData} showLiqMap={showLiqMap} displayPrice={displayPrice} visibleRange={visibleRange} />
      {showRSI && <RsiPanel rsiRef={rsiRef} rsiHeight={rsiHeight} handleDragStart={handleDragStart} />}
    </section>
  );
}
