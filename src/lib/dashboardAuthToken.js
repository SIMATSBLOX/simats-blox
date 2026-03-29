import { readAuthTokenFromStorage } from './authStorage.js';
import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';

/**
 * Token for device/dashboard REST + Socket.IO. Prefers Supabase session when configured (canonical identity),
 * else legacy Express JWT from localStorage.
 * @returns {Promise<{ token: string | null; source: 'supabase' | 'express' | null }>}
 */
export async function getDashboardAccessToken() {
  if (isSupabaseConfigured()) {
    const sb = getSupabaseClient();
    if (sb) {
      const {
        data: { session },
      } = await sb.auth.getSession();
      if (session?.access_token) {
        return { token: session.access_token, source: 'supabase' };
      }
    }
  }
  const express = readAuthTokenFromStorage();
  if (express) return { token: express, source: 'express' };
  return { token: null, source: null };
}
