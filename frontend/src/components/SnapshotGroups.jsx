import React from 'react';
import { fmtNum, trendArrow, numTrend, IndicatorCard, IndicatorGroup } from './indHelpers.jsx';

export function DerivativesGroup({ rsi, fr, ls, liq, opt, hl }) {
  return (
    <IndicatorGroup title="Derivatives" cols="3">
      <IndicatorCard
        label="RSI 6/12/24"
        value={rsi?.['6'] != null && rsi?.['12'] != null && rsi?.['24'] != null ? `${rsi['6'].toFixed(1)} / ${rsi['12'].toFixed(1)} / ${rsi['24'].toFixed(1)}` : 'N/A'}
        gloss={rsi && rsi['6'] > 70 ? 'All short windows overbought' : rsi && rsi['6'] < 30 ? 'Oversold — bounce possible' : 'Momentum neutral'}
        definition=">70 = overbought. <30 = oversold. All three rising confirms strengthening momentum."
      />
      <IndicatorCard
        label="Funding Rate"
        valueCls={fr?.value > 0 ? 'ind-value--up' : 'ind-value--down'}
        value={fr?.value != null ? `${(fr.value * 100).toFixed(4)}%` : 'N/A'}
        trend={trendArrow(fr?.trend)}
        gloss={fr?.trend === 'rising' ? 'Longs paying more — crowd risk building' : fr?.trend === 'falling' ? 'Funding declining' : 'Stable'}
        definition="Perpetual futures fee paid every 8h. Positive = longs paying shorts."
      />
      <IndicatorCard
        label="L/S Ratio"
        valueCls={ls?.value > 1 ? 'ind-value--up' : 'ind-value--down'}
        value={ls?.value != null ? ls.value.toFixed(2) : 'N/A'}
        trend={trendArrow(ls?.trend)}
        gloss={ls?.value > 1.2 ? 'Crowd bullish' : ls?.value < 0.8 ? 'Short squeeze fuel' : 'Balanced'}
        definition="Long/Short Ratio. Above 1.0 = more traders betting on a rise."
      />
      <IndicatorCard
        label="Liq. Proximity"
        value={liq?.upper != null && liq?.lower != null ? `+${(liq.upper * 100).toFixed(1)}% / -${(liq.lower * 100).toFixed(1)}%` : 'N/A'}
        gloss={liq && liq.upper < 0.03 ? 'Tight upside — short squeeze risk' : 'Clusters at safe distance'}
        definition="Distance to forced-liquidation clusters above (+) and below (-) price."
      />
      <IndicatorCard
        label="IV / 25d Skew / P/C"
        value={opt?.dvol != null ? `${opt.dvol.toFixed(1)} / ${opt.skew_25d != null ? `${(opt.skew_25d * 100).toFixed(1)}%` : 'N/A'} / ${opt.put_call_ratio != null ? opt.put_call_ratio.toFixed(2) : 'N/A'}` : 'N/A'}
        valueCls={opt?.skew_25d < -0.05 ? 'ind-value--down' : ''}
        gloss={opt ? (opt.skew_25d < -0.05 ? 'Puts pricier — hedging crash risk' : opt.put_call_ratio > 1 ? 'Net fear hedging' : 'Options calm') : ''}
        definition="IV = expected swing. 25d Skew = puts vs calls premium. P/C > 1 means fear."
      />
      <IndicatorCard
        label="HL OI / Funding"
        value={hl?.open_interest ? `${(hl.open_interest / 1e6).toFixed(1)}M` : 'N/A'}
        gloss={hl?.funding_rate != null && fr?.value != null && Math.abs(hl.funding_rate - fr.value) > 0.0001 ? 'Diverges from Binance — arb pressure' : 'Aligned with Binance'}
        definition="Hyperliquid DEX open interest and funding. Divergence from Binance signals arb flows."
      />
    </IndicatorGroup>
  );
}

