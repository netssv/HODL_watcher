import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

export function WidgetCard({ children, title, id, onHide }) {
  return (
    <div className="widget-card-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="widget-drag-handle" style={{ cursor: 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{title}</span>
        </div>
        <button onClick={() => onHide(id)} className="widget-close-btn" title="Hide widget">
          <X size={14} />
        </button>
      </div>
      <div className="widget-content-scrollable" style={{ flexGrow: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export default function WidgetGrid({ 
  hiddenWidgets, 
  hideWidget,
  children 
}) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 996);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 996);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(12, 1fr)', 
      gap: '16px',
      margin: '16px' 
    }}>
      {React.Children.toArray(children)
        .filter(child => child && child.props && !hiddenWidgets.includes(child.props.id))
        .map(child => {
          let span = 12;
          let minHeight = '300px';
          
          if (child.props.id === 'strategy' || child.props.id === 'risk') {
            span = 6;
          } else if (child.props.id === 'chart') {
            minHeight = '500px';
          } else if (child.props.id === 'projections' || child.props.id === 'validation') {
            minHeight = '400px';
          }

          return (
            <div 
              key={child.props.id} 
              style={{ 
                gridColumn: `span ${isDesktop ? span : 12}`,
                minHeight: minHeight,
                width: '100%'
              }}
            >
              <WidgetCard title={child.props.title} id={child.props.id} onHide={hideWidget}>
                {child}
              </WidgetCard>
            </div>
          );
        })}
    </div>
  );
}
