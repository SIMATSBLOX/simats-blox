/**
 * Dual verification for dashboard/device REST + Socket.IO:
 * 1) Supabase Auth access token (HS256 with project JWT secret) when SUPABASE_JWT_SECRET is set
 * 2) Legacy Express auth token (JWT_SECRET) — fallback
 *
 * Remove the Supabase branch when Express device auth is retired.
 */
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtSecret.js';

/**
 * @param {string} token Bearer token (no "Bearer " prefix)
 * @returns {{ sub: string, login: string, authSource: 'supabase' | 'express' } | null}
 */
export function verifyDashboardBearerToken(token) {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return null;

  const supabaseSecret = process.env.SUPABASE_JWT_SECRET?.trim();
  if (supabaseSecret) {
    try {
      const payload = jwt.verify(trimmed, supabaseSecret, {
        algorithms: ['HS256'],
      });
      const sub = payload?.sub;
      if (typeof sub === 'string' && sub.length > 0) {
        const email = typeof payload.email === 'string' ? payload.email : '';
        return {
          sub,
          login: email || sub,
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
