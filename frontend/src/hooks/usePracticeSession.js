import { useCallback, useMemo, useState } from 'react';

const DEFAULT_COOLDOWN_CANDLES = 1;

const formatSimulatedTime = timestamp => new Date(timestamp * 1000)
  .toISOString().slice(0, 16).replace('T', ' ');

/**
 * Isolated paper-trading execution state for Practice Mode.
 * `candles` must be progressively revealed; no live payload or risk gate is read.
 */
export function usePracticeSession(candles = [], cooldownCandles = DEFAULT_COOLDOWN_CANDLES, startIndex = 0) {
  const [candleIndex, setCandleIndex] = useState(startIndex);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [cooldownUntil, setCooldownUntil] = useState(0);

  const candle = candles[candleIndex] || null;
  const canTrade = Boolean(candle) && candleIndex >= cooldownUntil;
  const cooldownRemaining = Math.max(0, cooldownUntil - candleIndex);

  const advanceCandle = useCallback(() => {
    setCandleIndex(index => Math.min(index + 1, Math.max(0, candles.length - 1)));
  }, [candles.length]);

  const resetSession = useCallback(() => {
    setCandleIndex(startIndex);
    setTradeHistory([]);
    setCooldownUntil(0);
  }, [startIndex]);

  const executeTrade = ({ side, quantity, price = candle?.close }) => {
    if (!canTrade || !['buy', 'sell', 'long', 'short', 'close'].includes(side) || !Number.isFinite(Number(price))) {
      return { ok: false, reason: canTrade ? 'invalid_trade' : 'cooldown_active' };
    }
    const timestamp = Number(candle.time);
    const fillPrice = Number(price);
    const trade = {
      id: `${timestamp}-${side}-${tradeHistory.length}`,
      side,
      candleIndex,
      timestamp: new Date(timestamp * 1000).toISOString(),
      displayTimestamp: formatSimulatedTime(timestamp),
      fillPrice,
      quantity: Number(quantity),
      notional: fillPrice * Number(quantity),
      cooldownCandles,
    };
    setTradeHistory(history => [...history, trade]);
    // A 1-candle cooldown blocks the next revealed candle and re-enables on the following one.
    setCooldownUntil(candleIndex + Math.max(0, cooldownCandles) + 1);
    return { ok: true, trade };
  };

  const summary = useMemo(() => ({
    trades: tradeHistory.length,
    firstTradeAt: tradeHistory[0]?.timestamp || null,
    lastTradeAt: tradeHistory.at(-1)?.timestamp || null,
  }), [tradeHistory]);

  return {
    candle,
    candleIndex,
    tradeHistory,
    summary,
    canTrade,
    cooldownRemaining,
    advanceCandle,
    resetSession,
    executeTrade,
  };
}
