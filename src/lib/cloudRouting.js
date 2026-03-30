import { isSupabaseConfigured } from './supabaseClient.js';
import { useCloudAuthStore } from '../store/cloudAuthStore.js';
import { useAuthStore } from '../store/authStore.js';
import { useIdeStore } from '../store/ideStore.js';
import { isDemoSupabaseOnly } from './demoSupabaseOnly.js';

/**
 * Which backend should own Save/Open.
 * - `supabase` — Supabase configured and user signed in via Supabase
 * - `express_api` — local Express JWT account (npm run dev:full) — skipped when VITE_DEMO_SUPABASE_ONLY=true
 * - `local` — browser localStorage only
 * @returns {'local' | 'express_api' | 'supabase'}
 */
export function computePersistTarget() {
  if (isDemoSupabaseOnly()) {
    if (isSupabaseConfigured() && useCloudAuthStore.getState().user) {
      return 'supabase';
    }
    return 'local';
  }
  if (isSupabaseConfigured() && useCloudAuthStore.getState().user) {
    return 'supabase';
  }
  if (useAuthStore.getState().isAuthenticated) {
    return 'express_api';
  }
  return 'local';
}

/**
 * Pushes {@link computePersistTarget} into {@link useIdeStore}.
 * Clears {@link useIdeStore}'s `cloudProjectId` when the active backend changes so stale IDs are not sent to the wrong API.
 */
export function refreshPersistTarget() {
  const prev = useIdeStore.getState().persistTarget;
  const next = computePersistTarget();
  useIdeStore.getState().setPersistTarget(next);
  if (prev !== next) {
    useIdeStore.getState().setCloudProjectId(null);
  }
}

/**
 * True when Supabase env is set and a Supabase session exists (ready for cloud project CRUD next pass).
 */
export function isSupabaseCloudSessionActive() {
  return isSupabaseConfigured() && !!useCloudAuthStore.getState().user;
}
