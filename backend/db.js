import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient = null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for backend database access.');
}

export function getDb() {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
      global: { headers: { 'x-application-name': 'simats-blox-backend' } },
    });
  }
  return supabaseClient;
}

export async function initDb() {
  const db = getDb();
  const { error } = await db.from('users').select('id').limit(1);
  if (error) {
    console.warn('[db] Supabase schema validation:', error.message || error);
  }
}
