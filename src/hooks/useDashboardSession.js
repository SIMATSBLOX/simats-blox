import { useCloudAuthStore } from '../store/cloudAuthStore.js';
import { useAuthStore } from '../store/authStore.js';
import { isDemoSupabaseOnly } from '../lib/demoSupabaseOnly.js';

/**
 * Session for /devices and related APIs.
 * Default: Supabase user OR legacy Express JWT (fallback).
 * With VITE_DEMO_SUPABASE_ONLY=true: Supabase session only (serial forward, /devices gate).
 */
export function useDashboardSession() {
  const sbUser = useCloudAuthStore((s) => s.user);
  const expressLogin = useAuthStore((s) => s.login);
  const expressAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const demoOnly = isDemoSupabaseOnly();
  const isAuthenticated = demoOnly ? Boolean(sbUser) : Boolean(sbUser) || expressAuthenticated;
  const displayLogin = demoOnly ? (sbUser?.email ?? sbUser?.id ?? null) : sbUser?.email ?? expressLogin ?? null;

  return {
    isAuthenticated,
    displayLogin,
    hasSupabase: Boolean(sbUser),
    hasExpress: demoOnly ? false : expressAuthenticated,
  };
}
