import { useState, useEffect } from 'react';

export function useWidgetLayout() {
  const [hiddenWidgets, setHiddenWidgets] = useState(() => {
    try {
      const saved = window.localStorage.getItem('hodl_hidden_widgets');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [minimizedWidgets, setMinimizedWidgets] = useState(() => {
    try {
      const saved = window.localStorage.getItem('hodl_minimized_widgets');
      return saved ? JSON.parse(saved) : ['llm']; // LLM is default minimized/collapsed per request
    } catch (e) { return ['llm']; }
  });

  const [maximizedWidget, setMaximizedWidget] = useState(() => {
    try {
      const saved = window.localStorage.getItem('hodl_maximized_widget');
      return saved ? JSON.parse(saved) : null;
    } catch (e) { return null; }
  });

  useEffect(() => {
    window.localStorage.setItem('hodl_hidden_widgets', JSON.stringify(hiddenWidgets));
  }, [hiddenWidgets]);

  useEffect(() => {
    window.localStorage.setItem('hodl_minimized_widgets', JSON.stringify(minimizedWidgets));
  }, [minimizedWidgets]);

  useEffect(() => {
    window.localStorage.setItem('hodl_maximized_widget', JSON.stringify(maximizedWidget));
  }, [maximizedWidget]);

  const hideWidget = (id) => {
    if (!hiddenWidgets.includes(id)) setHiddenWidgets([...hiddenWidgets, id]);
    if (minimizedWidgets.includes(id)) setMinimizedWidgets(minimizedWidgets.filter(w => w !== id));
    if (maximizedWidget === id) setMaximizedWidget(null);
  };

  const restoreWidget = (id) => {
    setHiddenWidgets(hiddenWidgets.filter(w => w !== id));
    setMinimizedWidgets(minimizedWidgets.filter(w => w !== id));
  };

  const minimizeWidget = (id) => {
    if (!minimizedWidgets.includes(id)) setMinimizedWidgets([...minimizedWidgets, id]);
    if (maximizedWidget === id) setMaximizedWidget(null);
  };

  const toggleMaximize = (id) => {
    setMaximizedWidget(maximizedWidget === id ? null : id);
  };

  const resetLayout = () => {
    setHiddenWidgets([]);
    setMinimizedWidgets(['llm']);
    setMaximizedWidget(null);
  };

  return {
    hiddenWidgets,
    minimizedWidgets,
    maximizedWidget,
    hideWidget,
    restoreWidget,
    minimizeWidget,
    toggleMaximize,
    resetLayout,
  };
}
