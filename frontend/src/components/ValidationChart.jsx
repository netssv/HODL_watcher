import React from 'react';
import { Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export function ValidationChart({ trainingReport }) {
  const data = trainingReport?.folds?.map(f => ({
    fold: `F${f.fold}`,
    Accuracy:       parseFloat((f.accuracy * 100).toFixed(1)),
    Baseline:       parseFloat((f.majority_baseline * 100).toFixed(1)),
    StrategyReturn: parseFloat((f.trading?.final_return * 100).toFixed(1) || 0),
  })) ?? [];

  const trading = trainingReport?.overall?.trading_metrics;

  return (
    <section className="card">
      <div className="card-header"><h2>Walk-Forward Validation Trend</h2></div>
      {data.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {trading && (
            <div className="status-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              {[
                { label: 'Sharpe Ratio',    val: trading.mean_sharpe.toFixed(2),                         color: undefined   },
                { label: 'Max Drawdown',    val: `${(trading.mean_max_drawdown * 100).toFixed(1)}%`,     color: '#f43f5e'   },
                { label: 'Win Rate',        val: `${(trading.mean_win_rate * 100).toFixed(1)}%`,         color: '#10b981'   },
                { label: 'Avg Fold Return', val: `${(trading.mean_strategy_return * 100).toFixed(1)}%`,  color: undefined   },
              ].map(({ label, val, color }) => (
                <div key={label} className="strategy-box">
                  <span className="strategy-box-title">{label}</span>
                  <span className="snapshot-val" style={{ fontSize: '0.8rem', color }}>{val}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ height: '176px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fold" stroke="var(--text-muted)" fontSize={9} />
                <YAxis yAxisId="left"  stroke="var(--text-muted)" fontSize={9} domain={[0, 100]} />
                <YAxis yAxisId="right" orientation="right" stroke="#fbbf24" fontSize={9} label={{ value: 'Return %', angle: 90, position: 'insideRight', fill: '#fbbf24', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0d1117', borderColor: 'var(--border-color)', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line yAxisId="left"  type="monotone" dataKey="Accuracy"       name="Model Accuracy" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line yAxisId="left"  type="monotone" dataKey="Baseline"       name="Naive Baseline" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={1} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="StrategyReturn" name="Strategy P&L"   stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="empty-chart-container">
          <Info className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          <span>No calibration data. Click "Recalibrate Model" to run walk-forward validation.</span>
        </div>
      )}
    </section>
  );
}
