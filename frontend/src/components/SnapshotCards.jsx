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
          <div key={i} style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', borderLeft: '2px solid #3b82f6', paddingLeft: '0.4rem' }}>
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
  return <span style={{ fontSize: '0.90rem', color: up ? '#10b981' : '#f43f5e' }}>{up ? '▲' : '▼'}</span>;
}

export function MarketSnapshotCard({ predictionData, prevPredictionData, livePrice, lastFetchedTime, isSimpleMode, collapsed }) {
  const [expanded, setExpanded] = useState(true);
  if (!predictionData) return null;
  if (collapsed) return null;

  const snap     = predictionData.market_snapshot;
  const price    = livePrice ?? snap.price;
  const prevPrice = prevPredictionData?.market_snapshot?.price;
  const fg       = snap.fear_greed_index;
  const prevFg   = prevPredictionData?.market_snapshot?.fear_greed_index;
  const fr       = snap.funding_rate?.value;
  const newsPct  = snap.news_sentiment_bullish_pct;
  const fmt      = n => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="card">
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <div className="card-header" style={{ marginBottom: expanded ? '0.75rem' : 0 }}>
          <h2>Market Snapshot</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              {lastFetchedTime ? new Date(lastFetchedTime).toLocaleTimeString() : ''}
            </span>
            {expanded ? <ChevronUp size={12} style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-secondary)' }} />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="snapshot-grid">
          <div className="snapshot-box">
            <span className="snapshot-label">Price</span>
            <span className="snapshot-val">
              ${fmt(price)}&nbsp;<DeltaArrow curr={price} prev={prevPrice} />
            </span>
          </div>
          <div className="snapshot-box">
            <span className="snapshot-label">Fear & Greed</span>
            <span className="snapshot-val" style={{ color: fg > 60 ? '#10b981' : fg < 40 ? '#f43f5e' : undefined }}>
              {fg}<span style={{ fontSize: '0.88rem', fontWeight: 500, opacity: 0.6 }}>&nbsp;/100</span>
              &nbsp;<DeltaArrow curr={fg} prev={prevFg} />
            </span>
          </div>
          {fr != null && (
            <div className="snapshot-box">
              <span className="snapshot-label">Funding Rate</span>
              <span className="snapshot-val" style={{ color: fr > 0 ? '#10b981' : '#f43f5e' }}>
                {(fr * 100).toFixed(3)}%
              </span>
            </div>
          )}
          {newsPct != null && (
            <div className="snapshot-box">
              <span className="snapshot-label">News Tone</span>
              <span className="snapshot-val" style={{ color: newsPct > 60 ? '#10b981' : newsPct < 40 ? '#f43f5e' : undefined }}>
                {newsPct.toFixed(0)}<span style={{ fontSize: '0.88rem', fontWeight: 500, opacity: 0.6 }}>% bullish</span>
              </span>
            </div>
          )}
        </div>
      )}

    </section>
  );
}

