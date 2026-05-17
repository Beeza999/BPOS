import { io } from 'socket.io-client';
import { getAuthToken } from './api.js';

const API_BASE = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || 'https://bpos.onrender.com';

export const REALTIME_EVENT = 'bipos:realtime';
export const SOCKET_AUTH_REFRESH_EVENT = 'bipos:socket-auth-refresh';

export const GLOBAL_REALTIME_EVENTS = [
  'order:new',
  'order:created',
  'order:status',
  'order:cancelled',
  'kitchen:ticket-status',
  'payment:created',
  'payment:paid',
  'payment:voided',
  'payment:refunded',
  'shift:opened',
  'shift:closed',
  'menu:changed',
  'category:changed',
  'table:changed',
  'user:changed',
  'staff:call',
];

export function buildSocketAuth() {
  const token = getAuthToken();
  return token ? { token } : {};
}

export const socket = io(API_BASE, {
  autoConnect: false,
  auth: buildSocketAuth(),
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  transports: ['websocket', 'polling'],
});

let lastAuthToken = '';

export function refreshSocketAuth({ forceReconnect = false } = {}) {
  const nextAuth = buildSocketAuth();
  const nextToken = nextAuth.token || '';
  const tokenChanged = nextToken !== lastAuthToken;

  socket.auth = nextAuth;
  lastAuthToken = nextToken;

  if (!socket.connected) {
    socket.connect();
    return;
  }

  if (forceReconnect || tokenChanged) {
    socket.disconnect();
    socket.connect();
  }
}

export function notifySocketAuthChanged() {
  window.dispatchEvent(new CustomEvent(SOCKET_AUTH_REFRESH_EVENT));
}

export function dispatchRealtimeEvent(event, payload) {
  window.dispatchEvent(new CustomEvent(REALTIME_EVENT, { detail: { event, payload } }));
}

export function joinTableRoom(tableToken) {
  if (!tableToken) return;
  if (!socket.connected) refreshSocketAuth();
  socket.emit('table:join', { tableToken });
}
