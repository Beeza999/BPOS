import React, { createContext, useEffect, useMemo, useState } from 'react';
import {
  GLOBAL_REALTIME_EVENTS,
  SOCKET_AUTH_REFRESH_EVENT,
  dispatchRealtimeEvent,
  refreshSocketAuth,
  socket,
} from '../lib/socket.js';

export const SocketContext = createContext({
  socket,
  connected: false,
  lastEvent: null,
});

export default function SocketProvider({ children }) {
  const [connected, setConnected] = useState(socket.connected);
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    function syncConnection() {
      refreshSocketAuth();
      setConnected(socket.connected);
    }

    syncConnection();

    window.addEventListener(SOCKET_AUTH_REFRESH_EVENT, syncConnection);
    window.addEventListener('popstate', syncConnection);
    window.addEventListener('focus', syncConnection);
    window.addEventListener('storage', syncConnection);

    return () => {
      window.removeEventListener(SOCKET_AUTH_REFRESH_EVENT, syncConnection);
      window.removeEventListener('popstate', syncConnection);
      window.removeEventListener('focus', syncConnection);
      window.removeEventListener('storage', syncConnection);
    };
  }, []);

  useEffect(() => {
    function handleConnect() {
      setConnected(true);
    }

    function handleDisconnect() {
      setConnected(false);
    }

    function handleConnectError(error) {
      setConnected(false);
      if (import.meta.env.DEV) console.warn('Socket.IO connection error:', error?.message || error);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, []);

  useEffect(() => {
    function forward(event) {
      return (payload) => {
        const nextEvent = { event, payload, receivedAt: Date.now() };
        setLastEvent(nextEvent);
        dispatchRealtimeEvent(event, payload);
      };
    }

    const handlers = GLOBAL_REALTIME_EVENTS.map((event) => {
      const handler = forward(event);
      socket.on(event, handler);
      return { event, handler };
    });

    return () => {
      handlers.forEach(({ event, handler }) => socket.off(event, handler));
    };
  }, []);

  const value = useMemo(() => ({ socket, connected, lastEvent }), [connected, lastEvent]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
