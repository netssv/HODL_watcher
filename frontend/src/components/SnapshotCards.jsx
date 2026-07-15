import React, { useState } from 'react';
import { Activity, LineChart, ChevronDown, ChevronUp } from 'lucide-react';

// ── Signal Log ────────────────────────────────────────────────────────────────
export function SignalLogCard({ log }) {
  if (!log?.length) return null;
  return (
    <section className="card" style={{ flex: 1 }}>
      <div className="card-header">
        <h2><Activity className="w-4 h-4 text-blue-400" />Signal Log</h2>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {log.slice(0, 3).map((entry, i) => (
          <div key={i} style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', borderLeft: '2px solid #3b82f6', paddingLeft: '0.4rem' }}>
            <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: '1px' }}>
              {new Date(entry.time).toLocaleTimeString()}
            </span>
            {entry.messages.map((m, j) => (
              <span key={j} style={{ display: 'block' }}>{m}</span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Market Snapshot ───────────────────────────────────────────────────────────
function DeltaArrow({ curr, prev }) {
  if (!prev || curr === prev) return null;
  const up = curr > prev;
  return <span style={{ fontSize: '0.65rem', color: up ? '#10b981' : '#f43f5e' }}>{up ? '▲' : '▼'}</span>;
}

export function MarketSnapshotCard({ predictionData, prevPredictionData, livePrice, lastFetchedTime, isSimpleMode, collapsed }) {
  const [expanded, setExpanded] = useState(true);
  if (!predictionData) return null;

  if (collapsed) return <button className="sidebar-icon-btn" title="Market Snapshot"><LineChart size={18} /></button>;

  const price    = livePrice ?? predictionData.market_snapshot.price;
  const prevPrice = prevPredictionData?.market_snapshot?.price;
  const fg       = predictionData.market_snapshot.fear_greed_index;
  const prevFg   = prevPredictionData?.market_snapshot?.fear_greed_index;
  const fmt      = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="card">
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <div className="card-header" style={{ marginBottom: expanded ? '0.75rem' : 0 }}>
          <h2>Market Snapshot</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.5rem', color: 'var(--text-muted)' }}>
              {lastFetchedTime ? new Date(lastFetchedTime).toLocaleTimeString() : ''}
            </span>
            {expanded ? <ChevronUp size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="snapshot-grid">
          <div className="snapshot-box">
            <span className="snapshot-label">Price</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span className="snapshot-val" style={{ color: isSimpleMode ? '#0f172a' : '#fff' }}>${fmt(price)}</span>
              <DeltaArrow curr={price} prev={prevPrice} />
            </div>
          </div>
          <div className="snapshot-box">
            <span className="snapshot-label">Fear &amp; Greed</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span className="snapshot-val" style={{ color: fg > 60 ? '#10b981' : '#f43f5e' }}>{fg}</span>
              <DeltaArrow curr={fg} prev={prevFg} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
