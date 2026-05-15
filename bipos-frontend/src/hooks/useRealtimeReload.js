import { useEffect, useRef } from 'react';
import { GLOBAL_REALTIME_EVENTS, REALTIME_EVENT } from '../lib/socket.js';

export function useRealtimeReload(load, { enabled = true, events = GLOBAL_REALTIME_EVENTS, delay = 150 } = {}) {
  const loadRef = useRef(load);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    if (!enabled) return undefined;

    const allowed = new Set(events);
    let timer = null;

    function handleRealtime(event) {
      const eventName = event.detail?.event;
      if (!eventName || !allowed.has(eventName)) return;

      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        loadRef.current?.();
      }, delay);
    }

    window.addEventListener(REALTIME_EVENT, handleRealtime);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(REALTIME_EVENT, handleRealtime);
    };
  }, [enabled, delay, JSON.stringify(events)]);
}
