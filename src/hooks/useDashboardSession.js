import { useAuthStore } from '../store/authStore.js';

/**
 * Session for /devices and related APIs.
 * Local backend JWT session.
 */
export function useDashboardSession() {
  const expressLogin = useAuthStore((s) => s.login);
  const expressAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return {
    isAuthenticated: expressAuthenticated,
    displayLogin: expressLogin ?? null,
    hasSupabase: false,
    hasExpress: expressAuthenticated,
    sessionHydrating: false,
  };
}
