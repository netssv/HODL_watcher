// Shared helper utilities for HODL Watcher

export const fmt = (n, d = 2) =>
  n?.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }) ?? '—';

export const fmtPct = (n, d = 1) => `${(n * 100).toFixed(d)}%`;

/** Derive status for an API connector from current gaps/error state */
export const getConnectorStatus = (name, gaps, error) => {
  if (error) return { label: 'Offline', color: 'status-offline' };
  if (gaps.some(g => g.toLowerCase().includes(name.toLowerCase())))
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

/** Derive simulated agent strategy from prediction payload */
export function deriveStrategy(payload) {
  if (!payload) return null;
  const { up, down } = payload.model_prediction.direction_probabilities;
  if (up > 0.4) return {
    recommendation: 'ACCUMULATE (LONG)',
    rationale: `Random Forest indicates upward probability (${(up * 100).toFixed(0)}%) with support levels holding.`,
    action: 'Consider spot dollar-cost averaging near order book walls.',
    agentName: 'Antigravity Strategy Agent v1',
  };
  if (down > 0.4) return {
    recommendation: 'REDUCE EXPOSURE (SHORT)',
    rationale: `Model projecting downward trend over the next ${payload.meta.horizon_hours}h.`,
    action: 'Set tight stop losses or accumulate hedge parameters.',
    agentName: 'Antigravity Strategy Agent v1',
  };
  return {
    recommendation: 'HOLD / NEUTRAL',
    rationale: 'Market showing high probability of sideways volatility.',
    action: 'Keep capital in cash reserves; wait for technical range breakouts.',
    agentName: 'Antigravity Strategy Agent v1',
  };
}
