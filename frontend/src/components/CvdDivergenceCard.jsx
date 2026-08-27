import React from 'react';
import { Activity, TrendingUp, TrendingDown, Layers } from 'lucide-react';

export function CvdDivergenceCard({ cvdData }) {
  if (!cvdData) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Activity className="w-5 h-5 text-blue-400" />
            <span>CVD Spot vs. Perps Divergence</span>
          </div>
        </div>
        <p className="text-sm text-slate-400">Loading CVD order flow...</p>
      </div>
    );
  }

  const {
    divergence_type = 'none',
    spot_cvd_delta = 0,
    futures_cvd_delta = 0,
    spot_absorption_score = 50,
    signal = 'neutral',
    note = ''
  } = cvdData;

  const isBullish = signal.includes('bullish');
  const isBearish = signal.includes('bearish');
  const statusColor = isBullish ? '#34d399' : isBearish ? '#f87171' : '#94a3b8';

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Activity className="w-5 h-5" style={{ color: '#38bdf8' }} />
          <span style={{ fontWeight: 600 }}>CVD Order Flow & Absorption</span>
        </div>
        <span
          className="badge"
          style={{
            backgroundColor: `${statusColor}22`,
            color: statusColor,
            padding: '3px 8px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: '0.75rem',
            border: `1px solid ${statusColor}55`
          }}
        >
          {divergence_type.replace(/_/g, ' ').toUpperCase()}
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
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>Spot 24h Delta (BTC)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {spot_cvd_delta >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: spot_cvd_delta >= 0 ? '#34d399' : '#f87171' }}>
                {spot_cvd_delta > 0 ? `+${spot_cvd_delta.toLocaleString()}` : spot_cvd_delta.toLocaleString()}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: 'rgba(255,255,255,0.03)',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)'
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: 4 }}>Futures 24h Delta (BTC)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {futures_cvd_delta >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-400" />
              )}
              <span style={{ fontWeight: 700, fontFamily: 'monospace', color: futures_cvd_delta >= 0 ? '#34d399' : '#f87171' }}>
                {futures_cvd_delta > 0 ? `+${futures_cvd_delta.toLocaleString()}` : futures_cvd_delta.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
          <span style={{ color: '#94a3b8' }}>Spot Absorption Strength</span>
          <span style={{ fontWeight: 700, color: statusColor }}>{spot_absorption_score}/100</span>
        </div>

        <div style={{ height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
          <div
            style={{
              width: `${spot_absorption_score}%`,
              height: '100%',
              backgroundColor: statusColor,
              transition: 'width 0.4s ease'
            }}
          />
        </div>

        <p style={{ marginTop: 10, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
          {note}
        </p>
      </div>
    </div>
  );
}
