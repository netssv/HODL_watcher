import React, { useState, useEffect, useRef } from 'react';
import '../styles/indicators.css';
import { DerivativesGroup, NetworkGroup, SentimentGroup, MacroGroup } from './SnapshotGroups.jsx';
import { MicrostructureGroup } from './MicrostructureGroup.jsx';

const POLL_MS = 120_000; // 2-minute refresh for microstructure data
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export function AdvancedIndicators({ snapshot }) {
  const [micro, setMicro] = useState({ data: null, loading: true, error: null });
  const timerRef = useRef(null);

  const fetchMicro = () => {
    fetch(`${API_BASE}/api/indicators?limit=50`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(json => {
        const records = json.data ?? [];
        const latest = records.length > 0 ? records[records.length - 1] : null;
        setMicro({ data: latest, loading: false, error: null });
      })
      .catch(err => {
        setMicro(prev => ({ ...prev, loading: false, error: err.message }));
      });
  };

  useEffect(() => {
    fetchMicro();
    timerRef.current = setInterval(fetchMicro, POLL_MS);
    return () => clearInterval(timerRef.current);
  }, []);

  if (!snapshot) return null;

  const {
    rsi, funding_rate: fr, long_short_ratio: ls,
    liquidation_proximity: liq, deribit_options: opt,
    bitcoin_network: network, hyperliquid: hl, macro,
    news_sentiment_bullish_pct: newsPct, fear_greed_index: fg,
    market_regime,
  } = snapshot;

  const regimeColor = market_regime === 0 ? '#f59e0b' : '#10b981';
  const regimeLabel = market_regime === 1 ? 'Regime: Trending Up'
    : market_regime === -1 ? 'Regime: Trending Down' : 'Regime: Ranging / Volatile';

  return (
    <div className="adv-indicators">
      <h3 className="adv-indicators-heading">Advanced Indicators</h3>

      {/* Phase 1 — live fetched microstructure */}
      <MicrostructureGroup
        latest={micro.data}
        loading={micro.loading}
        error={micro.error}
      />

      {/* Snapshot-based groups */}
      <DerivativesGroup rsi={rsi} fr={fr} ls={ls} liq={liq} opt={opt} hl={hl} />
      <NetworkGroup network={network} />
      <SentimentGroup fg={fg} newsPct={newsPct} />
      <MacroGroup macro={macro} />

      {/* Market Regime banner */}
      {market_regime !== undefined && (
        <div style={{
          marginTop: '0.5rem', padding: '0.45rem 0.6rem',
          backgroundColor: `${regimeColor}1a`, borderRadius: '3px',
          border: `1px solid ${regimeColor}`
        }}>
          <span style={{ fontSize: '0.90rem', color: regimeColor, fontWeight: 600, fontFamily: 'var(--text-mono)' }}>
            {regimeLabel}
          </span>
        </div>
      )}
    </div>
  );
}
