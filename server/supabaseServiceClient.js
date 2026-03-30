import { createClient } from '@supabase/supabase-js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let serviceClient = null;

/**
 * Server-side Supabase client (service role). Bypasses RLS — use only in API/server code.
 */
export function getSupabaseServiceClient() {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error(
      '[sensor] Supabase sensor backend requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  serviceClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return serviceClient;
}

export function resetSupabaseServiceClientForTests() {
  serviceClient = null;
}
