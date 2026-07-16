import React from 'react';
import { fmtNum, trendArrow, numTrend, IndicatorCard, IndicatorGroup } from './indHelpers.jsx';

export function DerivativesGroup({ rsi, fr, ls, liq, opt, hl }) {
  return (
    <IndicatorGroup title="Derivatives" cols="3">
      <IndicatorCard
        label="RSI 6/12/24"
        value={rsi ? `${rsi['6'].toFixed(1)} / ${rsi['12'].toFixed(1)} / ${rsi['24'].toFixed(1)}` : 'N/A'}
        gloss={rsi && rsi['6'] > 70 ? 'All short windows overbought' : rsi && rsi['6'] < 30 ? 'Oversold — bounce possible' : 'Momentum neutral'}
        definition=">70 = overbought. <30 = oversold. All three rising confirms strengthening momentum."
      />
      <IndicatorCard
        label="Funding Rate"
        valueCls={fr?.value > 0 ? 'ind-value--up' : 'ind-value--down'}
        value={fr ? `${(fr.value * 100).toFixed(4)}%` : 'N/A'}
        trend={trendArrow(fr?.trend)}
        gloss={fr?.trend === 'rising' ? 'Longs paying more — crowd risk building' : fr?.trend === 'falling' ? 'Funding declining' : 'Stable'}
        definition="Perpetual futures fee paid every 8h. Positive = longs paying shorts."
      />
      <IndicatorCard
        label="L/S Ratio"
        valueCls={ls?.value > 1 ? 'ind-value--up' : 'ind-value--down'}
        value={ls ? ls.value.toFixed(2) : 'N/A'}
        trend={trendArrow(ls?.trend)}
        gloss={ls?.value > 1.2 ? 'Crowd bullish' : ls?.value < 0.8 ? 'Short squeeze fuel' : 'Balanced'}
        definition="Long/Short Ratio. Above 1.0 = more traders betting on a rise."
      />
      <IndicatorCard
        label="Liq. Proximity"
        value={liq ? `+${(liq.upper * 100).toFixed(1)}% / -${(liq.lower * 100).toFixed(1)}%` : 'N/A'}
        gloss={liq && liq.upper < 0.03 ? 'Tight upside — short squeeze risk' : 'Clusters at safe distance'}
        definition="Distance to forced-liquidation clusters above (+) and below (-) price."
      />
      <IndicatorCard
        label="IV / 25d Skew / P/C"
        value={opt ? `${opt.dvol.toFixed(1)} / ${(opt.skew_25d * 100).toFixed(1)}% / ${opt.put_call_ratio.toFixed(2)}` : 'N/A'}
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

export function OnChainGroup({ onchain }) {
  return (
    <IndicatorGroup title="On-Chain & Flows" cols="2">
      <IndicatorCard
        label="Exch. Net Flow"
        valueCls={onchain?.exchange_net_flow < 0 ? 'ind-value--up' : 'ind-value--down'}
        value={onchain ? `${onchain.exchange_net_flow.toFixed(1)} BTC` : 'N/A'}
        trend={numTrend(onchain?.exchange_net_flow, 0, true)}
        gloss={onchain?.exchange_net_flow < 0 ? 'BTC leaving exchanges — holders accumulating' : 'BTC inflows — selling pressure possible'}
        definition="Negative = BTC moving to cold wallets. Positive = prepping for sale."
      />
      <IndicatorCard
        label="ETF Net Flow"
        valueCls={onchain?.etf_net_flow > 0 ? 'ind-value--up' : 'ind-value--down'}
        value={onchain ? `$${onchain.etf_net_flow.toFixed(1)}M` : 'N/A'}
        trend={numTrend(onchain?.etf_net_flow)}
        gloss={onchain?.etf_net_flow > 0 ? 'Institutional buying' : 'ETF redemptions — institutional selling'}
        definition="Dollar value flowing into/out of spot Bitcoin ETFs."
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
        label="DXY (US Dollar)"
        valueCls={macro?.dxy > 104 ? 'ind-value--down' : macro?.dxy > 0 ? 'ind-value--up' : 'ind-value--na'}
        value={macro?.dxy > 0 ? fmtNum(macro.dxy, 2) : 'No data'}
        gloss={macro?.dxy > 104 ? 'Strong dollar — headwind for BTC' : macro?.dxy > 0 ? 'Dollar weakening — BTC tailwind' : 'FRED API key not configured'}
        definition="US Dollar Index. DXY rise = headwind for BTC. DXY fall = tailwind."
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
