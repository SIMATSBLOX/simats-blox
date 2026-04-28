export function isSupabaseConfigured() {
  return false;
}

/**
 * Supabase is disabled in local-backend mode.
 * @returns {null}
 */
export function getSupabaseClient() {
  return null;
}
