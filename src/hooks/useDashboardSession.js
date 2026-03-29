import { useCloudAuthStore } from '../store/cloudAuthStore.js';
import { useAuthStore } from '../store/authStore.js';

/**
 * Session for /devices and related APIs: Supabase user OR legacy Express JWT (fallback).
 */
export function useDashboardSession() {
  const sbUser = useCloudAuthStore((s) => s.user);
  const expressLogin = useAuthStore((s) => s.login);
  const expressAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const isAuthenticated = Boolean(sbUser) || expressAuthenticated;
  const displayLogin = sbUser?.email ?? expressLogin ?? null;

  return { isAuthenticated, displayLogin, hasSupabase: Boolean(sbUser), hasExpress: expressAuthenticated };
}
