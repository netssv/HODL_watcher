import React from 'react';
import { Compass, Gauge, AlertCircle } from 'lucide-react';

export function CycleOnChainCard({ cycleData }) {
  if (!cycleData) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Compass className="w-5 h-5 text-purple-400" />
            <span>Macro Cycle & On-Chain Valuation</span>
          </div>
        </div>
        <p className="text-sm text-slate-400">Loading cycle metrics...</p>
      </div>
    );
  }

  const {
    mvrv_ratio = 1.0,
    realized_price_usd = 0,
    cycle_phase = 'accumulation',
    macro_risk_level = 'low',
    description = '',
    pi_cycle = {}
  } = cycleData;

  const phaseLabel = cycle_phase.replace(/_/g, ' ').toUpperCase();
  const isHighRisk = macro_risk_level.includes('high');
  const badgeColor = isHighRisk ? '#f87171' : '#a855f7';

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Compass className="w-5 h-5" style={{ color: '#c084fc' }} />
          <span style={{ fontWeight: 600 }}>Macro Cycle & MVRV Valuation</span>
        </div>
        <span
          className="badge"
          style={{
            backgroundColor: `${badgeColor}22`,
            color: badgeColor,
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: '0.75rem',
            border: `1px solid ${badgeColor}55`
          }}
        >
          {phaseLabel}
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>MVRV Valuation Ratio</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'monospace' }}>
              {mvrv_ratio}x
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Generational Buy &lt; 1.2 | Peak &gt; 3.5</div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 2 }}>Realized Cost Basis</div>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'monospace' }}>
              ${Number(realized_price_usd).toLocaleString()}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Aggregate Network Cost</div>
          </div>
        </div>

        {pi_cycle.spread_to_cross_pct !== undefined && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.05)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Gauge className="w-4 h-4 text-purple-400" />
              <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>Pi Cycle Top Proximity:</span>
            </div>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: pi_cycle.peak_warning ? '#ef4444' : '#a855f7' }}>
              {pi_cycle.spread_to_cross_pct}% to Top Cross
            </span>
          </div>
        )}

        <p style={{ fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
          {description}
        </p>
      </div>
    </div>
  );
}
