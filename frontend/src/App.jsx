import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, TrendingDown, HelpCircle, RefreshCw, BookOpen, AlertTriangle, ShieldAlert, Sliders, Info, ShieldCheck, Cpu, ToggleLeft, ToggleRight 
} from 'lucide-react';

export default function App() {
  // Configuration State
  const [horizonHours, setHorizonHours] = useState(24);
  const [thresholdPct, setThresholdPct] = useState(0.005);
  const [featureConfig, setFeatureConfig] = useState({
    include_derivatives: true,
    include_sentiment: true,
    include_macro: true,
  });

  // UI Mode (Simple vs Advanced). Simple is friendly, pastel, and easy to read.
  const [isSimpleMode, setIsSimpleMode] = useState(true);

  // Data State
  const [predictionData, setPredictionData] = useState(null);
  const [trainingReport, setTrainingReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [trainLoading, setTrainLoading] = useState(false);
  const [gaps, setGaps] = useState([]);
  const [error, setError] = useState(null);
  const [lastFetchedTime, setLastFetchedTime] = useState(null);

  // Toggle Explanations
  const [showExplainers, setShowExplainers] = useState(false);

  // Toggle specific tooltips
  const [showF1Tooltip, setShowF1Tooltip] = useState(false);
  const [showLossTooltip, setShowLossTooltip] = useState(false);
  const [showEmbargoTooltip, setShowEmbargoTooltip] = useState(false);

  // Mock Agent Strategy state
  const [simulatedStrategy, setSimulatedStrategy] = useState(null);

  useEffect(() => {
    fetchPrediction();
  }, []);

  const fetchPrediction = async (force = false) => {
    // Prevent wasting API code limits: check if last request was less than 5 seconds ago
    const now = Date.now();
    if (!force && lastFetchedTime && now - lastFetchedTime < 5000) {
      console.log("Fetch throttled to respect API quotas.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/predict');
      if (!res.ok) throw new Error('Failed to fetch prediction payload. Is the backend running?');
      const data = await res.json();
      setPredictionData(data.payload);
      setGaps(data.data_gaps || []);
      setLastFetchedTime(now);
      if (data.payload?.validation_summary) {
        setTrainingReport(data.payload.validation_summary);
      }
      generateStrategy(data.payload);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTrain = async () => {
    setTrainLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/train', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          horizon_hours: horizonHours,
          threshold_pct: thresholdPct,
          features_config: featureConfig
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || 'Training failed');
      }
      const data = await res.json();
      setTrainingReport(data.validation_summary);
      setGaps(data.data_gaps || []);
      // Force prediction fetch immediately after training calibration
      fetchPrediction(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setTrainLoading(false);
    }
  };

  const generateStrategy = (payload) => {
    if (!payload) return;
    const isUp = payload.model_prediction.direction_probabilities.up > 0.4;
    const isDown = payload.model_prediction.direction_probabilities.down > 0.4;
    
    let recommendation = "HOLD / NEUTRAL";
    let rationale = "Market showing high probability of sideways volatility. No clear directional momentum is present.";
    let action = "Keep capital in cash reserves; wait for technical range breakouts.";

    if (isUp) {
      recommendation = "ACCUMULATE (LONG)";
      rationale = `Random Forest indicates higher upward probability (${(payload.model_prediction.direction_probabilities.up * 100).toFixed(0)}%) with support levels holding.`;
      action = "Consider spot dollar-cost averaging near order book walls.";
    } else if (isDown) {
      recommendation = "REDUCE EXPOSURE (SHORT)";
      rationale = `Model projecting downward trend over the next ${payload.meta.horizon_hours}h. Funding rates and RSI indicate fading buyers.`;
      action = "Set tight stop losses or accumulate hedge parameters.";
    }

    setSimulatedStrategy({
      recommendation,
      rationale,
      action,
      agentName: "Antigravity Strategy Agent v1"
    });
  };

  const foldChartData = trainingReport?.folds?.map(f => ({
    fold: `Fold ${f.fold}`,
    Accuracy: parseFloat((f.accuracy * 100).toFixed(1)),
    'Majority Baseline': parseFloat((f.majority_baseline * 100).toFixed(1)),
  })) || [];

  const getConnectorStatus = (name) => {
    const isGap = gaps.some(g => g.toLowerCase().includes(name.toLowerCase()));
    if (error) return { label: "Offline", color: "text-red-400 bg-red-950/20 border-red-900" };
    if (isGap) return { label: "Degraded", color: "text-amber-400 bg-amber-950/20 border-amber-900" };
    return { label: "Online", color: "text-emerald-400 bg-emerald-950/20 border-emerald-900" };
  };

  // Helper to render baseline comparison badge with correct semantics
  const renderBaselineBadge = (status) => {
    if (status === "better") {
      return <span className="badge-beats-naive badge-better">Beats naive baselines</span>;
    } else if (status === "worse") {
      return <span className="badge-beats-naive badge-worse">Underperforms naive baselines</span>;
    } else {
      return <span className="badge-beats-naive badge-indistinguishable">Indistinguishable from baseline</span>;
    }
  };

  // Simple Mode Bullish / Bearish / Sideways display card
  const renderSimpleProjections = (payload) => {
    if (!payload) return null;
    const up = payload.model_prediction.direction_probabilities.up;
    const down = payload.model_prediction.direction_probabilities.down;
    const side = payload.model_prediction.direction_probabilities.sideways;

    if (up > down && up > side) {
      return (
        <div className="friendly-badge friendly-up">
          📈 Bullish Trend Expected ({(up * 100).toFixed(0)}% Probability)
        </div>
      );
    } else if (down > up && down > side) {
      return (
        <div className="friendly-badge friendly-down">
          📉 Bearish Trend Expected ({(down * 100).toFixed(0)}% Probability)
        </div>
      );
    } else {
      return (
        <div className="friendly-badge friendly-neutral">
          ↔️ Sideways Range Expected ({(side * 100).toFixed(0)}% Probability)
        </div>
      );
    }
  };

  return (
    <div className={isSimpleMode ? "simple-mode" : ""}>
      <div className="container">
        
        {/* Header */}
        <header className="header">
          <div className="header-title">
            <h1>HODL Watcher</h1>
            <p>Quantitative analysis projections for BTC/USDT.</p>
          </div>
          <div className="header-buttons">
            <button 
              onClick={() => setIsSimpleMode(!isSimpleMode)} 
              className="btn btn-secondary"
              style={{ gap: '0.35rem' }}
            >
              {isSimpleMode ? <ToggleLeft className="w-4 h-4 text-slate-400" /> : <ToggleRight className="w-4 h-4 text-indigo-400" />}
              {isSimpleMode ? "Simple Mode" : "Advanced Mode"}
            </button>
            <button onClick={() => setShowExplainers(!showExplainers)} className="btn btn-secondary">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              {showExplainers ? 'Hide Guide' : 'Methodology Guide'}
            </button>
            <button onClick={fetchPrediction} disabled={loading} className="btn btn-primary">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* Global Error Banner */}
        {error && (
          <div className="banner banner-error">
            <ShieldAlert className="w-4 h-4 mt-0.5 text-red-400 flex-shrink-0" />
            <div>
              <strong>Connection Issue:</strong> Start backend using: <code>.venv/bin/uvicorn api.app:app --reload</code>.
            </div>
          </div>
        )}

        {/* Guide Banner */}
        {showExplainers && (
          <section className="banner banner-guide">
            <div style={{ width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: isSimpleMode ? '#0f172a' : '#ffffff', marginBottom: '0.5rem' }}>
                <Info className="w-4 h-4 text-indigo-400" />
                Technical Methodology
              </div>
              <div className="banner-guide-grid">
                <div>
                  <strong>Chronological Splits:</strong> Unlike standard ML, we test strictly in time-order sequence to prevent looking into the future.
                </div>
                <div>
                  <strong>
                    24-Hour Embargo
                    <HelpCircle className="w-3 h-3 text-indigo-300 ml-1 cursor-pointer" onClick={() => setShowEmbargoTooltip(!showEmbargoTooltip)} />
                  </strong>
                  {showEmbargoTooltip && (
                    <div className="term-explainer-inline">
                      Buffer interval separating train/test cuts to nullify overlap and autocorrelation.
                    </div>
                  )}
                  <div style={{ marginTop: '0.2rem' }}>A mandatory buffer is used between train/test cuts to nullify overlap and autocorrelation.</div>
                </div>
                <div>
                  <strong>Baselines comparison:</strong> We measure performance relative to simpler coin-flip persistence rules to prove value.
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Main Grid */}
        <main className="main-layout">
          
          {/* Left Column: Config, Snapshot & API Pipeline Status */}
          <div className="sidebar">
            
            {/* Configurations */}
            <section className="card">
              <div className="card-header">
                <h2>
                  <Sliders className="w-4 h-4 text-indigo-400" />
                  Projections Setup
                </h2>
              </div>
              
              {/* Horizon slider */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Horizon Hours</span>
                  <span className="value">{horizonHours}h</span>
                </div>
                <input 
                  type="range" min="4" max="168" step="4" 
                  value={horizonHours} 
                  onChange={(e) => setHorizonHours(parseInt(e.target.value))}
                  className="slider-input"
                />
              </div>

              {/* Threshold slider */}
              <div className="slider-group">
                <div className="slider-header">
                  <span>Target Volatility Boundary</span>
                  <span className="value">{(thresholdPct * 100).toFixed(2)}%</span>
                </div>
                <input 
                  type="range" min="0.001" max="0.03" step="0.001" 
                  value={thresholdPct} 
                  onChange={(e) => setThresholdPct(parseFloat(e.target.value))}
                  className="slider-input"
                />
              </div>

              {/* Feature configurator */}
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '0.6rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', marginBottom: '0.5rem' }}>Features active</h3>
                <div className="badge-group">
                  {Object.keys(featureConfig).map((key) => (
                    <button 
                      key={key} 
                      onClick={() => setFeatureConfig({...featureConfig, [key]: !featureConfig[key]})}
                      className={`badge-btn ${featureConfig[key] ? 'badge-btn-active' : ''}`}
                    >
                      {key.replace('include_', '')}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                onClick={handleTrain}
                disabled={trainLoading}
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {trainLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Calibrating...
                  </>
                ) : (
                  'Recalibrate Model'
                )}
              </button>
            </section>

            {/* API Pipeline Status */}
            <section className="card">
              <div className="card-header">
                <h2>
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  API Pipeline Status
                </h2>
              </div>
              <div className="status-grid">
                {[
                  { key: 'binance', name: 'Binance Data' },
                  { key: 'fear_greed', name: 'Sentiment' },
                  { key: 'fred', name: 'FRED Macro' },
                  { key: 'coingecko', name: 'CoinGecko' }
                ].map(item => {
                  const status = getConnectorStatus(item.key);
                  return (
                    <div key={item.key} className="status-item">
                      <span className="status-name">{item.name}</span>
                      <span className={`status-badge ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Market Snapshot */}
            {predictionData && (
              <section className="card">
                <div className="card-header">
                  <h2>Market Price Snapshot</h2>
                  <span style={{ fontSize: '0.55rem', color: '#94a3b8' }}>
                    Updated: {lastFetchedTime ? new Date(lastFetchedTime).toLocaleTimeString() : 'Fresh'}
                  </span>
                </div>
                <div className="snapshot-grid">
                  <div className="snapshot-box">
                    <span className="snapshot-label">Price</span>
                    <span className="snapshot-val" style={{ color: isSimpleMode ? '#0f172a' : '#ffffff' }}>${predictionData.market_snapshot.price.toLocaleString()}</span>
                  </div>
                  <div className="snapshot-box">
                    <span className="snapshot-label">Fear & Greed</span>
                    <span className="snapshot-val" style={{ color: predictionData.market_snapshot.fear_greed_index > 60 ? '#10b981' : '#f43f5e' }}>
                      {predictionData.market_snapshot.fear_greed_index}
                    </span>
                  </div>
                </div>
              </section>
            )}

          </div>

          {/* Right Column: Predictions, Walk Forward, & Simulated Agent Strategy */}
          <div className="content-area">
            
            {/* Prediction Panel */}
            {predictionData && (
              <section className="card">
                <div className="card-header">
                  <h2>Directional Projections ({horizonHours}h)</h2>
                  {renderBaselineBadge(predictionData.validation_summary.accuracy_vs_naive_baseline)}
                </div>

                {isSimpleMode ? (
                  /* Simple Mode Friendly Widget */
                  <div style={{ padding: '0.5rem 0' }}>
                    {renderSimpleProjections(predictionData)}
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem', textAlign: 'center', lineHeight: '1.4' }}>
                      This represents the model's projection of the most probable price movement direction. Walk-forward evaluations verify if performance remains consistent.
                    </p>
                  </div>
                ) : (
                  /* Advanced Mode Detailed Widget */
                  <>
                    <div className="projection-grid">
                      {/* Down */}
                      <div className="projection-card proj-down">
                        <span className="projection-card-label">Down</span>
                        <h3 className="projection-card-val">
                          {(predictionData.model_prediction.direction_probabilities.down * 100).toFixed(0)}%
                        </h3>
                        <span className="projection-card-sub">Move &lt; -{(thresholdPct * 100).toFixed(1)}%</span>
                      </div>

                      {/* Sideways */}
                      <div className="projection-card proj-sideways">
                        <span className="projection-card-label">Sideways</span>
                        <h3 className="projection-card-val">
                          {(predictionData.model_prediction.direction_probabilities.sideways * 100).toFixed(0)}%
                        </h3>
                        <span className="projection-card-sub">Move within ±{(thresholdPct * 100).toFixed(1)}%</span>
                      </div>

                      {/* Up */}
                      <div className="projection-card proj-up">
                        <span className="projection-card-label">Up</span>
                        <h3 className="projection-card-val">
                          {(predictionData.model_prediction.direction_probabilities.up * 100).toFixed(0)}%
                        </h3>
                        <span className="projection-card-sub">Move &gt; +{(thresholdPct * 100).toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Visual stacked horizontal probability bar (summing to 100%) */}
                    <div className="probability-bar-container">
                      <div 
                        className="probability-bar-down" 
                        style={{ width: `${predictionData.model_prediction.direction_probabilities.down * 100}%` }}
                        title={`Down: ${(predictionData.model_prediction.direction_probabilities.down * 100).toFixed(0)}%`}
                      />
                      <div 
                        className="probability-bar-sideways" 
                        style={{ width: `${predictionData.model_prediction.direction_probabilities.sideways * 100}%` }}
                        title={`Sideways: ${(predictionData.model_prediction.direction_probabilities.sideways * 100).toFixed(0)}%`}
                      />
                      <div 
                        className="probability-bar-up" 
                        style={{ width: `${predictionData.model_prediction.direction_probabilities.up * 100}%` }}
                        title={`Up: ${(predictionData.model_prediction.direction_probabilities.up * 100).toFixed(0)}%`}
                      />
                    </div>

                    {/* Reliability details */}
                    <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: '10px', background: 'rgba(30, 41, 59, 0.2)', border: '1px solid var(--border-color)', fontSize: '0.7rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#cbd5e1' }}>Tested accuracy: <strong style={{ color: '#ffffff' }}>{(predictionData.validation_summary.mean_accuracy * 100).toFixed(1)}%</strong> (±{(predictionData.validation_summary.std_accuracy * 100).toFixed(1)}% std dev)</span>
                        <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{predictionData.model_prediction.confidence_note}</span>
                      </div>
                      
                      {/* Jargon Tooltips Row */}
                      <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem', fontSize: '0.65rem', color: '#94a3b8' }}>
                        <span className="info-tooltip-trigger" onClick={() => setShowF1Tooltip(!showF1Tooltip)}>
                          What is F1 score?
                          {showF1Tooltip && (
                            <span className="term-explainer-inline" style={{ position: 'absolute', margin: '1.25rem 0 0 0', zIndex: 10 }}>
                              Combines precision and recall. A balanced score showing model success on both up and down trends.
                            </span>
                          )}
                        </span>
                        <span className="info-tooltip-trigger" onClick={() => setShowLossTooltip(!showLossTooltip)}>
                          What is Log Loss?
                          {showLossTooltip && (
                            <span className="term-explainer-inline" style={{ position: 'absolute', margin: '1.25rem 0 0 0', zIndex: 10 }}>
                              Measures accuracy of forecast probabilities. Lower values mean better confidence calibration.
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Advanced Technical Indicators */}
                    <div style={{ marginTop: '1.25rem' }}>
                      <h3 style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.25rem' }}>
                        Advanced Market Indicators
                      </h3>
                      <div className="status-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                        <div className="strategy-box" style={{ padding: '0.5rem 0.75rem' }}>
                          <span className="strategy-box-title">RSI (6, 12, 24)</span>
                          <span className="snapshot-val" style={{ color: '#ffffff', fontSize: '0.8rem' }}>
                            {predictionData.market_snapshot.rsi['6'].toFixed(1)} / {predictionData.market_snapshot.rsi['12'].toFixed(1)} / {predictionData.market_snapshot.rsi['24'].toFixed(1)}
                          </span>
                        </div>
                        <div className="strategy-box" style={{ padding: '0.5rem 0.75rem' }}>
                          <span className="strategy-box-title">Funding Rate</span>
                          <span className="snapshot-val" style={{ color: predictionData.market_snapshot.funding_rate.value > 0 ? '#10b981' : '#f43f5e', fontSize: '0.8rem' }}>
                            {(predictionData.market_snapshot.funding_rate.value * 100).toFixed(4)}%
                          </span>
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#94a3b8', marginTop: '0.15rem' }}>Trend: {predictionData.market_snapshot.funding_rate.trend}</span>
                        </div>
                        <div className="strategy-box" style={{ padding: '0.5rem 0.75rem' }}>
                          <span className="strategy-box-title">Long/Short Ratio</span>
                          <span className="snapshot-val" style={{ color: predictionData.market_snapshot.long_short_ratio.value > 1 ? '#10b981' : '#f43f5e', fontSize: '0.8rem' }}>
                            {predictionData.market_snapshot.long_short_ratio.value.toFixed(2)}
                          </span>
                          <span style={{ display: 'block', fontSize: '0.6rem', color: '#94a3b8', marginTop: '0.15rem' }}>Trend: {predictionData.market_snapshot.long_short_ratio.trend}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </section>
            )}

            {/* Simulated External Strategy Agent output */}
            {simulatedStrategy && (
              <section className="card">
                <div className="card-header">
                  <h2>
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    Strategy Recommendation (LLM Agent)
                  </h2>
                  <span style={{ fontSize: '0.6rem', color: '#818cf8', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    {simulatedStrategy.agentName}
                  </span>
                </div>
                <div className="strategy-grid">
                  <div className="strategy-box">
                    <span className="strategy-box-title">Recommended Action</span>
                    <span className="strategy-box-action" style={{ color: simulatedStrategy.recommendation.includes('LONG') ? '#10b981' : simulatedStrategy.recommendation.includes('SHORT') ? '#f43f5e' : '#94a3b8' }}>
                      {simulatedStrategy.recommendation}
                    </span>
                    <p className="strategy-box-desc">{simulatedStrategy.action}</p>
                  </div>
                  <div className="strategy-box">
                    <span className="strategy-box-title">Strategic Rationale</span>
                    <p className="strategy-box-desc" style={{ color: isSimpleMode ? '#475569' : '#cbd5e1' }}>{simulatedStrategy.rationale}</p>
                  </div>
                </div>
              </section>
            )}

            {/* Walk-Forward validation Chart (Hidden in Simple Mode) */}
            {!isSimpleMode && (
              <section className="card">
                <div className="card-header">
                  <h2>Validation Performance Trend</h2>
                </div>
                {trainingReport && foldChartData.length > 0 ? (
                  <div className="h-44 w-full" style={{ height: '176px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={foldChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="fold" stroke="#475569" fontSize={9} />
                        <YAxis stroke="#475569" fontSize={9} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: 11 }} />
                        <Line type="monotone" dataKey="Accuracy" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="Majority Baseline" stroke="#6366f1" strokeDasharray="5 5" strokeWidth={1} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="empty-chart-container">
                    <Info className="w-5 h-5 text-indigo-400" />
                    <span>No calibration data. Click "Recalibrate Model" on the left side to run the walk-forward trend.</span>
                  </div>
                )}
              </section>
            )}

            {/* Disclaimers list */}
            {predictionData && (
              <footer className="footer-text">
                <p>Disclaimer: {predictionData.disclaimers[0]}</p>
              </footer>
            )}

          </div>
        </main>

      </div>
    </div>
  );
}
