import React from 'react';

const BUCKETS = 40;

function heatColor(v) {
  if (v < 0.15) return `rgba(0,180,216,${0.2 + v})`;
  if (v < 0.35) return `rgba(72,199,142,${0.3 + v * 0.8})`;
  if (v < 0.55) return `rgba(250,220,60,${0.4 + v * 0.7})`;
  if (v < 0.75) return `rgba(255,140,0,${0.5 + v * 0.6})`;
  return `rgba(244,67,54,${0.6 + v * 0.4})`;
}

function gauss(x, mu, sigma) {
  return Math.exp(-0.5 * ((x - mu) / sigma) ** 2);
}

function buildBuckets(high, low, liq, currentPrice) {
  const step = (high - low) / BUCKETS;
  const sigma = currentPrice * 0.013;
  const upperLiq = currentPrice * (1 + (liq.upper || 0.02));
  const lowerLiq = currentPrice * (1 - Math.abs(liq.lower || 0.02));

  return Array.from({ length: BUCKETS }, (_, i) => {
    const price = high - (i + 0.5) * step;
    const raw = gauss(price, upperLiq, sigma) * 0.75
              + gauss(price, lowerLiq, sigma) * 0.75
              + 0.05; // very subtle base floor
    return { price, intensity: Math.min(1, raw) };
  });
}

function fmt(p) {
  return p >= 10000 ? `${(p / 1000).toFixed(1)}k` : p.toFixed(0);
}

export function LiqProfilePanel({ predictionData, currentPrice, visibleRange }) {
  const liq = predictionData?.market_snapshot?.liquidation_proximity;
  if (!liq || !currentPrice) return null;

  // Sync to visible chart range; fallback while range hasn't resolved yet
  const high = visibleRange?.high ?? currentPrice * 1.06;
  const low  = visibleRange?.low  ?? currentPrice * 0.94;
  if (high <= low) return null;

  const buckets = buildBuckets(high, low, liq, currentPrice);
  const upperLiq = currentPrice * (1 + (liq.upper || 0.02));
  const lowerLiq = currentPrice * (1 - Math.abs(liq.lower || 0.02));
  const tickPct  = (high - low) / currentPrice / BUCKETS;

  return (
    <div style={{
      width: '120px', flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      backgroundColor: 'rgba(6,8,13,0.97)',
      borderLeft: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '4px 8px', fontSize: '9px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.35)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexShrink: 0,
      }}>
        <span>Liq Profile</span>
        <span style={{ color: '#fb923c', fontSize: '8px' }}>▲</span>
        <span style={{ color: '#10b981', fontSize: '8px' }}>▼</span>
      </div>

      {/* Rows — track visible price range */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {buckets.map(({ price, intensity }, i) => {
          const isShortLiq = Math.abs(price - upperLiq) / currentPrice < tickPct * 1.5;
          const isLongLiq  = Math.abs(price - lowerLiq) / currentPrice < tickPct * 1.5;
          const isCurrent  = Math.abs(price - currentPrice) / currentPrice < tickPct * 1.5;

          // Max bar width = 60%; avoids misleading "full" look
          const barW = Math.max(3, Math.round(intensity * 60));
          const color = heatColor(intensity);

          // Only label key levels + every 8th row to reduce noise
          const showLabel = isCurrent || isShortLiq || isLongLiq || i % 8 === 0;

          return (
            <div key={i} style={{
              flex: 1, display: 'flex', alignItems: 'center', position: 'relative',
              backgroundColor: isCurrent    ? 'rgba(255,255,255,0.06)'
                             : isShortLiq   ? 'rgba(249,115,22,0.06)'
                             : isLongLiq    ? 'rgba(16,185,129,0.06)'
                             : 'transparent',
              borderTop:    isCurrent ? '1px solid rgba(255,255,255,0.22)' : undefined,
              borderBottom: isCurrent ? '1px solid rgba(255,255,255,0.22)' : undefined,
            }}>
              <div style={{
                position: 'absolute', left: 0, top: '1px', bottom: '1px',
                width: `${barW}%`, background: color, borderRadius: '0 2px 2px 0',
              }} />
              {showLabel && (
                <span style={{
                  position: 'absolute', right: '4px',
                  fontSize: '7.5px', fontFamily: 'monospace',
                  fontWeight: isCurrent ? 700 : isShortLiq || isLongLiq ? 600 : 400,
                  color: isCurrent  ? '#fff'
                       : isShortLiq ? '#fb923c'
                       : isLongLiq  ? '#10b981'
                       : 'rgba(255,255,255,0.22)',
                  zIndex: 1, lineHeight: 1, pointerEvents: 'none',
                }}>
                  {fmt(price)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        padding: '3px 8px', borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: '8px', color: '#fb923c', fontWeight: 700 }}>⚡ Short</span>
        <span style={{ fontSize: '8px', color: '#10b981', fontWeight: 700 }}>Long ⚡</span>
      </div>
    </div>
  );
}
