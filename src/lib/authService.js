import { disconnectSensorSocket } from '../api/socketClient.js';
import { useCloudAuthStore } from '../store/cloudAuthStore.js';
import { useIdeStore } from '../store/ideStore.js';
import { refreshPersistTarget } from './cloudRouting.js';

/**
 * Subscribe to session changes and hydrate initial session. Safe when Supabase is not configured.
 * @returns {() => void} cleanup (unsubscribe)
 */
export function initSupabaseAuth() {
  useIdeStore.getState().setSupabaseCloudConfigured(false);
  useCloudAuthStore.getState().setFromSession(null);
  useCloudAuthStore.getState().setAuthLoading(false);
  refreshPersistTarget();
  return () => {};
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signUp(email, password) {
  void email;
  void password;
  const msg = 'Supabase auth is disabled. Use local account login.';
  useCloudAuthStore.getState().setAuthError(msg);
  throw new Error(msg);
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signIn(email, password) {
  void email;
  void password;
  const msg = 'Supabase auth is disabled. Use local account login.';
  useCloudAuthStore.getState().setAuthError(msg);
  throw new Error(msg);
}

export async function signOut() {
  disconnectSensorSocket();
  useCloudAuthStore.getState().setFromSession(null);
  refreshPersistTarget();
}

/**
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function getCurrentUser() {
  return null;
}
