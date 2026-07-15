import React, { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';

// --- Stat Row above chart (OHLC bar like Binance) ---
function OHLCBar({ ohlc, livePrice }) {
  const isUp = livePrice >= ohlc.open;
  const change = livePrice - ohlc.open;
  const changePct = ((change / ohlc.open) * 100).toFixed(2);
  const color = isUp ? '#10b981' : '#f43f5e';

  const fmt = (n) => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—';

  return (
    <div className="ohlc-bar">
      <span className="ohlc-pair">BTC / USDT</span>
      <span className="ohlc-price" style={{ color }}>{fmt(livePrice)}</span>
      <span className="ohlc-change" style={{ color }}>{change >= 0 ? '+' : ''}{fmt(change)} ({changePct}%)</span>
      <span className="ohlc-cell"><span className="ohlc-label">O</span>{fmt(ohlc.open)}</span>
      <span className="ohlc-cell"><span className="ohlc-label">H</span>{fmt(ohlc.high)}</span>
      <span className="ohlc-cell"><span className="ohlc-label">L</span>{fmt(ohlc.low)}</span>
      <span className="ohlc-cell"><span className="ohlc-label">C</span>{fmt(ohlc.close)}</span>
    </div>
  );
}

export default function CandlestickChart({ isSimpleMode, predictionData, thresholdPct }) {
  const chartContainerRef = useRef();
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [ohlc, setOhlc] = useState(null);
  const [livePrice, setLivePrice] = useState(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const markersDataRef = useRef([]);

  useEffect(() => {
    let active = true;
    let ws = null;

    const fetchDataAndDraw = async () => {
      try {
        const res = await fetch(
          'https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=100'
        );
        if (!res.ok) throw new Error('Failed to fetch from Binance');
        const rawData = await res.json();

        if (!active || !chartContainerRef.current) return;

        if (chartRef.current) {
          chartRef.current.remove();
          chartRef.current = null;
          seriesRef.current = null;
        }

        const bgColor = isSimpleMode ? '#f8fafc' : '#0a0c10';
        const textColor = isSimpleMode ? '#475569' : '#6b7280';
        const gridColor = isSimpleMode ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)';

        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: 'solid', color: bgColor },
            textColor,
            fontSize: 11,
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
          },
          grid: {
            vertLines: { color: gridColor },
            horzLines: { color: gridColor },
          },
          crosshair: {
            mode: 1,
            vertLine: {
              color: 'rgba(59,130,246,0.5)',
              labelBackgroundColor: '#3b82f6',
            },
            horzLine: {
              color: 'rgba(59,130,246,0.5)',
              labelBackgroundColor: '#3b82f6',
            },
          },
          rightPriceScale: {
            borderColor: isSimpleMode ? '#e2e8f0' : 'rgba(255,255,255,0.07)',
          },
          timeScale: {
            borderColor: isSimpleMode ? '#e2e8f0' : 'rgba(255,255,255,0.07)',
            timeVisible: true,
            secondsVisible: false,
          },
          width: chartContainerRef.current.clientWidth,
          height: 320,
        });

        // v5 API: chart.addSeries(CandlestickSeries, options)
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#10b981',
          downColor: '#f43f5e',
          borderVisible: false,
          wickUpColor: '#10b981',
          wickDownColor: '#f43f5e',
        });

        const formattedData = rawData.map(d => ({
          time: Math.floor(d[0] / 1000),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
        })).sort((a, b) => a.time - b.time);

        candleSeries.setData(formattedData);

        // Set initial OHLC for the bar
        const last = formattedData[formattedData.length - 1];
        if (active) {
          setOhlc(last);
          setLivePrice(last.close);
        }

        // Draw threshold price lines
        if (predictionData && last) {
          const price = last.close;
          const upTarget = price * (1 + thresholdPct);
          const downTarget = price * (1 - thresholdPct);

          candleSeries.createPriceLine({
            price: upTarget,
            color: 'rgba(16, 185, 129, 0.7)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `+${(thresholdPct * 100).toFixed(1)}%`,
          });
          candleSeries.createPriceLine({
            price: downTarget,
            color: 'rgba(244, 63, 94, 0.7)',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `-${(thresholdPct * 100).toFixed(1)}%`,
          });
        }

        // Prediction direction marker
        if (predictionData && last) {
          const probs = predictionData.model_prediction.direction_probabilities;
          let maxDir = 'sideways', maxProb = probs.sideways;
          if (probs.up > maxProb) { maxDir = 'up'; maxProb = probs.up; }
          if (probs.down > maxProb) { maxDir = 'down'; maxProb = probs.down; }

          const markerList = [{
            time: last.time,
            position: maxDir === 'down' ? 'aboveBar' : 'belowBar',
            color: maxDir === 'up' ? '#10b981' : maxDir === 'down' ? '#f43f5e' : '#9ca3af',
            shape: maxDir === 'up' ? 'arrowUp' : maxDir === 'down' ? 'arrowDown' : 'circle',
            text: `${maxDir.toUpperCase()} ${(maxProb * 100).toFixed(0)}%`,
          }];
          markersDataRef.current = markerList;
          createSeriesMarkers(candleSeries, markerList);
        }

        chart.timeScale().fitContent();
        chartRef.current = chart;
        seriesRef.current = candleSeries;

        // WebSocket for live candle updates
        ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1h');
        ws.onmessage = (event) => {
          if (!active || !seriesRef.current) return;
          const msg = JSON.parse(event.data);
          const k = msg.k;
          const candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
          };
          seriesRef.current.update(candle);
          if (active) {
            setLivePrice(candle.close);
            setOhlc(prev => prev ? { ...prev, high: candle.high, low: candle.low, close: candle.close } : candle);
          }
        };

        if (active) setLoading(false);
      } catch (err) {
        console.error('Chart error:', err);
        if (active) {
          setErrorMsg(err.message);
          setLoading(false);
        }
      }
    };

    fetchDataAndDraw();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      active = false;
      if (ws) ws.close();
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [isSimpleMode, predictionData, thresholdPct]);

  return (
    <div className="chart-shell">
      {/* OHLC header bar */}
      {ohlc && livePrice ? (
        <OHLCBar ohlc={ohlc} livePrice={livePrice} />
      ) : (
        <div className="ohlc-bar ohlc-bar--skeleton" />
      )}

      {/* Chart area */}
      <div style={{ position: 'relative', width: '100%', height: '320px' }}>
        {loading && (
          <div className="chart-overlay">
            <span className="chart-loading-spinner" />
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Connecting to Binance…
            </span>
          </div>
        )}
        {errorMsg && (
          <div className="chart-overlay" style={{ color: '#f43f5e', fontSize: '0.75rem' }}>
            ⚠ {errorMsg}
          </div>
        )}
        <div
          ref={chartContainerRef}
          style={{ width: '100%', height: '100%', opacity: loading || errorMsg ? 0 : 1, transition: 'opacity 0.4s' }}
        />
      </div>

      {/* Live dot */}
      {!loading && !errorMsg && (
        <div className="chart-live-badge">
          <span className="live-dot" />
          LIVE · Binance WS
        </div>
      )}
    </div>
  );
}
