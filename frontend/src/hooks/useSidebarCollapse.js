import { useState, useEffect } from 'react';

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const item = window.localStorage.getItem('hodl_sidebar_collapsed');
      return item ? JSON.parse(item) : false;
    } catch (e) {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      window.localStorage.setItem('hodl_sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  return [collapsed, toggle];
}
