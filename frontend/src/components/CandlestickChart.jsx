import React, { useRef, useState, useCallback, useEffect } from 'react';
import { buildBaseChart, applyCandles, applyVolume } from '../utils/chartFactory';
import { applyEMA, applyBB, applyRSIChart, applyVWAP } from '../utils/chartIndicators';
import { calcEMA, calcBB, calcRSI, calcVWAP } from '../utils/chartMath';
import { useChartData, useRsiResize, useChartResize, fetchOlderCandles } from '../hooks/useChartData';
import { ChartControls, ChartHeader, MainChartArea, RsiPanel } from './ChartUI';

export default function CandlestickChart({ predictionData, thresholdPct, globalLivePrice }) {
  const mainRef = useRef(), rsiRef = useRef();
  const chartRef = useRef(null), rsiChartRef = useRef(null);
  const candleSerRef = useRef(null), volSerRef = useRef(null);
  const emaSeriesRef = useRef({}), bbSeriesRef = useRef(null), rsiSeriesRef = useRef(null);
  const vwapSeriesRef = useRef(null), liqSeriesRef = useRef([]), predLinesRef = useRef([]);
  const loadingMoreRef = useRef(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [timeframe, setTF]            = useState('1h');
  const [activeEMAs, setActiveEMAs]   = useState([]);
  const [showBB, setBB]               = useState(false);
  const [showRSI, setRSI]             = useState(false);
  const [showVWAP, setVWAP]           = useState(false);
  const [showLiqMap, setLiqMap]       = useState(true);
  const [showPredLines, setPredLines] = useState(true);

  const teardown = () => {
    chartRef.current?.remove();    chartRef.current = null;
    rsiChartRef.current?.remove(); rsiChartRef.current = null;
    candleSerRef.current = null;   volSerRef.current = null;
    emaSeriesRef.current = {};     bbSeriesRef.current = null;
    rsiSeriesRef.current = null;   vwapSeriesRef.current = null;
    liqSeriesRef.current = [];     predLinesRef.current = [];
  };

  const buildAll = useCallback((data) => {
    teardown();
    if (!mainRef.current || !data.length) return;
    const chart = buildBaseChart(mainRef.current, Math.max(mainRef.current.clientHeight, 300), true);
    const { ser, predLines } = applyCandles(chart, data, predictionData, thresholdPct);
    candleSerRef.current = ser;
    predLinesRef.current = predLines;
    volSerRef.current    = applyVolume(chart, data);
    chart.timeScale().fitContent();
    chartRef.current = chart;
  }, [predictionData, thresholdPct]);

  const { rsiHeight, handleDragStart } = useRsiResize(rsiChartRef, mainRef, chartRef);
  const { ohlc, loading, err, candlesRef } = useChartData(timeframe, buildAll);
  useChartResize(mainRef, chartRef, rsiRef, rsiChartRef);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !candlesRef.current?.length) return;

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
      bbSeriesRef.current = applyBB(chart, candlesRef.current);
    } else if (!showBB && bbSeriesRef.current) {
      try {
        if (bbSeriesRef.current.upSer) chart.removeSeries(bbSeriesRef.current.upSer);
        if (bbSeriesRef.current.dnSer) chart.removeSeries(bbSeriesRef.current.dnSer);
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
  }, [activeEMAs, showBB, showRSI, showVWAP, loading, timeframe]);

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
            bbSeriesRef.current.upSer?.setData(upper); bbSeriesRef.current.dnSer?.setData(lower);
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

  useEffect(() => {
    const ser = candleSerRef.current;
    if (!ser) return;
    liqSeriesRef.current.forEach(line => { try { ser.removePriceLine(line); } catch (_) {} });
    liqSeriesRef.current = [];
    if (!showLiqMap) return;
    const price = candlesRef.current?.at(-1)?.close ?? displayPrice;
    if (!price) return;

    const BANDS = [
      [0.003, 'rgba(253,224,71,0.70)'], [0.006, 'rgba(251,191,36,0.65)'],
      [0.009, 'rgba(245,158,11,0.58)'],  [0.012, 'rgba(234,88,12,0.50)'],
      [0.018, 'rgba(34,211,238,0.45)'],  [0.025, 'rgba(20,184,166,0.40)'],
      [0.032, 'rgba(16,185,129,0.35)'],  [0.042, 'rgba(59,130,246,0.28)'],
      [0.054, 'rgba(99,102,241,0.22)'],  [0.068, 'rgba(139,92,246,0.16)'],
    ];
    BANDS.forEach(([pct, color]) => {
      [1 + pct, 1 - pct].forEach(mult => {
        liqSeriesRef.current.push(ser.createPriceLine({
          price: price * mult, color, lineWidth: 3, lineStyle: 0, axisLabelVisible: false, title: ''
        }));
      });
    });
  }, [showLiqMap, displayPrice]);

  useEffect(() => {
    predLinesRef.current.forEach(({ line, color }) => {
      try { line.applyOptions({ color: showPredLines ? color : 'transparent' }); } catch (_) {}
    });
  }, [showPredLines]);

  const toggleEMA = (p) => setActiveEMAs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden', flex: 1, height: '100%', borderRadius: 0, border: 'none', display: 'flex', flexDirection: 'column' }}>
      <ChartControls timeframe={timeframe} setTF={setTF} activeEMAs={activeEMAs} toggleEMA={toggleEMA}
        showBB={showBB} setBB={setBB} showRSI={showRSI} setRSI={setRSI} showVWAP={showVWAP} setVWAP={setVWAP}
        showLiqMap={showLiqMap} setLiqMap={setLiqMap} showPredLines={showPredLines} setPredLines={setPredLines}
        loading={loading} err={err} loadingMore={loadingMore} />
      <ChartHeader ohlc={ohlc} price={displayPrice} />
      <MainChartArea mainRef={mainRef} loading={loading} err={err} activeEMAs={activeEMAs} showBB={showBB} chartRef={chartRef} />
      {showRSI && <RsiPanel rsiRef={rsiRef} rsiHeight={rsiHeight} handleDragStart={handleDragStart} />}
    </section>
  );
}
