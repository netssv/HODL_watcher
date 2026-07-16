import React from 'react';
import { fmtNum, numTrend, IndicatorCard, IndicatorGroup } from './indHelpers.jsx';

/**
 * Shows Phase 1 locally-computed indicators fetched from /api/indicators.
 * `latest` is the last record from the timeseries array.
 * `loading` / `error` control empty states.
 */
export function MicrostructureGroup({ latest, loading, error }) {
  if (loading) {
    return (
      <IndicatorGroup title="Market Microstructure" cols="3">
        <div className="ind-loading">Loading microstructure data…</div>
      </IndicatorGroup>
    );
  }
  if (error) {
    return (
      <IndicatorGroup title="Market Microstructure" cols="3">
        <div className="ind-error">{error}</div>
      </IndicatorGroup>
    );
  }
  if (!latest) return null;

  const { vwap_24, realized_vol_24, volume_delta, cvd_24, futures_basis, iv_rank } = latest;

  return (
    <IndicatorGroup title="Market Microstructure" cols="3">
      <IndicatorCard
        label="VWAP 24h"
        value={fmtNum(vwap_24, 0)}
        valueCls={vwap_24 != null ? '' : 'ind-value--na'}
        gloss="Volume-weighted average price of the last 24 candles"
        definition="Price weighted by volume. When spot trades above VWAP, buyers are in control and the day's average trade is in profit."
      />
      <IndicatorCard
        label="Realized Vol 24h"
        value={realized_vol_24 != null ? `${(realized_vol_24 * 100).toFixed(1)}%` : 'N/A'}
        valueCls={realized_vol_24 > 1.0 ? 'ind-value--down' : realized_vol_24 > 0.5 ? '' : 'ind-value--up'}
        gloss={realized_vol_24 > 1.0 ? 'High volatility — expect wide swings' : realized_vol_24 < 0.3 ? 'Calm market — breakout potential building' : 'Normal volatility range'}
        definition="Annualised standard deviation of log returns over 24 hours. Above 80% = elevated. Below 30% = compression (often precedes breakout)."
      />
      <IndicatorCard
        label="IV Rank"
        value={iv_rank != null ? `${fmtNum(iv_rank, 1)} / 100` : 'N/A'}
        valueCls={iv_rank > 80 ? 'ind-value--down' : iv_rank < 20 ? 'ind-value--up' : ''}
        gloss={iv_rank > 80 ? 'IV historically elevated — options are expensive' : iv_rank < 20 ? 'IV near lows — options cheap; event risk possible' : 'IV in normal range'}
        definition="Where current implied volatility sits relative to its 30-day range (0=at low, 100=at high). Above 80 = sell volatility; below 20 = buy volatility."
      />
      <IndicatorCard
        label="Volume Delta"
        value={volume_delta != null ? `${volume_delta > 0 ? '+' : ''}${(volume_delta / 1e3).toFixed(1)}K BTC` : 'N/A'}
        valueCls={volume_delta > 0 ? 'ind-value--up' : 'ind-value--down'}
        trend={numTrend(volume_delta)}
        gloss={volume_delta > 0 ? 'Net taker buying this candle' : 'Net taker selling this candle'}
        definition="Taker buy volume minus taker sell volume. Positive = aggressive buyers lifting the ask. Negative = aggressive sellers hitting the bid."
      />
      <IndicatorCard
        label="CVD 24h"
        value={cvd_24 != null ? `${cvd_24 > 0 ? '+' : ''}${(cvd_24 / 1e3).toFixed(1)}K BTC` : 'N/A'}
        valueCls={cvd_24 > 0 ? 'ind-value--up' : 'ind-value--down'}
        trend={numTrend(cvd_24)}
        gloss={cvd_24 > 0 ? 'Net taker buying over 24h — demand dominates' : 'Net taker selling over 24h — supply dominates'}
        definition="Cumulative Volume Delta over 24 hours. Divergence between CVD and price reveals hidden buying or selling pressure."
      />
      <IndicatorCard
        label="Futures Basis"
        value={futures_basis != null ? `${futures_basis >= 0 ? '+' : ''}${(futures_basis * 100).toFixed(3)}%` : 'N/A'}
        valueCls={futures_basis > 0.001 ? 'ind-value--up' : futures_basis < -0.001 ? 'ind-value--down' : ''}
        gloss={futures_basis > 0.001 ? 'Futures at premium — contango; bullish bias' : futures_basis < -0.001 ? 'Futures at discount — backwardation; bearish bias' : 'Futures near par — neutral bias'}
        definition="(Perp price − Spot price) / Spot price. Positive (contango) = market paying premium for futures exposure = bullish. Negative (backwardation) = capitulation or bearish dominance."
      />
    </IndicatorGroup>
  );
}
