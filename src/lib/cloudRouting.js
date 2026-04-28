import { useAuthStore } from '../store/authStore.js';
import { useIdeStore } from '../store/ideStore.js';

/**
 * Which backend should own Save/Open.
 * - `express_api` — local backend account
 * - `local` — browser localStorage only
 * @returns {'local' | 'express_api'}
 */
export function computePersistTarget() {
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

export function isSupabaseCloudSessionActive() {
  return false;
}
