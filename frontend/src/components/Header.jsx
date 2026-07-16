import React from 'react';
import { BookOpen, ShieldAlert, RefreshCw } from 'lucide-react';
export { GuideBanner } from './GuideBanner';

// ── Error banner ─────────────────────────────────────────────────────────────
export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="banner banner-error">
      <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ marginTop: 2, color: '#f43f5e' }} />
      <div>
        <strong>Connection Issue:</strong> Start backend using:{' '}
        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.90rem' }}>
          .venv/bin/uvicorn api.app:app --reload
        </code>
      </div>
    </div>
  );
}

// ── App Header ───────────────────────────────────────────────────────────────
export function AppHeader({
  predictionData,
  livePrice, isSimpleMode, setIsSimpleMode,
  showExplainers, setShowExplainers,
  sidebarHidden, setSidebarHidden,
  loading, fetchPrediction, playClick,
}) {
  const fmtPrice = n => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Extract variables for summary
  const snapshot = predictionData?.market_snapshot;
  const probs = predictionData?.model_prediction?.direction_probabilities;
  const fg = snapshot?.fear_greed_index;
  const newsPct = snapshot?.news_sentiment_bullish_pct;
  const fr = snapshot?.funding_rate?.value;
  const dxy = snapshot?.macro?.dxy;
  const flow = snapshot?.onchain?.exchange_net_flow;
  const isLowConf = predictionData?.model_prediction?.confidence_note?.includes("CONFIDENCE LOW");

  let [predText, predColor] = ["—", "var(--text-secondary)"];
  if (probs) {
    if (probs.up > probs.down && probs.up > probs.sideways) [predText, predColor] = [`Bullish (${(probs.up * 100).toFixed(0)}%)`, "var(--up-color)"];
    else if (probs.down > probs.up && probs.down > probs.sideways) [predText, predColor] = [`Bearish (${(probs.down * 100).toFixed(0)}%)`, "var(--down-color)"];
    else [predText, predColor] = [`Sideways (${(probs.sideways * 100).toFixed(0)}%)`, "var(--neutral-color)"];
  }

  return (
    <header className="header" style={{ width: '100%' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
        <div className="header-title">
          <h1>HODL Watcher</h1>
          <p>
            BTC/USDT Quantitative Analysis
            {livePrice && (
              <span style={{ marginLeft: '0.75rem', color: '#10b981', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700 }}>
                ${fmtPrice(livePrice)}
              </span>
            )}
            {livePrice && (
              <span className="live-dot" style={{ display: 'inline-block', marginLeft: 6, verticalAlign: 'middle' }} />
            )}
          </p>
        </div>

        {/* Horizontal information ribbon */}
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Projection Summary */}
          <div className="header-card">
            <span className="header-card-label">Projection</span>
            <span className="header-card-value" style={{ color: predColor }}>
              {isLowConf ? "NO ACTION" : predText}
            </span>
            <div className="header-tooltip">
              <span className="header-tooltip-title">ML Prediction</span>
              <span className="header-tooltip-desc">Model forecast direction over the next target horizon based on Random Forest classifier probabilities.</span>
              <span className="header-tooltip-example">Example: Bullish (65%) indicates a high probability forecast of price moving above the ATR threshold.</span>
            </div>
          </div>

          {/* Fear & Greed */}
          {fg != null && (
            <div className="header-card">
              <span className="header-card-label">Fear & Greed</span>
              <span className="header-card-value" style={{ color: fg > 75 ? 'var(--down-color)' : fg < 25 ? 'var(--up-color)' : 'var(--text-primary)' }}>
                {fg} / 100
              </span>
              <div className="header-tooltip">
                <span className="header-tooltip-title">Fear & Greed Index</span>
                <span className="header-tooltip-desc">Composite index scoring crypto sentiment from 0 (Extreme Fear) to 100 (Extreme Greed).</span>
                <span className="header-tooltip-example">Example: Below 25 indicates panic, which contrarians often use as a signal to buy near bottoms.</span>
              </div>
            </div>
          )}

          {/* News Tone */}
          {newsPct != null && (
            <div className="header-card">
              <span className="header-card-label">News Tone</span>
              <span className="header-card-value" style={{ color: newsPct > 60 ? 'var(--up-color)' : newsPct < 40 ? 'var(--down-color)' : 'var(--text-primary)' }}>
                {newsPct.toFixed(0)}% Bullish
              </span>
              <div className="header-tooltip">
                <span className="header-tooltip-title">News Sentiment</span>
                <span className="header-tooltip-desc">The proportion of scanned crypto news headlines over the last 24h classified as bullish.</span>
                <span className="header-tooltip-example">Example: 20% Bullish implies high negative coverage, representing maximum market skepticism.</span>
              </div>
            </div>
          )}

          {/* Funding Rate */}
          {fr != null && (
            <div className="header-card">
              <span className="header-card-label">Funding Rate</span>
              <span className="header-card-value" style={{ color: fr > 0 ? 'var(--up-color)' : 'var(--down-color)' }}>
                {(fr * 100).toFixed(3)}%
              </span>
              <div className="header-tooltip">
                <span className="header-tooltip-title">Funding Rate</span>
                <span className="header-tooltip-desc">Cost exchange between perp long/short contract holders. Paid/earned every 8 hours.</span>
                <span className="header-tooltip-example">Example: Positive rates mean longs pay shorts, signaling high leveraged bullish demand.</span>
              </div>
            </div>
          )}

          {/* DXY Index */}
          {dxy > 0 && (
            <div className="header-card">
              <span className="header-card-label">DXY (USD)</span>
              <span className="header-card-value" style={{ color: dxy > 104 ? 'var(--down-color)' : 'var(--up-color)' }}>
                {dxy.toFixed(2)}
              </span>
              <div className="header-tooltip">
                <span className="header-tooltip-title">US Dollar Index (DXY)</span>
                <span className="header-tooltip-desc">Index measuring the strength of the US Dollar against a basket of foreign currencies.</span>
                <span className="header-tooltip-example">Example: DXY rising above 104 is bearish for BTC as capital rotates into fiat cash.</span>
              </div>
            </div>
          )}

          {/* WBTC Net Flow */}
          {flow !== undefined && (
            <div className="header-card">
              <span className="header-card-label">WBTC Inflow</span>
              <span className="header-card-value" style={{ color: flow >= 0 ? 'var(--up-color)' : 'var(--down-color)' }}>
                {flow >= 0 ? `+${flow.toFixed(1)}` : flow.toFixed(1)} BTC
              </span>
              <div className="header-tooltip">
                <span className="header-tooltip-title">Wrapped BTC Net Flow</span>
                <span className="header-tooltip-desc">Net quantity of Wrapped BTC deposited to or withdrawn from tracked exchange wallets.</span>
                <span className="header-tooltip-example">Example: Positive (+) values show inflows which can sign potential selling pressure.</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="header-buttons">
        <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px', alignItems: 'center' }}>
          {[['Simple', true], ['Advanced', false]].map(([lbl, val]) => (
            <button key={lbl}
              onClick={() => { if (isSimpleMode !== val) { playClick(); setIsSimpleMode(val); } }}
              style={{
                padding: '0.35rem 0.7rem', fontSize: '0.90rem', fontWeight: 600, border: 'none', borderRadius: '3px', cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: isSimpleMode === val ? 'var(--accent-brand)' : 'transparent',
                color: isSimpleMode === val ? '#fff' : 'var(--text-secondary)',
                boxShadow: isSimpleMode === val ? '0 0 10px var(--accent-glow)' : 'none'
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
        <button
          onClick={() => { playClick(); setShowExplainers(v => !v); }}
          className="btn btn-secondary"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          {showExplainers ? 'Hide Guide' : 'Methodology Guide'}
        </button>

        <button
          onClick={() => { playClick(); fetchPrediction(true); }}
          disabled={loading}
          className="btn btn-primary"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </header>
  );
}
