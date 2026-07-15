import React, { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, ChevronUp, CheckCircle, AlertCircle, Loader } from 'lucide-react';

/* ── Training steps simulated client-side (mirroring real backend phases) ── */
const STEPS = [
  { id: 'fetch',    label: 'Fetching market data',          duration: 1800 },
  { id: 'features', label: 'Building feature matrix',       duration: 1400 },
  { id: 'split',    label: 'Creating walk-forward folds',   duration: 900  },
  { id: 'train',    label: 'Training Random Forest folds',  duration: 3200 },
  { id: 'metrics',  label: 'Computing honest metrics',      duration: 700  },
  { id: 'export',   label: 'Exporting agent payload',       duration: 500  },
];

function stepStatus(stepIndex, currentIndex, done, failed) {
  if (failed && stepIndex === currentIndex) return 'error';
  if (stepIndex < currentIndex || done)    return 'done';
  if (stepIndex === currentIndex)          return 'active';
  return 'pending';
}

function StepRow({ step, status, elapsed }) {
  const icon = {
    done:    <CheckCircle size={13} style={{ color: 'var(--up-color)', flexShrink: 0 }} />,
    active:  <Loader size={13} className="train-modal-spin" style={{ color: 'var(--accent-brand)', flexShrink: 0 }} />,
    error:   <AlertCircle size={13} style={{ color: 'var(--down-color)', flexShrink: 0 }} />,
    pending: <span style={{ width: 13, height: 13, display: 'inline-block', borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.12)', flexShrink: 0 }} />,
  }[status];

  return (
    <div className={`train-modal-step train-modal-step--${status}`}>
      {icon}
      <span className="train-modal-step-label">{step.label}</span>
      {status === 'done' && elapsed != null && (
        <span className="train-modal-step-time">{(elapsed / 1000).toFixed(1)}s</span>
      )}
      {status === 'active' && (
        <span className="train-modal-step-time blink">running…</span>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

export default function TrainModal({ visible, trainLoading, error, onHide }) {
  const [minimized, setMinimized]     = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [done, setDone]               = useState(false);
  const [failed, setFailed]           = useState(false);
  const [elapsed, setElapsed]         = useState([]); // ms per step
  const timerRef = useRef(null);
  const stepStart = useRef(null);

  /* Reset + run step ticker whenever a new train run starts */
  useEffect(() => {
    if (!trainLoading) return;           // wait for training to begin
    setCurrentStep(0);
    setElapsed([]);
    setDone(false);
    setFailed(false);
    setMinimized(false);
    stepStart.current = Date.now();

    let step = 0;
    const tick = () => {
      const dur = STEPS[step]?.duration ?? 500;
      timerRef.current = setTimeout(() => {
        const took = Date.now() - stepStart.current;
        setElapsed(prev => { const n = [...prev]; n[step] = took; return n; });
        stepStart.current = Date.now();
        step += 1;
        if (step < STEPS.length) {
          setCurrentStep(step);
          tick();
        }
        // don't mark done here — wait for trainLoading=false
      }, dur);
    };
    tick();

    return () => clearTimeout(timerRef.current);
  }, [trainLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  /* When backend finishes (trainLoading flips false) → mark done / failed */
  useEffect(() => {
    if (trainLoading) return;
    if (!visible) return;
    if (error) {
      setFailed(true);
    } else if (done === false && currentStep > 0) {
      // Finish any remaining steps instantly
      setCurrentStep(STEPS.length);
      setDone(true);
      setTimeout(() => setMinimized(true), 1800); // auto-minimize after 1.8s
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trainLoading, error]);

  if (!visible) return null;

  /* ── Minimized pill ─────────────────────────────────────────────────── */
  if (minimized) {
    return (
      <div className="train-modal-pill" onClick={() => setMinimized(false)}>
        <CheckCircle size={13} style={{ color: 'var(--up-color)' }} />
        <span>Calibration complete</span>
        <button
          className="train-modal-pill-hide"
          onClick={e => { e.stopPropagation(); onHide(); }}
          title="Dismiss"
        >
          <X size={11} />
        </button>
      </div>
    );
  }

  /* ── Full modal ─────────────────────────────────────────────────────── */
  const title = failed
    ? 'Calibration failed'
    : done
    ? 'Calibration complete'
    : 'Calibrating model…';

  return (
    <div className="train-modal-backdrop">
      <div className="train-modal">
        {/* Header */}
        <div className="train-modal-header">
          <div className="train-modal-title">
            {trainLoading && !failed && (
              <span className="train-modal-pulse" />
            )}
            {done && !failed && <CheckCircle size={14} style={{ color: 'var(--up-color)' }} />}
            {failed && <AlertCircle size={14} style={{ color: 'var(--down-color)' }} />}
            <span>{title}</span>
          </div>
          <div className="train-modal-actions">
            {(done || failed) && (
              <button
                className="train-modal-btn"
                onClick={() => setMinimized(true)}
                title="Minimize"
              >
                <ChevronDown size={14} />
              </button>
            )}
            <button
              className="train-modal-btn"
              onClick={onHide}
              title="Hide"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="train-modal-progressbar">
          <div
            className={`train-modal-progressbar-fill ${done ? 'done' : ''} ${failed ? 'failed' : ''}`}
            style={{ width: `${failed ? 100 : (currentStep / STEPS.length) * 100}%` }}
          />
        </div>

        {/* Steps */}
        <div className="train-modal-steps">
          {STEPS.map((step, i) => (
            <StepRow
              key={step.id}
              step={step}
              status={stepStatus(i, currentStep, done, failed)}
              elapsed={elapsed[i]}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="train-modal-footer">
          {trainLoading && (
            <span className="train-modal-footer-note">
              Walk-forward validation in progress — this takes ~10s
            </span>
          )}
          {done && (
            <span className="train-modal-footer-note" style={{ color: 'var(--up-color)' }}>
              Model recalibrated. Dashboard updated.
            </span>
          )}
          {failed && (
            <span className="train-modal-footer-note" style={{ color: 'var(--down-color)' }}>
              {error}
            </span>
          )}
          {(done || failed) && (
            <button className="train-modal-hide-btn" onClick={onHide}>
              Hide
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
