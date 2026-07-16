// Shared helper utilities for HODL Watcher

export const fmt = (n, d = 2) =>
  n?.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—';

export const fmtPct = (n, d = 1) => `${(n * 100).toFixed(d)}%`;

/** Derive status for an API connector from current gaps/error state */
export const getConnectorStatus = (name, gaps, error) => {
  if (error) return { label: 'Offline', color: 'status-offline' };
  const nameLower = name.toLowerCase();

  // Explicit Online signals from fallback sources
  if (nameLower === 'currents_news') {
    if (gaps.some(g => g.includes('news: currents_api')))
      return { label: 'Online', color: 'status-online' };
    if (gaps.some(g => g.includes('news: newsapi_fallback')))
      return { label: 'Online', color: 'status-online' };
  }
  if (nameLower === 'etf_flows') {
    if (gaps.some(g => g.includes('etf_flows: coingecko_proxy')))
      return { label: 'Proxy (CoinGecko)', color: 'status-warning' };
  }

  const hasMissingKey = gaps.some(g => {
    const gl = g.toLowerCase();
    return gl.includes(nameLower) && gl.includes('missing_key');
  });
  if (hasMissingKey) return { label: 'NO KEY', color: 'status-warning' };

  const hasMock = gaps.some(g => {
    const gl = g.toLowerCase();
    return gl.includes(nameLower) && gl.includes('mock_data');
  });
  if (hasMock) return { label: 'MOCK', color: 'status-warning' };

  if (gaps.some(g => g.toLowerCase().includes(nameLower)))
    return { label: 'Degraded', color: 'status-unknown' };
  return { label: 'Online', color: 'status-online' };
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
