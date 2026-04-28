/** Verify local Express JWT for dashboard/device REST + Socket.IO. */
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwtSecret.js';

/**
 * @param {string} token Bearer token (no "Bearer " prefix)
 * @returns {Promise<{ sub: string, login: string, authSource: 'express' } | null>}
 */
export async function verifyDashboardBearerToken(token) {
  const trimmed = String(token ?? '').trim();
  if (!trimmed) return null;

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
