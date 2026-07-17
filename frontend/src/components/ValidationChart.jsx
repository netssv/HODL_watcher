import React from 'react';
import { Info } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const pct = value => value == null || Number.isNaN(Number(value)) ? 'N/A' : `${(Number(value) * 100).toFixed(1)}%`;
const num = value => value == null || Number.isNaN(Number(value)) ? 'N/A' : Number(value).toFixed(2);

export function ValidationChart({ trainingReport }) {
  const overall = trainingReport?.overall || {};
  const meta = trainingReport?.metadata || {};
  const folds = trainingReport?.folds || [];
  const baselines = overall.baselines || {};
  const trading = overall.trading_metrics || overall.trading;
  const data = folds.map(f => ({
    fold: `F${f.fold}`,
    Model: Number((f.accuracy * 100).toFixed(1)),
    Majority: Number((f.majority_baseline * 100).toFixed(1)),
    Persistence: Number((f.persistence_baseline * 100).toFixed(1)),
  }));
  const status = overall.accuracy_vs_naive_baseline || 'not evaluated';
  const statusColor = status === 'better' ? '#34d399' : status === 'worse' ? '#f87171' : '#fbbf24';
  const classRows = ['down', 'sideways', 'up'].map(label => {
    const values = folds.map(f => f.per_class?.[label]).filter(Boolean);
    return {
      label,
      precision: values.length ? values.reduce((s, v) => s + v.precision, 0) / values.length : null,
      recall: values.length ? values.reduce((s, v) => s + v.recall, 0) / values.length : null,
      f1: values.length ? values.reduce((s, v) => s + v.f1, 0) / values.length : null,
    };
  });

  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Can I Trust This Model?</h2>
          <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Walk-forward validation tests each period using only earlier market data.
          </p>
        </div>
        {trainingReport && (
          <span style={{ color: statusColor, border: `1px solid ${statusColor}55`, background: `${statusColor}15`, padding: '0.25rem 0.45rem', borderRadius: 3, fontSize: '0.78rem', fontWeight: 700 }}>
            {status === 'better' ? 'BEATS BASELINES' : status === 'worse' ? 'UNDERPERFORMS' : 'NO CLEAR EDGE'}
          </span>
        )}
      </div>

      {!trainingReport || data.length === 0 ? (
        <div className="empty-chart-container">
          <Info size={18} style={{ color: 'var(--text-muted)' }} />
          <span>No validation run yet. Recalibrate the model to create an out-of-sample test.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div className="status-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(125px, 1fr))' }}>
            <Metric label="Model accuracy" value={`${pct(overall.mean_accuracy)} ± ${pct(overall.std_accuracy)}`} />
            <Metric label="Majority baseline" value={pct(baselines.mean_majority_class)} />
            <Metric label="Persistence baseline" value={pct(baselines.mean_persistence)} />
            <Metric label="Test folds" value={`${meta.n_folds || data.length} · ${meta.horizon_periods || '?'}h horizon`} />
          </div>

          <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.45 }}>
            <strong style={{ color: 'var(--text-primary)' }}>How to read this:</strong> the solid line is the model;
            it should consistently sit above both dashed baselines. The ± value is variation between historical test windows,
            not a confidence guarantee for the next trade.
          </div>

          <div style={{ height: '210px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="fold" stroke="var(--text-muted)" fontSize={10} />
                <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} stroke="var(--text-muted)" fontSize={10} />
                <Tooltip formatter={value => `${value}%`} contentStyle={{ backgroundColor: '#0d1117', borderColor: 'var(--border-color)', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Line type="monotone" dataKey="Model" stroke="#34d399" strokeWidth={2.5} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="Majority" name="Majority baseline" stroke="#a78bfa" strokeDasharray="5 5" dot={false} />
                <Line type="monotone" dataKey="Persistence" name="Persistence baseline" stroke="#fbbf24" strokeDasharray="2 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Average classification quality by direction</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Class</span><span style={{ color: 'var(--text-muted)' }}>Precision</span><span style={{ color: 'var(--text-muted)' }}>Recall</span><span style={{ color: 'var(--text-muted)' }}>F1</span>
              {classRows.map(row => <React.Fragment key={row.label}>
                <strong style={{ color: row.label === 'up' ? '#34d399' : row.label === 'down' ? '#f87171' : '#fbbf24' }}>{row.label}</strong>
                <span>{pct(row.precision)}</span><span>{pct(row.recall)}</span><span>{pct(row.f1)}</span>
              </React.Fragment>)}
            </div>
          </div>

          <details className="ind-info">
            <summary>Validation details and limits</summary>
            <div className="ind-info-body">
              {meta.data_start && <div>Data: {meta.data_start} → {meta.data_end}</div>}
              <div>Embargo: {meta.embargo_periods ?? 'N/A'} periods between training and testing.</div>
              <div>Log loss: {num(overall.mean_log_loss)} ± {num(overall.std_log_loss)} — lower is better and evaluates probability quality.</div>
              {trading && <div>Trading simulation: Sharpe {num(trading.mean_sharpe)}, drawdown {pct(trading.mean_max_drawdown)}, win rate {pct(trading.mean_win_rate)}. These are historical simulations, not forecasts.</div>}
              <div>Class balance: down {overall.class_balance?.down ?? 'N/A'}, sideways {overall.class_balance?.sideways ?? 'N/A'}, up {overall.class_balance?.up ?? 'N/A'}.</div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}

function Metric({ label, value }) {
  return <div className="strategy-box">
    <span className="strategy-box-title">{label}</span>
    <span className="snapshot-val" style={{ fontSize: '0.82rem' }}>{value}</span>
  </div>;
}
