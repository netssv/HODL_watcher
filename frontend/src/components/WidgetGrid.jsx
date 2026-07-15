import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, Square } from 'lucide-react';

export function WidgetCard({ children, title, id, onHide, onMinimize, onMaximize, isMaximized }) {
  return (
    <div className="widget-card-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="widget-drag-handle" style={{ cursor: 'default' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>{title}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.2rem' }}>
          <button onClick={() => onMinimize(id)} className="widget-close-btn" title="Minimize">
            <Minus size={14} />
          </button>
          <button onClick={() => onMaximize(id)} className="widget-close-btn" title={isMaximized ? "Restore" : "Maximize"}>
            <Square size={12} />
          </button>
          <button onClick={() => onHide(id)} className="widget-close-btn" title="Close widget">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="widget-content-scrollable" style={{ flexGrow: 1, overflow: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

export default function WidgetGrid({ 
  hiddenWidgets,
  minimizedWidgets,
  maximizedWidget,
  hideWidget,
  minimizeWidget,
  toggleMaximize,
  restoreWidget,
  children 
}) {
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 996);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 996);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const childArray = React.Children.toArray(children);
  const activeChildren = childArray.filter(child => 
    child && child.props && !hiddenWidgets.includes(child.props.id) && !minimizedWidgets.includes(child.props.id)
  );

  const maximizedChild = childArray.find(c => c && c.props && c.props.id === maximizedWidget);

  return (
    <>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(12, 1fr)', 
        gap: '16px',
        margin: '16px'
      }}>
        {activeChildren.map(child => {
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
              <WidgetCard 
                title={child.props.title} 
                id={child.props.id} 
                onHide={hideWidget}
                onMinimize={minimizeWidget}
                onMaximize={toggleMaximize}
                isMaximized={false}
              >
                {child}
              </WidgetCard>
            </div>
          );
        })}
      </div>

      {maximizedChild && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999, backgroundColor: 'var(--bg-card)',
          display: 'flex', flexDirection: 'column'
        }}>
          <WidgetCard 
            title={maximizedChild.props.title} 
            id={maximizedChild.props.id} 
            onHide={hideWidget}
            onMinimize={minimizeWidget}
            onMaximize={toggleMaximize}
            isMaximized={true}
          >
            {maximizedChild}
          </WidgetCard>
        </div>,
        document.body
      )}

    </>
  );
}
