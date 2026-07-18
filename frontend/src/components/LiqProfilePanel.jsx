import React from 'react';

const BUCKETS = 40;

function heatColor(v) {
  if (v < 0.15) return `rgba(0,180,216,${0.2 + v})`;
  if (v < 0.35) return `rgba(72,199,142,${0.3 + v * 0.8})`;
  if (v < 0.55) return `rgba(250,220,60,${0.4 + v * 0.7})`;
  if (v < 0.75) return `rgba(255,140,0,${0.5 + v * 0.6})`;
  return `rgba(244,67,54,${0.6 + v * 0.4})`;
}

function buildBuckets(high, low, liqHeatmap) {
  const step = (high - low) / BUCKETS;

  // Initialize frontend buckets matching the visible range
  const buckets = Array.from({ length: BUCKETS }, (_, i) => ({
    price: high - (i + 0.5) * step,
    topEdge: high - i * step,
    bottomEdge: high - (i + 1) * step,
    rawNotional: 0,
    smoothedNotional: 0,
  }));

  let hasRealData = false;

  // Map backend OI heatmap buckets into our visible range buckets
  if (liqHeatmap && (liqHeatmap.long_buckets?.length > 0 || liqHeatmap.short_buckets?.length > 0)) {
    hasRealData = true;
    const addNotional = (backendBuckets) => {
      if (!backendBuckets) return;
      backendBuckets.forEach(b => {
        const p = b.price;
        if (p <= high && p >= low) {
          const idx = buckets.findIndex(fb => p <= fb.topEdge && p >= fb.bottomEdge);
          if (idx !== -1) buckets[idx].rawNotional += b.notionalUSD;
        }
      });
    };
    addNotional(liqHeatmap.long_buckets);
    addNotional(liqHeatmap.short_buckets);

    // Apply a simple 1D Gaussian smoothing kernel across neighboring buckets
    // Kernel roughly: [0.05, 0.25, 0.40, 0.25, 0.05]
    const kernel = [0.0547, 0.2442, 0.4026, 0.2442, 0.0547];
    const offset = Math.floor(kernel.length / 2);

    for (let i = 0; i < BUCKETS; i++) {
      let smoothed = 0;
      for (let j = 0; j < kernel.length; j++) {
        const targetIdx = i + j - offset;
        if (targetIdx >= 0 && targetIdx < BUCKETS) {
          smoothed += buckets[targetIdx].rawNotional * kernel[j];
        }
      }
      buckets[i].smoothedNotional = smoothed;
    }
  }

  let maxVol = 0;
  buckets.forEach(b => { if (b.smoothedNotional > maxVol) maxVol = b.smoothedNotional; });

  return buckets.map(b => ({
    price: b.price,
    intensity: maxVol > 0 ? b.smoothedNotional / maxVol : 0,
    isReal: hasRealData,
    volumeUSD: b.smoothedNotional, // Tooltip shows smoothed volume
  }));
}

function fmt(p) {
  return p >= 10000 ? `${(p / 1000).toFixed(1)}k` : p.toFixed(0);
}

export function LiqProfilePanel({ predictionData, currentPrice, visibleRange }) {
  const [hoveredIdx, setHoveredIdx] = React.useState(null);

  const snapshot = predictionData?.market_snapshot;
  const liq = snapshot?.liquidation_proximity;
  const heatmap = snapshot?.liq_heatmap;
  if ((!liq && !heatmap) || !currentPrice) return null;

  // Sync to visible chart range; fallback while range hasn't resolved yet
  const high = visibleRange?.high ?? currentPrice * 1.06;
  const low  = visibleRange?.low  ?? currentPrice * 0.94;
  if (high <= low) return null;

  const buckets = buildBuckets(high, low, heatmap);
  const upperLiq = liq?.upper != null ? currentPrice * (1 + liq.upper) : null;
  const lowerLiq = liq?.lower != null ? currentPrice * (1 - Math.abs(liq.lower)) : null;
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
        <span>OI Liq Estimate</span>
        <span style={{ color: '#fb923c', fontSize: '8px' }}>▲</span>
        <span style={{ color: '#10b981', fontSize: '8px' }}>▼</span>
      </div>

      {/* Rows — track visible price range */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {buckets.map(({ price, intensity, isReal, volumeUSD }, i) => {
          const isShortLiq = upperLiq != null && Math.abs(price - upperLiq) / currentPrice < tickPct * 1.5;
          const isLongLiq  = lowerLiq != null && Math.abs(price - lowerLiq) / currentPrice < tickPct * 1.5;
          const isCurrent  = Math.abs(price - currentPrice) / currentPrice < tickPct * 1.5;

          const isHovered = hoveredIdx === i;

          // Max bar width expands on hover for dynamic effect
          const barW = Math.max(isReal && volumeUSD === 0 ? 0 : 3, Math.round(intensity * (isHovered ? 85 : 60)));
          const color = heatColor(intensity);

          // Keep price labels hidden until the row is hovered to reduce chart noise.
          const showLabel = isHovered;
          const tooltipText = isReal
            ? `$${(volumeUSD / 1_000_000).toFixed(2)}M estimated level notional`
            : 'No Binance OI estimate in this price bucket';

          return (
            <div key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{
              flex: 1, display: 'flex', alignItems: 'center', position: 'relative',
              backgroundColor: isCurrent    ? 'rgba(255,255,255,0.06)'
                             : isShortLiq   ? 'rgba(249,115,22,0.06)'
                             : isLongLiq    ? 'rgba(16,185,129,0.06)'
                             : 'transparent',
              borderTop:    isCurrent ? '1px solid rgba(255,255,255,0.22)' : undefined,
              borderBottom: isCurrent ? '1px solid rgba(255,255,255,0.22)' : undefined,
            }}>
              <div
                title={tooltipText}
                style={{
                  position: 'absolute', left: 0, top: '1px', bottom: '1px',
                  width: `${barW}%`, background: color, borderRadius: '0 2px 2px 0',
                  transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s',
                  filter: isHovered ? `brightness(1.3) drop-shadow(0 0 6px ${color})` : 'none',
                  zIndex: isHovered ? 2 : 0,
              }} />
              {showLabel && (
                <span style={{
                  position: 'absolute', right: '4px',
                  fontSize: '10.5px', fontFamily: 'monospace',
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
        <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.42)' }}>Binance OI · estimated</span>
        <span style={{ fontSize: '8px', color: '#fb923c', fontWeight: 700 }}>⚡ Short</span>
        <span style={{ fontSize: '8px', color: '#10b981', fontWeight: 700 }}>Long ⚡</span>
      </div>
    </div>
  );
}
