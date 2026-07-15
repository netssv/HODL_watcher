import React, { useState, useRef, useEffect } from 'react';
import { Plus, LayoutDashboard } from 'lucide-react';

export function AddWidgetMenu({ hiddenWidgets, addWidget, resetLayout }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const widgetNames = {
    projections: 'Directional Projections',
    chart: 'Chart',
    strategy: 'Strategy',
    risk: 'Risk Management',
    llm: 'LLM Payload',
    validation: 'Walk-Forward Trend'
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <button onClick={resetLayout} className="btn btn-secondary" title="Reset layout to default">
        <LayoutDashboard size={14} /> Reset Layout
      </button>
      
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="btn btn-secondary"
          disabled={hiddenWidgets.length === 0}
        >
          <Plus size={14} /> Add Widget
        </button>
        
        {isOpen && hiddenWidgets.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
            backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: '4px', padding: '0.5rem', minWidth: '200px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100
          }}>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: 600, padding: '0 0.25rem' }}>
              Restore Widgets
            </div>
            {hiddenWidgets.map(id => (
              <button
                key={id}
                onClick={() => { addWidget(id); setIsOpen(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: 'none', border: 'none', padding: '0.4rem 0.5rem',
                  fontSize: '0.7rem', color: 'var(--text-secondary)', cursor: 'pointer',
                  borderRadius: '3px'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                + {widgetNames[id] || id}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
