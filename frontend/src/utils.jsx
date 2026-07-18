// Shared helper utilities for HODL Watcher

export const fmt = (n, d = 2) =>
  n?.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—';

export const fmtPct = (n, d = 1) => `${(n * 100).toFixed(d)}%`;

/** Derive status for an API connector from current gaps/error state */
export const getConnectorStatus = (name, gaps, error) => {
  if (error) return { label: 'Offline', color: 'status-offline', detail: 'The backend is unreachable.' };
  const nameLower = name.toLowerCase();

  if (nameLower === 'okx') {
    if (gaps.some(g => g.includes('spot_source: kraken_fallback')))
      return { label: 'Degraded', color: 'status-unknown', detail: 'OKX failed; Kraken is currently supplying spot candles.' };
    if (gaps.some(g => g.includes('spot_source: okx_fallback')))
      return { label: 'Fallback (Active)', color: 'status-warning', detail: 'OKX is currently supplying spot candles because Binance spot data failed or was empty.' };
    if (gaps.some(g => g.toLowerCase().includes('okx_spot:')))
      return { label: 'Degraded', color: 'status-unknown', detail: 'OKX was tried as a fallback but also returned an error or no data.' };
    return { label: 'Standby', color: 'status-online', detail: 'OKX is available as a spot-data fallback and is not currently being used.' };
  }

  if (nameLower === 'kraken') {
    if (gaps.some(g => g.includes('spot_source: bybit_fallback')))
      return { label: 'Degraded', color: 'status-unknown', detail: 'Kraken failed; Bybit is currently supplying spot candles.' };
    if (gaps.some(g => g.includes('spot_source: kraken_fallback')))
      return { label: 'Fallback (Active)', color: 'status-warning', detail: 'Kraken is currently supplying spot candles because Binance and OKX failed or returned no data.' };
    if (gaps.some(g => g.toLowerCase().includes('kraken_spot:')))
      return { label: 'Degraded', color: 'status-unknown', detail: 'Kraken was tried as the final spot-data fallback but also returned an error or no data.' };
    return { label: 'Standby', color: 'status-online', detail: 'Kraken is available as the final spot-data fallback and is not currently being used.' };
  }

  if (nameLower === 'bybit') {
    if (gaps.some(g => g.includes('spot_source: bybit_fallback')))
      return { label: 'Fallback (Active)', color: 'status-warning', detail: 'Bybit is supplying spot candles because Binance, OKX, and Kraken failed or returned no data.' };
    if (gaps.some(g => g.toLowerCase().includes('bybit_spot:')))
      return { label: 'Degraded', color: 'status-unknown', detail: 'Bybit was tried as the final spot-data fallback but returned an error or no data.' };
    return { label: 'Standby', color: 'status-online', detail: 'Bybit is available as the final spot-data fallback and is not currently being used.' };
  }

  if (nameLower === 'binance' && gaps.some(g => g.includes('trying OKX fallback')))
    return { label: 'Degraded', color: 'status-unknown', detail: 'A Binance spot request failed or returned no data; OKX is being used as the fallback.' };

  if (nameLower === 'bitcoin_network') {
    if (gaps.some(g => g.toLowerCase().includes('bitcoin_network:')))
      return { label: 'Degraded', color: 'status-unknown', detail: 'Mempool.space network metrics could not be loaded.' };
    return { label: 'Online', color: 'status-online', detail: 'Mempool size, pending transactions, and recommended fees are available from mempool.space.' };
  }

  // Explicit Online signals from fallback sources
  if (nameLower === 'currents_news') {
    if (gaps.some(g => g.includes('news: currents_api')))
      return { label: 'Online', color: 'status-online', detail: 'Currents is providing the news feed.' };
    if (gaps.some(g => g.includes('news: newsapi_fallback')))
      return { label: 'Online', color: 'status-online', detail: 'NewsAPI is providing the news fallback.' };
    if (gaps.some(g => g.includes('news: gnews_fallback')))
      return { label: 'Online', color: 'status-online', detail: 'GNews is providing the news fallback.' };
  }
  if (nameLower === 'etf_flows') {
    if (gaps.some(g => g.includes('btc_volume_proxy: coingecko')))
      return { label: 'Proxy (CoinGecko)', color: 'status-warning', detail: 'CoinGecko volume is being used as a proxy; this is not ETF flow data.' };
  }

  if (nameLower === 'coinalyze' && gaps.some(g => g.includes('coinalyze: binance_public_fallback')))
    return { label: 'Fallback (Binance)', color: 'status-warning', detail: 'Binance public data is being used because Coinalyze data is unavailable.' };
  if (nameLower === 'deribit' && gaps.some(g => g.toLowerCase().includes('deribit: unavailable')))
    return { label: 'Unavailable', color: 'status-warning', detail: 'No Deribit options data is available.' };
  if (nameLower === 'onchain' && gaps.some(g => g.toLowerCase().includes('onchain_exchange_flows: unavailable')))
    return { label: 'Unavailable', color: 'status-warning', detail: 'No on-chain data is available.' };

  const hasMissingKey = gaps.some(g => {
    const gl = g.toLowerCase();
    return gl.includes(nameLower) && gl.includes('missing_key');
  });
  if (hasMissingKey) return { label: 'NO KEY', color: 'status-warning', detail: `The ${name} API key is missing.` };

  const hasMock = gaps.some(g => {
    const gl = g.toLowerCase();
    return gl.includes(nameLower) && gl.includes('mock_data');
  });
  if (hasMock) return { label: 'MOCK', color: 'status-warning', detail: `${name} is using simulated data.` };

  if (gaps.some(g => g.toLowerCase().includes(nameLower)))
    return { label: 'Degraded', color: 'status-unknown', detail: gaps.filter(g => g.toLowerCase().includes(nameLower)).join(' ') };
  return { label: 'Online', color: 'status-online', detail: `${name} is responding normally.` };
};

