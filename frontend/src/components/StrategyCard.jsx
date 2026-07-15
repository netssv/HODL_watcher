import React from 'react';
import { Cpu, TrendingUp, TrendingDown } from 'lucide-react';

// ── Strategy Recommendation card ──────────────────────────────────────────────
export function StrategyCard({ strategy }) {
  if (!strategy) return null;
  const isLowConfidence = strategy.isLowConfidence;
  const color = isLowConfidence ? '#94a3b8' :
    strategy.recommendation.includes('LONG') ? '#10b981'
    : strategy.recommendation.includes('SHORT') ? '#f43f5e' : '#94a3b8';
  const Icon = strategy.recommendation.includes('LONG') ? TrendingUp
    : strategy.recommendation.includes('SHORT') ? TrendingDown : null;

  return (
    <section className="card" style={{ opacity: isLowConfidence ? 0.75 : 1 }}>
      <div className="card-header">
        <h2><Cpu className="w-4 h-4 text-emerald-400" />Strategy</h2>
        {isLowConfidence && (
          <span style={{ fontSize: '0.55rem', backgroundColor: 'rgba(148,163,184,0.15)', color: '#94a3b8', padding: '2px 6px', borderRadius: '999px', fontWeight: 600 }}>
            LOW CONFIDENCE — NO ACTION
          </span>
        )}
      </div>
      <div className="strategy-grid">
        <div className="strategy-box" style={{ borderLeft: `3px solid ${color}`, paddingLeft: '0.75rem' }}>
          <span className="strategy-box-title">Action</span>
          <span className="strategy-box-action" style={{ color, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {Icon && <Icon size={14} />}
            {strategy.recommendation}
          </span>
          <p className="strategy-box-desc">{strategy.action}</p>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title">Rationale</span>
          <p className="strategy-box-desc">{strategy.rationale}</p>
        </div>
      </div>
    </section>
  );
}
