import React from 'react';
import { BookOpen, HelpCircle, Info, ShieldAlert, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

// ── Methodology Guide banner ──────────────────────────────────────────────────
export function GuideBanner({ isSimpleMode }) {
  return (
    <section className="banner banner-guide" style={{ padding: '1rem' }}>
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: isSimpleMode ? '#0f172a' : '#ffffff', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
          <Info className="w-4 h-4 text-blue-500" />
          Technical Methodology
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <strong>1. Walk-Forward Testing Accuracy:</strong>
            <div style={{ fontSize: '0.65rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
              The model is evaluated using chronologically ordered splits (not random CV) to strictly prevent looking into the future. "Tested accuracy" measures the percentage of correct directional predictions over the last 6-8 periods (folds). If the model is underperforming the baseline, check the Walk-Forward Trend widget to see recent deterioration.
            </div>
          </div>
          <div>
            <strong>2. Data Leakage Prevention (24-Hour Embargo):</strong>
            <div style={{ fontSize: '0.65rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
              A mandatory 24-hour buffer interval is enforced between train and test cuts. This nullifies overlap and autocorrelation, ensuring the model cannot "memorize" overlapping rolling features.
            </div>
          </div>
          <div>
            <strong>3. Reading Confidence Labels:</strong>
            <div style={{ fontSize: '0.65rem', marginTop: '0.2rem', color: 'var(--text-secondary)' }}>
              • <strong>HIGH:</strong> Both directional probability (&gt;60%) and recent walk-forward accuracy support the signal. Standard position sizing.<br/>
              • <strong>MEDIUM:</strong> Mixed signals or moderate probability. Reduce position size by half.<br/>
              • <strong>LOW / NO_TRADE:</strong> Model predicts sideways movement or conflicting extremes. Stay out of the market.
            </div>
          </div>
          <div>
            <strong>4. Advanced Indicator Definitions:</strong>
            <div style={{ fontSize: '0.65rem', marginTop: '0.4rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', color: 'var(--text-secondary)' }}>
              <div><strong style={{ color: 'var(--text-primary)' }}>RSI (Relative Strength Index):</strong> Measures momentum to identify overbought (&gt;70) or oversold (&lt;30) conditions.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Funding Rate:</strong> Periodic payments between longs/shorts; highly positive means longs are paying shorts (overleveraged bullishness).</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>L/S Ratio (Long/Short):</strong> The ratio of accounts net-long vs net-short; contrarian indicator when extreme.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Liq Proximity:</strong> Distance to major liquidation clusters (price magnets) where forced selling/buying occurs.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>IV/Skew:</strong> Implied Volatility and Put/Call Skew from options markets indicating expected future turbulence.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>Exch Net Flow:</strong> On-chain metric tracking net Bitcoin moving into/out of centralized exchanges.</div>
              <div><strong style={{ color: 'var(--text-primary)' }}>ETF Net Flow:</strong> Institutional capital moving in or out of spot Bitcoin ETFs.</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Error banner ─────────────────────────────────────────────────────────────
export function ErrorBanner({ error }) {
  if (!error) return null;
  return (
    <div className="banner banner-error">
      <ShieldAlert className="w-4 h-4 flex-shrink-0" style={{ marginTop: 2, color: '#f43f5e' }} />
      <div>
        <strong>Connection Issue:</strong> Start backend using:{' '}
        <code style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}>
          .venv/bin/uvicorn api.app:app --reload
        </code>
      </div>
    </div>
  );
}

// ── App Header ───────────────────────────────────────────────────────────────
export function AppHeader({
  livePrice, isSimpleMode, setIsSimpleMode,
  showExplainers, setShowExplainers,
  sidebarHidden, setSidebarHidden,
  loading, fetchPrediction, playClick,
}) {
  const fmtPrice = n => n?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <header className="header">
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
      <div className="header-buttons">
        <div style={{ display: 'flex', backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '2px', alignItems: 'center' }}>
          <button
            onClick={() => { if (!isSimpleMode) { playClick(); setIsSimpleMode(true); } }}
            style={{
              padding: '0.35rem 0.7rem', fontSize: '0.65rem', fontWeight: 600, border: 'none', borderRadius: '3px', cursor: 'pointer', transition: 'all 0.2s',
              backgroundColor: isSimpleMode ? 'var(--accent-brand)' : 'transparent',
              color: isSimpleMode ? '#fff' : 'var(--text-secondary)',
              boxShadow: isSimpleMode ? '0 0 10px var(--accent-glow)' : 'none'
            }}
          >
            Simple
          </button>
          <button
            onClick={() => { if (isSimpleMode) { playClick(); setIsSimpleMode(false); } }}
            style={{
              padding: '0.35rem 0.7rem', fontSize: '0.65rem', fontWeight: 600, border: 'none', borderRadius: '3px', cursor: 'pointer', transition: 'all 0.2s',
              backgroundColor: !isSimpleMode ? 'var(--accent-brand)' : 'transparent',
              color: !isSimpleMode ? '#fff' : 'var(--text-secondary)',
              boxShadow: !isSimpleMode ? '0 0 10px var(--accent-glow)' : 'none'
            }}
          >
            Advanced
          </button>
        </div>
        <button
          onClick={() => { playClick(); setShowExplainers(v => !v); }}
          className="btn btn-secondary"
        >
          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
          {showExplainers ? 'Hide Guide' : 'Methodology Guide'}
        </button>
        <button
          onClick={() => { playClick(); setSidebarHidden(v => !v); }}
          className="btn btn-secondary"
          title="Toggle Sidebar completely"
        >
          <PanelLeftClose className="w-3.5 h-3.5" />
          {sidebarHidden ? 'Show Sidebar' : 'Hide Sidebar'}
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