/** Return JSX badge for baseline comparison */
export function BaselineBadge({ status }) {
  if (status === 'better')
    return <span className="badge-beats-naive badge-better">Beats naive baselines</span>;
  if (status === 'worse')
    return <span className="badge-beats-naive badge-worse">Underperforms naive baselines</span>;
  return <span className="badge-beats-naive badge-indistinguishable">Indistinguishable from baseline</span>;
}

/** Simple mode big projection badge */
export function FriendlyProjection({ payload }) {
  if (!payload) return null;
  const { up, down, sideways } = payload.model_prediction.direction_probabilities;
  if (up > down && up > sideways)
    return <div className="friendly-badge friendly-up">📈 Bullish Trend Expected ({(up * 100).toFixed(0)}% Probability)</div>;
  if (down > up && down > sideways)
    return <div className="friendly-badge friendly-down">📉 Bearish Trend Expected ({(down * 100).toFixed(0)}% Probability)</div>;
  return <div className="friendly-badge friendly-neutral">↔️ Sideways Range Expected ({(sideways * 100).toFixed(0)}% Probability)</div>;
}

export function deriveStrategy(payload) {
  if (!payload) return null;
  const { up, down } = payload.model_prediction.direction_probabilities;
  const meanAcc = payload.validation_summary?.mean_accuracy || 0;
  const stdAcc = payload.validation_summary?.std_accuracy || 0;
  const baselineStatus = payload.validation_summary?.accuracy_vs_naive_baseline || "";
  const confidenceNote = payload.model_prediction?.confidence_note || "";

  // If confidence is low or indistinguishable, override direction
  const isLowConfidence = 
    baselineStatus === 'worse' || 
    baselineStatus === 'indistinguishable' || 
    confidenceNote.includes('CONFIDENCE LOW') ||
    meanAcc < 0.55 || 
    stdAcc > 0.15;

  if (isLowConfidence) {
    return {
      recommendation: 'NO ACTION / HOLD',
      rationale: `Low confidence (Accuracy: ${(meanAcc * 100).toFixed(1)}%, σ: ${(stdAcc * 100).toFixed(1)}%).`,
      action: 'Do not take directional positions. Wait for clearer setup.',
      agentName: 'Antigravity Strategy Agent v1',
      isLowConfidence: true
    };
  }

  if (up > 0.4) return {
    recommendation: 'ADD EXPOSURE (LONG)',
    rationale: `Random Forest indicates upward probability (${(up * 100).toFixed(0)}%) with support levels holding.`,
    action: 'Consider spot dollar-cost averaging near order book walls.',
    agentName: 'Antigravity Strategy Agent v1',
    isLowConfidence: false
  };
  if (down > 0.4) return {
    recommendation: 'REDUCE EXPOSURE (SHORT)',
    rationale: `Model projecting downward trend over the next ${payload.meta.horizon_hours}h.`,
    action: 'Set tight stop losses or accumulate hedge parameters.',
    agentName: 'Antigravity Strategy Agent v1',
    isLowConfidence: false
  };
  return {
    recommendation: 'HOLD / NEUTRAL',
    rationale: 'Market showing high probability of sideways volatility.',
    action: 'Keep capital in cash reserves; wait for technical range breakouts.',
    agentName: 'Antigravity Strategy Agent v1',
    isLowConfidence: false
  };
}
