/**
 * Dual verification for dashboard/device REST + Socket.IO:
 * 1) Supabase Auth — validates access token via `auth.getUser(jwt)` (server: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * 2) Legacy Express token — JWT_SECRET
 */
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtSecret.js';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
let supabaseAdmin = null;

function getSupabaseAdminForAuth() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  if (!supabaseAdmin) {
    supabaseAdmin = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdmin;
}

/**
 * @param {string} token Bearer token (no "Bearer " prefix)
 * @returns {Promise<{ sub: string, login: string, authSource: 'supabase' | 'express' } | null>}
 */
export async function verifyDashboardBearerToken(token) {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return null;

  const sb = getSupabaseAdminForAuth();
  if (sb) {
    try {
      const { data, error } = await sb.auth.getUser(trimmed);
      if (!error && data?.user?.id) {
        const u = data.user;
        return {
          sub: u.id,
          login: typeof u.email === 'string' && u.email ? u.email : u.id,
          authSource: 'supabase',
        };
      }
    } catch {
      /* fall through to Express */
    }
  }

  try {
    const payload = jwt.verify(trimmed, JWT_SECRET);
    if (payload?.sub && typeof payload.sub === 'string') {
      return {
        sub: payload.sub,
        login: String(payload.login || ''),
        authSource: 'express',
      };
    }
  } catch {
    return null;
  }
  return null;
}
