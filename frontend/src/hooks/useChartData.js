import { useState, useCallback, useEffect } from 'react';

const RSI_KEY = 'hodl_rsi_height';

/** Encapsulates all data-fetching & WebSocket logic for the candlestick chart. */
export function useChartData(timeframe, buildAll) {
  const [ohlc, setOhlc]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState(null);

  useEffect(() => {
    let active = true;
    let ws = null;

    const load = async () => {
      setLoading(true); setErr(null);
      try {
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${timeframe}&limit=200`);
        if (!res.ok) throw new Error('Binance fetch failed');
        const data = (await res.json()).map(d => ({
          time: Math.floor(d[0] / 1000),
          open: +d[1], high: +d[2], low: +d[3], close: +d[4], volume: +d[5],
        })).sort((a, b) => a.time - b.time);

        if (!active) return;
        setOhlc(data.at(-1));
        buildAll(data);

        ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${timeframe}`);
        ws.onmessage = ({ data: raw }) => {
          if (!active) return;
          const k = JSON.parse(raw).k;
          const c = { time: Math.floor(k.t / 1000), open: +k.o, high: +k.h, low: +k.l, close: +k.c, volume: +k.v };
          setOhlc(p => p ? { ...p, high: c.high, low: c.low, close: c.close } : c);
          // Expose the candle via a custom event so the chart layer can update series directly
          window.dispatchEvent(new CustomEvent('chart:tick', { detail: c }));
        };
        setLoading(false);
      } catch (e) {
        if (active) { setErr(e.message); setLoading(false); }
      }
    };

    load();
    return () => { active = false; ws?.close(); };
  }, [timeframe, buildAll]);

  return { ohlc, loading, err };
}

/** RSI panel height — persisted to localStorage & resizable via drag. */
export function useRsiResize(rsiChartRef, mainRef, chartRef) {
  const [rsiHeight, setRsiHeight] = useState(
    () => parseInt(localStorage.getItem(RSI_KEY)) || 120
  );

  useEffect(() => {
    localStorage.setItem(RSI_KEY, String(rsiHeight));
  }, [rsiHeight]);

  const handleDragStart = useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = rsiHeight;

    const onMove = (mv) => {
      const h = Math.max(60, Math.min(startH - (mv.clientY - startY), window.innerHeight * 0.6));
      setRsiHeight(h);
      rsiChartRef.current?.applyOptions({ height: h });
      if (mainRef.current && chartRef.current)
        chartRef.current.applyOptions({ height: mainRef.current.clientHeight });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [rsiHeight, rsiChartRef, mainRef, chartRef]);

  return { rsiHeight, handleDragStart };
}
