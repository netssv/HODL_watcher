import React, { useState } from 'react';
import { Cpu, ChevronDown, ChevronUp, Copy, Check, Download } from 'lucide-react';

export function LLMPayloadCard({ payload }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  if (!payload) return null;

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hodl-watcher-payload-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const micro = payload.market_snapshot?.market_microstructure || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0.2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div>
          <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Structured context prompt payload for external LLM strategy agents.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button onClick={copy} title="Copy JSON" style={{
            backgroundColor: copied ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)',
            color: copied ? '#10b981' : '#60a5fa',
            border: `1px solid ${copied ? '#10b981' : '#3b82f6'}`,
            borderRadius: '4px', padding: '3px 8px', fontSize: '0.88rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button onClick={download} title="Download JSON" style={{
            backgroundColor: 'rgba(16,185,129,0.15)', color: '#34d399',
            border: '1px solid rgba(16,185,129,0.7)', borderRadius: '4px',
            padding: '3px 8px', fontSize: '0.88rem', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            <Download size={11} /> Download JSON
          </button>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.88rem' }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Raw JSON' : 'Raw JSON'}
          </button>
        </div>
      </div>

      {!expanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '0.45rem',
          flex: 1
        }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>VWAP 24h</span>
            <span style={{ fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {micro.vwap_24h ? `$${Number(micro.vwap_24h).toFixed(0)}` : 'N/A'}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>Realized Vol</span>
            <span style={{ fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {micro.realized_volatility_24h ? `${(micro.realized_volatility_24h * 100).toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>CVD 24h</span>
            <span style={{ fontSize: '0.90rem', fontWeight: 700, color: micro.cvd_24h > 0 ? '#10b981' : '#f43f5e' }}>
              {micro.cvd_24h ? `${micro.cvd_24h > 0 ? '+' : ''}${(micro.cvd_24h / 1e3).toFixed(1)}K BTC` : 'N/A'}
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'block', fontWeight: 600 }}>Futures Basis</span>
            <span style={{ fontSize: '0.90rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {micro.futures_basis ? `${(micro.futures_basis * 100).toFixed(3)}%` : 'N/A'}
            </span>
          </div>
        </div>
      )}

      {expanded && (
        <div style={{ flex: 1, backgroundColor: '#0d1117', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', overflowY: 'auto' }}>
          <pre style={{ margin: 0, fontSize: '0.88rem', color: '#a5b4fc', whiteSpace: 'pre-wrap', fontFamily: 'var(--text-mono)' }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
