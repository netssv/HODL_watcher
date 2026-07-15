import React, { useState } from 'react';
import { Cpu, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export function LLMPayloadCard({ payload }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied]     = useState(false);
  if (!payload) return null;

  const copy = () => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2><Cpu className="w-4 h-4 text-emerald-400" />LLM Agent Payload</h2>
          <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary)' }}>Paste this JSON into any LLM to generate custom strategies.</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <button onClick={copy} title="Copy JSON to clipboard" style={{
            backgroundColor: copied ? 'rgba(16,185,129,0.2)' : 'rgba(59,130,246,0.15)',
            color: copied ? '#10b981' : '#60a5fa',
            border: `1px solid ${copied ? '#10b981' : '#3b82f6'}`,
            borderRadius: '4px', padding: '3px 8px', fontSize: '0.65rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
          }}>
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? 'Copied!' : 'Copy JSON'}
          </button>
          <button onClick={() => setExpanded(e => !e)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.65rem' }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {expanded ? 'Collapse' : 'Expand for raw JSON'}
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ backgroundColor: '#0d1117', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--border-color)', marginTop: '0.5rem', maxHeight: '280px', overflowY: 'auto' }}>
          <pre style={{ margin: 0, fontSize: '0.65rem', color: '#a5b4fc', whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
