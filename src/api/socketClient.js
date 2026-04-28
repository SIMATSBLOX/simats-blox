import { io } from 'socket.io-client';
import { getDashboardAccessToken } from '../lib/dashboardAuthToken.js';
import { getSocketIoUrl } from '../lib/apiConfig.js';

/** @type {import('socket.io-client').Socket | null} */
let socket = null;
/** @type {string | null} */
let lastAuthToken = null;
/** @type {string | null} */
let lastSocketUrl = null;

/** @type {boolean} */
let authHooksAttached = false;

/**
 * Reconnect when local auth session changes (lazy to avoid circular import with authStore).
 */
function ensureDashboardAuthHooks() {
  if (authHooksAttached) return;
  authHooksAttached = true;

  import('../store/authStore.js').then(({ useAuthStore }) => {
    useAuthStore.subscribe(() => {
      queueMicrotask(() => void connectSensorSocket());
    });
  });

}

/**
 * Ensures Socket.IO uses the same Bearer token as REST API calls.
 */
export async function connectSensorSocket() {
  if (typeof window === 'undefined') return null;
  ensureDashboardAuthHooks();

  const { token } = await getDashboardAccessToken();
  const url = getSocketIoUrl();

  if (!token) {
    if (socket) {
      socket.disconnect();
      socket = null;
      lastAuthToken = null;
      lastSocketUrl = null;
    }
    return null;
  }

  if (!url) return null;

  if (socket && lastAuthToken === token && lastSocketUrl === url) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }
  lastAuthToken = token;
  lastSocketUrl = url;
  socket = io(url, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

/**
 * Current socket after {@link connectSensorSocket} has run. Prefer awaiting `connectSensorSocket` in effects.
 */
export function getSensorSocket() {
  return socket;
}

export function disconnectSensorSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  lastAuthToken = null;
  lastSocketUrl = null;
}
