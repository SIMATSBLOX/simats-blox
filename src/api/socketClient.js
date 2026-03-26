import { io } from 'socket.io-client';
import { readAuthTokenFromStorage } from '../lib/authStorage.js';
import { getSocketIoUrl } from '../lib/apiConfig.js';

/** @type {import('socket.io-client').Socket | null} */
let socket = null;
/** @type {string | null} */
let lastAuthToken = null;
/** @type {string | null} */
let lastSocketUrl = null;

/**
 * Socket.IO client with JWT in `handshake.auth.token` (server joins `user:<sub>`).
 * Reconnects when the stored session token or API origin configuration changes.
 */
export function getSensorSocket() {
  if (typeof window === 'undefined') return null;
  const token = readAuthTokenFromStorage();
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

  if (!socket || lastAuthToken !== token || lastSocketUrl !== url) {
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
  }
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
