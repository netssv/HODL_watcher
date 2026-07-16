import React from 'react';
import { Info } from 'lucide-react';

export function GuideBanner({ isSimpleMode }) {
  return (
    <section className="banner banner-guide" style={{ padding: '1rem' }}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: isSimpleMode ? '#0f172a' : '#ffffff', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <Info className="w-4 h-4 text-blue-500" />
          Technical Methodology
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <strong>1. Walk-Forward Testing Accuracy:</strong>
            <div style={{ fontSize: '0.90rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
              The model is evaluated using chronologically ordered splits (not random CV) to strictly prevent looking into the future. "Tested accuracy" measures the percentage of correct directional predictions over the last 6-8 periods (folds). If the model is underperforming the baseline, check the Walk-Forward Trend widget to see recent deterioration.
            </div>
          </div>
          <div>
            <strong>2. Data Leakage Prevention (24-Hour Embargo):</strong>
            <div style={{ fontSize: '0.90rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
              A mandatory 24-hour buffer interval is enforced between train and test cuts. This nullifies overlap and autocorrelation, ensuring the model cannot "memorize" overlapping rolling features.
            </div>
          </div>
          <div>
            <strong>3. Reading Confidence Labels:</strong>
            <div style={{ fontSize: '0.90rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
              • <strong>HIGH:</strong> Both directional probability (&gt;60%) and recent walk-forward accuracy support the signal. Standard position sizing.<br/>
              • <strong>MEDIUM:</strong> Mixed signals or moderate probability. Reduce position size by half.<br/>
              • <strong>LOW / NO_TRADE:</strong> Model predicts sideways movement or conflicting extremes. Stay out of the market.
            </div>
          </div>
          <div>
            <strong>4. Advanced Indicator Definitions:</strong>
            <div style={{ fontSize: '0.90rem', marginTop: '0.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>RSI (Relative Strength Index):</strong> Measures momentum to identify overbought (&gt;70) or oversold (&lt;30) conditions.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Funding Rate:</strong> Periodic payments between longs/shorts; highly positive means longs are paying shorts (overleveraged bullishness).</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>L/S Ratio (Long/Short):</strong> The ratio of accounts net-long vs net-short; contrarian indicator when extreme.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Liq Proximity:</strong> Distance to major liquidation clusters (price magnets) where forced selling/buying occurs.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>IV/Skew:</strong> Implied Volatility and Put/Call Skew from options markets indicating expected future turbulence.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Exch Net Flow:</strong> On-chain metric tracking net Bitcoin moving into/out of centralized exchanges.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>ETF Net Flow:</strong> Institutional capital moving in or out of spot Bitcoin ETFs.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
