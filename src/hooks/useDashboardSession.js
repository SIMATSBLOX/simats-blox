import { useCloudAuthStore } from '../store/cloudAuthStore.js';
import { useAuthStore } from '../store/authStore.js';
import { isDemoSupabaseOnly } from '../lib/demoSupabaseOnly.js';
import { isSupabaseConfigured } from '../lib/supabaseClient.js';

/**
 * Session for /devices and related APIs.
 * Default: Supabase user OR legacy Express JWT (fallback).
 * With VITE_DEMO_SUPABASE_ONLY=true: Supabase session only (serial forward, /devices gate).
 */
export function useDashboardSession() {
  const sbUser = useCloudAuthStore((s) => s.user);
  const authLoading = useCloudAuthStore((s) => s.authLoading);
  const expressLogin = useAuthStore((s) => s.login);
  const expressAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const demoOnly = isDemoSupabaseOnly();
  const isAuthenticated = demoOnly ? Boolean(sbUser) : Boolean(sbUser) || expressAuthenticated;
  const displayLogin = demoOnly ? (sbUser?.email ?? sbUser?.id ?? null) : sbUser?.email ?? expressLogin ?? null;
  /**
   * Wait for Supabase initial auth before treating sbUser as definitive.
   * If Express already has a JWT (non-demo builds), do not block /devices on Supabase hydration.
   */
  const sessionHydrating =
    isSupabaseConfigured() && authLoading && (demoOnly || !expressAuthenticated);

  return {
    isAuthenticated,
    displayLogin,
    hasSupabase: Boolean(sbUser),
    hasExpress: demoOnly ? false : expressAuthenticated,
    sessionHydrating,
  };
}
