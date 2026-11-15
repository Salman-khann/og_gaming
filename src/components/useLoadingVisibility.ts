'use client';
import { useEffect, useRef, useState } from 'react';

// Keep an initial loading indicator readable without delaying the request itself.
export function useLoadingVisibility(loading: boolean, minimumMs = 600) {
  const [visible, setVisible] = useState(loading);
  const started = useRef(0);
  useEffect(() => {
    if (loading) started.current = Date.now();
    const remaining = loading ? 0 : Math.max(0, minimumMs - (Date.now() - started.current));
    const timer = window.setTimeout(() => setVisible(loading), remaining);
    return () => window.clearTimeout(timer);
  }, [loading, minimumMs]);
  return loading || visible;
}