export function NetworkGroup({ network }) {
  const mempool = network?.mempool;
  const fees = network?.fees;
  return (
    <IndicatorGroup title="Bitcoin Network" cols="2">
      <IndicatorCard
        label="Mempool Transactions"
        value={mempool?.count != null ? fmtNum(mempool.count, 0) : 'No data'}
        gloss="Unconfirmed Bitcoin transactions waiting for blocks"
        definition="Current unconfirmed transaction count from mempool.space. This is network activity, not exchange flow."
      />
      <IndicatorCard
        label="Fastest Fee"
        value={fees?.fastest_fee != null ? `${fmtNum(fees.fastest_fee, 0)} sat/vB` : 'No data'}
        gloss="Recommended fee for faster confirmation"
        definition="Mempool.space recommended fastest fee in satoshis per virtual byte."
      />
    </IndicatorGroup>
  );
}

export function SentimentGroup({ fg, newsPct }) {
  return (
    <IndicatorGroup title="Sentiment" cols="2">
      <IndicatorCard
        label="Fear & Greed"
        valueCls={fg > 75 ? 'ind-value--down' : fg < 25 ? 'ind-value--up' : ''}
        value={fg != null ? `${fg} / 100` : 'N/A'}
        gloss={fg > 75 ? 'Extreme greed — caution near tops' : fg < 25 ? 'Extreme fear — contrarian opportunity' : 'Neutral'}
        definition="0–100 composite. Below 25 = extreme fear (near bottoms). Above 75 = extreme greed (near tops)."
      />
      <IndicatorCard
        label="News Tone"
        valueCls={newsPct != null ? (newsPct > 60 ? 'ind-value--up' : newsPct < 40 ? 'ind-value--down' : '') : 'ind-value--na'}
        value={newsPct != null ? `${newsPct.toFixed(0)}% bullish` : 'No data'}
        gloss={newsPct != null ? (newsPct > 70 ? 'Overwhelmingly positive — contrarian caution' : newsPct < 30 ? 'Mostly negative — possible capitulation' : 'Mixed coverage') : 'Currents API not configured'}
        definition="Share of BTC headlines skewing positive. Above 70% bullish near a top is a contrarian warning."
      />
    </IndicatorGroup>
  );
}

export function MacroGroup({ macro }) {
  return (
    <IndicatorGroup title="Macro" cols="2">
      <IndicatorCard
        label="DXY (ICE)"
        valueCls={macro?.usd_index_change_pct > 0 ? 'ind-value--down' : macro?.usd_index_change_pct < 0 ? 'ind-value--up' : 'ind-value--na'}
        value={macro?.usd_index != null ? `${fmtNum(macro.usd_index, 2)}${macro.usd_index_change_pct != null ? ` (${macro.usd_index_change_pct >= 0 ? '+' : ''}${(macro.usd_index_change_pct * 100).toFixed(2)}%)` : ''}` : 'No data'}
        gloss={macro?.usd_index_change_pct > 0 ? 'DXY rising — BTC headwind' : macro?.usd_index_change_pct < 0 ? 'DXY falling — BTC tailwind' : 'Daily change unavailable'}
        definition="ICE U.S. Dollar Index (DXY), sourced from the DX-Y.NYB market quote. Quote data may be delayed."
      />
      <IndicatorCard
        label="Fed Funds Rate"
        valueCls={macro?.fed_rate > 4 ? 'ind-value--down' : macro?.fed_rate > 0 ? '' : 'ind-value--na'}
        value={macro?.fed_rate > 0 ? `${fmtNum(macro.fed_rate, 2)}%` : 'No data'}
        gloss={macro?.fed_rate > 4 ? 'Elevated rates — tight liquidity' : macro?.fed_rate > 0 ? 'Lower rates = looser money' : 'FRED API key not configured'}
        definition="Federal Funds Rate. Higher rates = tighter credit = BTC headwind."
      />
    </IndicatorGroup>
  );
}
