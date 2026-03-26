import { create } from 'zustand';
import { disconnectSensorSocket } from '../api/socketClient.js';
import { API_PREFIX } from '../lib/apiConfig.js';
import {
  readAuthLoginFromStorage,
  readAuthTokenFromStorage,
  writeAuthSessionToStorage,
} from '../lib/authStorage.js';

/** For non-React callers (legacy); prefer `readAuthTokenFromStorage` from `authStorage.js`. */
export function getAuthToken() {
  return readAuthTokenFromStorage();
}

export const useAuthStore = create((set) => ({
  login: readAuthLoginFromStorage(),
  isAuthenticated: !!readAuthTokenFromStorage(),

  setSession: (token, login) => {
    writeAuthSessionToStorage(token, login);
    set({ login: login || null, isAuthenticated: !!token });
  },

  clearSession: () => {
    disconnectSensorSocket();
    writeAuthSessionToStorage(null, null);
    set({ login: null, isAuthenticated: false });
  },

  hydrateFromStorage: () => {
    set({ login: readAuthLoginFromStorage(), isAuthenticated: !!readAuthTokenFromStorage() });
  },

  /**
   * @param {string} login
   * @param {string} password
   */
  signUp: async (login, password) => {
    const res = await fetch(`${API_PREFIX}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Sign up failed (${res.status})`);
    writeAuthSessionToStorage(data.token, data.login);
    set({ login: data.login, isAuthenticated: true });
  },

  /**
   * @param {string} login
   * @param {string} password
   */
  signIn: async (login, password) => {
    const res = await fetch(`${API_PREFIX}/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Sign in failed (${res.status})`);
    writeAuthSessionToStorage(data.token, data.login);
    set({ login: data.login, isAuthenticated: true });
  },

  signOut: () => {
    disconnectSensorSocket();
    writeAuthSessionToStorage(null, null);
    set({ login: null, isAuthenticated: false });
  },
}));
