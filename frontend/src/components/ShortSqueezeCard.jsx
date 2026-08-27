import React from 'react';
import { Flame, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

export function ShortSqueezeCard({ squeezeData, currentPrice }) {
  if (!squeezeData) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Flame className="w-5 h-5 text-amber-500" />
            <span>Short Squeeze & Liquidity Magnet</span>
          </div>
        </div>
        <p className="text-sm text-slate-400">Loading squeeze metrics...</p>
      </div>
    );
  }

  const {
    squeeze_probability_score = 0,
    alert_level = 'LOW',
    description = '',
    upper_liquidation_magnet_usd,
    metrics_breakdown = {}
  } = squeezeData;

  const isHighAlert = squeeze_probability_score >= 65;
  const isExtreme = squeeze_probability_score >= 80;

  const badgeColor = isExtreme
    ? 'rgba(239, 68, 68, 0.2)'
    : isHighAlert
    ? 'rgba(245, 158, 11, 0.2)'
    : 'rgba(16, 185, 129, 0.2)';

  const textColor = isExtreme ? '#ef4444' : isHighAlert ? '#f59e0b' : '#10b981';

  return (
    <div className="card" style={{ borderColor: isHighAlert ? 'rgba(245, 158, 11, 0.4)' : 'inherit' }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Flame className="w-5 h-5" style={{ color: textColor }} />
          <span style={{ fontWeight: 600 }}>Short Squeeze & Magnet Index</span>
        </div>
        <span
          className="badge"
          style={{
            backgroundColor: badgeColor,
            color: textColor,
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: '0.75rem',
            border: `1px solid ${textColor}`
          }}
        >
          {alert_level} SQUEEZE RISK
        </span>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Squeeze Probability Score</span>
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: textColor }}>
            {squeeze_probability_score}%
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
          <div
            style={{
              width: `${squeeze_probability_score}%`,
              height: '100%',
              backgroundColor: textColor,
              transition: 'width 0.5s ease'
            }}
          />
        </div>

        {upper_liquidation_magnet_usd && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Zap className="w-4 h-4 text-amber-400" />
              <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>Upper Liquidation Magnet:</span>
            </div>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f8fafc' }}>
              ${Number(upper_liquidation_magnet_usd).toLocaleString()}
            </span>
          </div>
        )}

        <p style={{ marginTop: 10, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
          {description}
        </p>

        {/* Micro-breakdown pill stats */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', padding: '3px 7px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: '#cbd5e1' }}>
            Funding: {metrics_breakdown.funding_component || 0}/35
          </span>
          <span style={{ fontSize: '0.75rem', padding: '3px 7px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: '#cbd5e1' }}>
            LSR Sentiment: {metrics_breakdown.lsr_component || 0}/25
          </span>
          <span style={{ fontSize: '0.75rem', padding: '3px 7px', background: 'rgba(255,255,255,0.05)', borderRadius: 4, color: '#cbd5e1' }}>
            Compression: {metrics_breakdown.volatility_compression || 0}/20
          </span>
        </div>
      </div>
    </div>
  );
}
