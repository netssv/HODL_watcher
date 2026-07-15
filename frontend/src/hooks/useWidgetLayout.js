import { useState, useEffect } from 'react';

const DEFAULT_LAYOUTS = {
  lg: [
    { i: 'projections', x: 0, y: 0, w: 12, h: 4, minW: 4, minH: 3 },
    { i: 'chart', x: 0, y: 4, w: 12, h: 8, minW: 4, minH: 5 },
    { i: 'strategy', x: 0, y: 12, w: 6, h: 3, minW: 4, minH: 2 },
    { i: 'risk', x: 6, y: 12, w: 6, h: 3, minW: 4, minH: 2 },
    { i: 'llm', x: 0, y: 15, w: 12, h: 3, minW: 4, minH: 2 },
    { i: 'validation', x: 0, y: 18, w: 12, h: 4, minW: 4, minH: 3 },
  ]
};

export function useWidgetLayout() {
  const [layout, setLayout] = useState(() => {
    try {
      const saved = window.localStorage.getItem('hodl_widget_layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return { lg: parsed };
        }
        return parsed;
      }
      return DEFAULT_LAYOUTS;
    } catch (e) {
      return DEFAULT_LAYOUTS;
    }
  });

  const [hiddenWidgets, setHiddenWidgets] = useState(() => {
    try {
      const saved = window.localStorage.getItem('hodl_hidden_widgets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const onLayoutChange = (newLayout) => {
    setLayout(newLayout);
    window.localStorage.setItem('hodl_widget_layout', JSON.stringify(newLayout));
  };

  const hideWidget = (id) => {
    const nextHidden = [...hiddenWidgets, id];
    setHiddenWidgets(nextHidden);
    window.localStorage.setItem('hodl_hidden_widgets', JSON.stringify(nextHidden));
  };

  const addWidget = (id) => {
    const nextHidden = hiddenWidgets.filter(w => w !== id);
    setHiddenWidgets(nextHidden);
    window.localStorage.setItem('hodl_hidden_widgets', JSON.stringify(nextHidden));
  };

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUTS);
    setHiddenWidgets([]);
    window.localStorage.removeItem('hodl_widget_layout');
    window.localStorage.removeItem('hodl_hidden_widgets');
  };

  return {
    layout,
    hiddenWidgets,
    onLayoutChange,
    hideWidget,
    addWidget,
    resetLayout,
  };
}
