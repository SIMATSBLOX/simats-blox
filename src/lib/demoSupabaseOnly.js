/**
 * When true, dashboard/device APIs and Socket.IO use only the Supabase session token.
 * Express JWT in localStorage is ignored; Local API account UI is hidden.
 *
 * Set in `.env.local`: VITE_DEMO_SUPABASE_ONLY=true
 * Restart Vite after changing.
 */
export function isDemoSupabaseOnly() {
  return import.meta.env.VITE_DEMO_SUPABASE_ONLY === 'true';
}
