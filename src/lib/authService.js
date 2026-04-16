import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { disconnectSensorSocket } from '../api/socketClient.js';
import { useCloudAuthStore } from '../store/cloudAuthStore.js';
import { useIdeStore } from '../store/ideStore.js';
import { refreshPersistTarget } from './cloudRouting.js';

function requireClient() {
  const c = getSupabaseClient();
  if (!c) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }
  return c;
}

/**
 * Subscribe to session changes and hydrate initial session. Safe when Supabase is not configured.
 * @returns {() => void} cleanup (unsubscribe)
 */
export function initSupabaseAuth() {
  if (!isSupabaseConfigured()) {
    useIdeStore.getState().setSupabaseCloudConfigured(false);
    useCloudAuthStore.getState().setFromSession(null);
    return () => {};
  }

  useIdeStore.getState().setSupabaseCloudConfigured(true);
  const supabase = requireClient();

  /**
   * End "initial auth" only once. Never use getSession().finally(false) alone: it can run with
   * session=null before onAuthStateChange applies storage (then /devices sees unauthenticated → /).
   */
  let initialHydrationDone = false;
  const finishInitialHydration = () => {
    if (initialHydrationDone) return;
    initialHydrationDone = true;
    useCloudAuthStore.getState().setAuthLoading(false);
  };

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    useCloudAuthStore.getState().setFromSession(session);
    refreshPersistTarget();
    finishInitialHydration();
  });

  void supabase.auth
    .getSession()
    .then(({ data: { session } }) => {
      useCloudAuthStore.getState().setFromSession(session);
      refreshPersistTarget();
      if (session) finishInitialHydration();
    })
    .catch(() => {
      finishInitialHydration();
    });

  const safetyMs = 4000;
  const safety = window.setTimeout(finishInitialHydration, safetyMs);

  return () => {
    window.clearTimeout(safety);
    subscription.unsubscribe();
  };
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signUp(email, password) {
  const supabase = requireClient();
  useCloudAuthStore.getState().setAuthLoading(true);
  useCloudAuthStore.getState().setAuthError(null);
  try {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    if (error) throw error;
    useCloudAuthStore.getState().setFromSession(data.session ?? null);
    refreshPersistTarget();
    return data;
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    useCloudAuthStore.getState().setAuthError(msg);
    throw e;
  } finally {
    useCloudAuthStore.getState().setAuthLoading(false);
  }
}

/**
 * @param {string} email
 * @param {string} password
 */
export async function signIn(email, password) {
  const supabase = requireClient();
  useCloudAuthStore.getState().setAuthLoading(true);
  useCloudAuthStore.getState().setAuthError(null);
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    useCloudAuthStore.getState().setFromSession(data.session);
    refreshPersistTarget();
    return data;
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    useCloudAuthStore.getState().setAuthError(msg);
    throw e;
  } finally {
    useCloudAuthStore.getState().setAuthLoading(false);
  }
}

export async function signOut() {
  if (!isSupabaseConfigured()) {
    disconnectSensorSocket();
    useCloudAuthStore.getState().setFromSession(null);
    refreshPersistTarget();
    return;
  }
  const supabase = requireClient();
  useCloudAuthStore.getState().setAuthLoading(true);
  useCloudAuthStore.getState().setAuthError(null);
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    disconnectSensorSocket();
    useCloudAuthStore.getState().setFromSession(null);
    refreshPersistTarget();
  } catch (e) {
    const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
    useCloudAuthStore.getState().setAuthError(msg);
    throw e;
  } finally {
    useCloudAuthStore.getState().setAuthLoading(false);
  }
}

/**
 * @returns {Promise<import('@supabase/supabase-js').User | null>}
 */
export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
