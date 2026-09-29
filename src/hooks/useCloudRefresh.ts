import { useEffect, useRef } from 'react';

const DEFAULT_INTERVAL_MS = 30000;

/** Vuelve a cargar datos de Hildra al enfocar la pestaña y de forma periódica (web ↔ móvil). */
export function useCloudRefresh(onRefresh: () => void | Promise<void>, enabled = true, intervalMs = DEFAULT_INTERVAL_MS) {
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      void refreshRef.current();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };

    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(tick, intervalMs);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}
