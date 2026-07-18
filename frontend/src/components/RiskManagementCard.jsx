import React from 'react';
import { ShieldAlert, Info } from 'lucide-react';

export function RiskManagementCard({ riskParams }) {
  if (!riskParams) return null;
  const fixed = (value, digits) => Number(value ?? 0).toFixed(digits);
  const isLeveraged = riskParams.leverage > 1.0;
  return (
    <section className="card">
      <div className="card-header">
        <h2><ShieldAlert className="w-4 h-4 text-orange-400" />Risk Management</h2>
      </div>
      <div className="strategy-grid">
        <div className="strategy-box">
          <span className="strategy-box-title" title="Notional position size based on target risk and ATR stop loss distance.">
            Suggested Position Size <Info className="w-3 h-3 inline text-gray-400" style={{ verticalAlign: 'text-bottom' }} />
          </span>
          <span className="strategy-box-action" style={{ color: '#fbbf24' }}>
            {fixed(riskParams.position_size_notional_pct, 2)}%
          </span>
          <p className="strategy-box-desc">
            {isLeveraged
              ? `${fixed(riskParams.actual_risk_pct, 1)}% Risk, ${fixed(riskParams.leverage, 1)}x Lev = ${fixed(riskParams.position_size_notional_pct / riskParams.leverage, 1)}% Margin`
              : `${fixed(riskParams.actual_risk_pct, 1)}% Account Risk (No Lev)`}
          </p>
        </div>
        <div className="strategy-box">
          <span className="strategy-box-title">Dynamic SL / TP</span>
          <div>
            <span className="snapshot-val" style={{ fontSize: '0.8rem', color: '#f43f5e' }}>-{fixed(riskParams.dynamic_sl_pct, 1)}%</span>
            <span className="snapshot-val" style={{ fontSize: '0.8rem', color: '#10b981', marginLeft: '0.5rem' }}>+{fixed(riskParams.dynamic_tp_pct, 1)}%</span>
          </div>
          <p className="strategy-box-desc">Based on recent volatility (ATR)</p>
        </div>
      </div>
    </section>
  );
}
