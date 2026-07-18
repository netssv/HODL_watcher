import React from 'react';

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const finite = n => Number.isFinite(Number(n));
const signedScore = n => clamp(50 + Number(n) * 50);

function scoreComposite(payload) {
  const snap = payload.market_snapshot || {};
  const fs = snap.feature_snapshot || {};
  const price = Number(snap.price);

  // TREND: 60% EMA ordering, 20% EMA slope, 20% price versus VWAP.
  const periods = [9, 21, 50, 100, 200];
  const emas = periods.map(p => Number(fs[`ema_${p}`]));
  const alignment = emas.every(finite)
    ? emas.slice(0, -1).reduce((sum, value, i) => sum + (value > emas[i + 1] ? 1 : 0), 0) / 4
    : 0.5;
  const slopes = periods.map(p => Number(fs[`ema_${p}_slope`])).filter(finite);
  const slopeScore = slopes.length ? slopes.reduce((sum, value) => sum + signedScore(value * 100), 0) / slopes.length / 100 : 50;
  const vwap = Number(snap.market_microstructure?.vwap_24h ?? fs.vwap_24);
  const vwapScore = finite(price) && finite(vwap) && vwap ? signedScore(clamp((price / vwap - 1) / 0.02, -1, 1)) : 50;
  const trend = clamp(alignment * 60 + slopeScore * 20 + vwapScore * 20);

  // LIQUIDITY: liquidation proximity plus Order Book Depth (not VPVR).
  const liq = snap.liquidation_proximity;
  const liqScore = liq && finite(liq.upper) && finite(liq.lower) && (liq.upper + liq.lower)
    ? signedScore((Number(liq.lower) - Number(liq.upper)) / (Number(liq.lower) + Number(liq.upper))) : 50;
  const depth = snap.order_book_depth || {};
  const bidDepth = (depth.bids || []).slice(0, 20).reduce((sum, [p, q]) => sum + Number(p) * Number(q), 0);
  const askDepth = (depth.asks || []).slice(0, 20).reduce((sum, [p, q]) => sum + Number(p) * Number(q), 0);
  const depthScore = bidDepth + askDepth ? signedScore((bidDepth - askDepth) / (bidDepth + askDepth)) : 50;
  const liquidity = liqScore * 0.5 + depthScore * 0.5;

  // DERIVATIVES: 35% funding, 35% OI delta, 30% CVD.
  const funding = Number(snap.funding_rate?.value);
  const fundingScore = finite(funding) ? clamp(50 - funding * 100000) : 50;
  const oiDelta = Number(fs.hl_open_interest_delta);
  const cvd = Number(snap.market_microstructure?.cvd_24h ?? fs.cvd_24);
  const cvdZ = Number(fs.cvd_zscore);
  const oiScore = finite(oiDelta) && finite(cvd) ? (Math.sign(oiDelta) === Math.sign(cvd) ? (cvd > 0 ? 75 : 25) : 50) : 50;
  const cvdScore = finite(cvd) ? signedScore(Math.sign(cvd) * clamp(Math.abs(cvdZ) / 3 || 0.5, 0, 1)) : 50;
  const derivatives = fundingScore * 0.35 + oiScore * 0.35 + cvdScore * 0.30;

  // SENTIMENT: 50% Fear & Greed, 50% bullish news percentage.
  const fearGreed = Number(snap.fear_greed_index);
  const news = Number(snap.news_sentiment_bullish_pct);
  const sentiment = (finite(fearGreed) ? fearGreed : 50) * 0.5 + (finite(news) ? news : 50) * 0.5;

  // MACRO: DXY change is inverse; Fed rate is a weak contextual component.
  const dxyChange = Number(snap.macro?.usd_index_change_pct);
  const fedRate = Number(snap.macro?.fed_rate);
  const dxyScore = finite(dxyChange) ? signedScore(clamp(-dxyChange / 0.01, -1, 1)) : 50;
  const fedScore = finite(fedRate) ? clamp(50 - (fedRate - 4) * 5) : 50;
  const macro = dxyScore * 0.6 + fedScore * 0.4;

  const categories = { trend, liquidity, derivatives, sentiment, macro };
  const score = trend * 0.30 + liquidity * 0.25 + derivatives * 0.25 + sentiment * 0.10 + macro * 0.10;
  const signal = score >= 80 ? 'STRONG LONG' : score >= 65 ? 'LONG' : score >= 50 ? 'NEUTRAL / NO CLEAR BIAS' : score >= 35 ? 'SHORT' : 'STRONG SHORT';
  return { score, signal, categories };
}

export function CompositeScore({ payload, isSimpleMode = false }) {
  if (!payload) return null;
  const { score, signal, categories } = scoreComposite(payload);
  const blocked = payload.risk_management?.gate === 'blocked_low_confidence';
  return (
    <section className="card" style={{ padding: '1rem' }}>
      <div className="card-header" style={{ marginBottom: '0.75rem' }}>
        <h2>{isSimpleMode ? 'Stack signal' : 'Composite Technical Signal'}</h2>
        <span style={{ color: score >= 65 ? '#34d399' : score < 35 ? '#f87171' : '#fbbf24', fontWeight: 800 }}>{signal}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <strong style={{ fontSize: '1.5rem', fontFamily: 'var(--text-mono)' }}>{score.toFixed(0)}<small>/100</small></strong>
        <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.08)', borderRadius: 5, overflow: 'hidden' }}>
          <div style={{ width: `${score}%`, height: '100%', background: score >= 65 ? '#34d399' : score < 35 ? '#f87171' : '#fbbf24' }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
        {Object.entries(categories).map(([name, value]) => <div key={name} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{name.toUpperCase()} <strong style={{ color: 'var(--text-primary)' }}>{value.toFixed(0)}</strong></div>)}
      </div>
      <p style={{ margin: '0.75rem 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
        {isSimpleMode ? 'A calm read of the market ingredients. ' : 'Display-only technical composite. '}
        Liquidity uses <strong>Order Book Depth (not VPVR)</strong>.
        {blocked ? (isSimpleMode ? ' The ML gate says no trade; this signal cannot override it.' : ' ML gate: BLOCKED LOW CONFIDENCE — this technical signal does not authorize trading.') : (isSimpleMode ? ' Keep it as context, not a command.' : ' This is separate from the validated ML prediction and risk gate.')}
      </p>
    </section>
  );
}
