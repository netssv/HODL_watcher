import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';
import { getConnectorStatus } from '../utils.jsx';

const CONNECTORS = [
  { key: 'binance',    name: 'Binance' },
  { key: 'coinalyze', name: 'Coinalyze' },
  { key: 'deribit',   name: 'Deribit' },
  { key: 'onchain',   name: 'Onchain' },
  { key: 'etf_flows', name: 'ETF Flows' },
  { key: 'fear_greed',  name: 'Sentiment' },
  { key: 'fred',        name: 'FRED Macro' },
  { key: 'currents_news', name: 'News Feed' },
  { key: 'hyperliquid',   name: 'Hyperliquid DEX' },
];

export function ApiPipelineCard({ gaps, error }) {
  const [expanded, setExpanded] = useState(false);
  const statuses    = CONNECTORS.map(c => ({ ...c, st: getConnectorStatus(c.key, gaps, error) }));
  const onlineCount = statuses.filter(c => c.st.label === 'Online').length;
  const allOk       = onlineCount === CONNECTORS.length;
  
  const offlineOrDegraded = statuses.some(c => c.st.label === 'Offline' || c.st.label === 'Degraded');
  const hasWarnings = statuses.some(c => c.st.label === 'MOCK' || c.st.label === 'NO KEY');
  
  const badgeColor = offlineOrDegraded ? '#f43f5e' : hasWarnings ? '#f59e0b' : '#10b981';
  const badgeBg = offlineOrDegraded ? 'rgba(244,63,94,0.15)' : hasWarnings ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';

  return (
    <section className="card" style={{ flex: 1 }}>
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <div className="card-header" style={{ marginBottom: 0 }}>
          <h2><ShieldCheck className="w-4 h-4 text-emerald-400" />API Pipeline</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{
              fontSize: '0.88rem', fontWeight: 700, padding: '2px 6px', borderRadius: '999px',
              backgroundColor: badgeBg,
              color: badgeColor,
            }}>
              {onlineCount}/{CONNECTORS.length} online {allOk ? '✓' : '⚠'}
            </span>
            {expanded ? <ChevronUp size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />}
          </div>
        </div>
      </button>
      {expanded && (
        <div className="status-grid" style={{ marginTop: '0.5rem' }}>
          {statuses.map(({ key, name, st }) => (
            <div key={key} className="status-item">
              <span className="status-name">{name}</span>
              <span className={`status-badge ${st.color}`}>{st.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
