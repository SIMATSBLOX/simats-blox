import { createClient } from '@supabase/supabase-js';

const url = typeof import.meta.env.VITE_SUPABASE_URL === 'string' ? import.meta.env.VITE_SUPABASE_URL.trim() : '';
const anonKey =
  typeof import.meta.env.VITE_SUPABASE_ANON_KEY === 'string' ? import.meta.env.VITE_SUPABASE_ANON_KEY.trim() : '';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let client = null;

/**
 * True when both Vite env vars are non-empty. Safe to call without try/catch.
 */
export function isSupabaseConfigured() {
  return url.length > 0 && anonKey.length > 0;
}

/**
 * Lazily creates the client only when configured. Returns null otherwise (never throws).
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
export function getSupabaseClient() {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
