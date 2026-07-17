import React from 'react';
import { Activity } from 'lucide-react';

// Shared widget metadata used by both collapsed tray and expanded list
export const WIDGET_NAMES = {
  projections: 'Directional Projections',
  chart:       'Chart',
  llm:         'LLM Payload',
  validation:  'Walk-Forward Trend',
};

/** Shared helper — deduped union of hidden + minimized widget IDs */
export function allInactiveIds(hiddenWidgets = [], minimizedWidgets = []) {
  return Array.from(new Set([...hiddenWidgets, ...minimizedWidgets]));
}

/** Single restore row used in the expanded "Inactive Widgets" card */
export function InactiveWidgetRow({ id, isMinimized, icon, name, onRestore }) {
  return (
    <button
      onClick={onRestore}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        width: '100%', textAlign: 'left', background: 'none', border: 'none',
        padding: '0.4rem 0.5rem', fontSize: '0.88rem', cursor: 'pointer', borderRadius: '3px',
        color: isMinimized ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
      onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
      onMouseOut={e  => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon || <Activity size={14} />}
        {isMinimized && <div style={{ position: 'absolute', top: -4, right: -4, width: 6, height: 6, backgroundColor: 'var(--accent-brand)', borderRadius: '50%' }} />}
      </div>
      {name}
      {isMinimized && <span style={{ fontSize: '0.84rem', color: 'var(--accent-brand)', marginLeft: 'auto' }}>Minimized</span>}
    </button>
  );
}

/** Collapsed icon-tray restore button */
export function InactiveIconBtn({ id, isMinimized, icon, name, onRestore }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        className="sidebar-icon-btn"
        title={`Restore ${name}`}
        onClick={onRestore}
        style={{ color: isMinimized ? 'var(--text-primary)' : 'var(--text-secondary)' }}
      >
        {icon || <Activity size={18} />}
      </button>
      {isMinimized && (
        <div
          title="Minimized"
          style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, backgroundColor: 'var(--accent-brand)', borderRadius: '50%', border: '2px solid var(--bg-card)' }}
        />
      )}
    </div>
  );
}
