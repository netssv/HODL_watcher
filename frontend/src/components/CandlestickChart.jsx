import React, { useRef, useState, useCallback, useEffect } from 'react';
import { buildBaseChart, applyCandles, applyVolume, applyEMA, applyBB, applyRSIChart } from '../utils/chartFactory';
import { useChartData, useRsiResize } from '../hooks/useChartData';
import { ChartControls, ChartHeader, MainChartArea, RsiPanel } from './ChartUI';

export default function CandlestickChart({ predictionData, thresholdPct, globalLivePrice }) {
  const mainRef = useRef(), rsiRef = useRef();
  const chartRef = useRef(null), rsiChartRef = useRef(null);
  const candleSerRef = useRef(null), volSerRef = useRef(null);

  const [timeframe, setTF]          = useState('1h');
  const [activeEMAs, setActiveEMAs] = useState([]);
  const [showBB, setBB]             = useState(false);
  const [showRSI, setRSI]           = useState(false);

  const teardown = () => {
    chartRef.current?.remove();    chartRef.current = null;
    rsiChartRef.current?.remove(); rsiChartRef.current = null;
    candleSerRef.current = null;   volSerRef.current = null;
  };

  const buildAll = useCallback((data) => {
    teardown();
    if (!mainRef.current || !data.length) return;

    const chart = buildBaseChart(mainRef.current, Math.max(mainRef.current.clientHeight, 300), true);
    candleSerRef.current = applyCandles(chart, data, predictionData, thresholdPct);
    volSerRef.current    = applyVolume(chart, data);
    activeEMAs.forEach(p => applyEMA(chart, data, p));
    if (showBB) applyBB(chart, data);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    if (showRSI && rsiRef.current) {
      rsiChartRef.current = applyRSIChart(rsiRef.current, chart, data, true);
      rsiChartRef.current.applyOptions({ height: rsiHeight });
    }
  }, [predictionData, thresholdPct, activeEMAs, showBB, showRSI]); // rsiHeight added below after hook

  const { rsiHeight, handleDragStart } = useRsiResize(rsiChartRef, mainRef, chartRef);
  const { ohlc, loading, err }         = useChartData(timeframe, buildAll);

  // Listen for WebSocket tick events and update series directly
  useEffect(() => {
    const onTick = ({ detail: c }) => {
      if (!candleSerRef.current) return;
      candleSerRef.current.update(c);
      volSerRef.current?.update({ time: c.time, value: c.volume, color: c.close >= c.open ? 'rgba(16,185,129,0.35)' : 'rgba(244,63,94,0.35)' });
    };
    window.addEventListener('chart:tick', onTick);
    return () => window.removeEventListener('chart:tick', onTick);
  }, []);

  // Resize observer
  useEffect(() => {
    const onResize = () => {
      if (mainRef.current && chartRef.current) chartRef.current.applyOptions({ width: mainRef.current.clientWidth });
      if (rsiRef.current  && rsiChartRef.current) rsiChartRef.current.applyOptions({ width: rsiRef.current.clientWidth });
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); teardown(); };
  }, []);

  const toggleEMA = (p) => setActiveEMAs(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const displayPrice = globalLivePrice ?? ohlc?.close ?? null;

  return (
    <section className="card" style={{ padding: 0, overflow: 'hidden', height: '100%', borderRadius: 0, border: 'none', display: 'flex', flexDirection: 'column' }}>
      <ChartControls
        timeframe={timeframe} setTF={setTF}
        activeEMAs={activeEMAs} toggleEMA={toggleEMA}
        showBB={showBB} setBB={setBB}
        showRSI={showRSI} setRSI={setRSI}
        loading={loading} err={err}
      />
      <ChartHeader ohlc={ohlc} price={displayPrice} />
      <MainChartArea mainRef={mainRef} loading={loading} err={err} activeEMAs={activeEMAs} />
      {showRSI && <RsiPanel rsiRef={rsiRef} rsiHeight={rsiHeight} handleDragStart={handleDragStart} />}
    </section>
  );
}
