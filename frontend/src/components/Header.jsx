import React from 'react';
import { BookOpen, HelpCircle, Info, ShieldAlert, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

// ── Methodology Guide banner ──────────────────────────────────────────────────
export function GuideBanner({ isSimpleMode, showEmbargoTooltip, setShowEmbargoTooltip }) {
  return (
    <section className="banner banner-guide">
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold', color: isSimpleMode ? '#0f172a' : '#ffffff', marginBottom: '0.5rem' }}>
          <Info className="w-4 h-4 text-blue-500" />
          Technical Methodology
        </div>
        <div className="banner-guide-grid">
          <div>
            <strong>Chronological Splits:</strong> We test strictly in time-order sequence to prevent looking into the future.
          </div>
          <div>
            <strong>
              24-Hour Embargo
              <HelpCircle className="w-3 h-3 text-blue-400 ml-1 cursor-pointer" style={{ display: 'inline', marginLeft: 4 }} onClick={() => setShowEmbargoTooltip(v => !v)} />
            </strong>
            {showEmbargoTooltip && (
              <div className="term-explainer-inline">
                Buffer interval separating train/test cuts to nullify overlap and autocorrelation.
              </div>
            )}
            <div style={{ marginTop: '0.2rem', fontSize: '0.65rem' }}>
              A mandatory buffer is used between train/test cuts to prevent data leakage.
            </div>
          </div>
          <div>
            <strong>Baselines comparison:</strong> Performance measured vs. simpler coin-flip persistence rules.
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
        <button
          onClick={() => { playClick(); setIsSimpleMode(v => !v); }}
          className="btn btn-secondary"
        >
          {isSimpleMode ? 'Simple Mode' : 'Advanced Mode'}
          {isSimpleMode
            ? <ToggleLeft className="w-4 h-4" style={{ color: '#64748b' }} />
            : <ToggleRight className="w-4 h-4 text-blue-500" />}
        </button>
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
