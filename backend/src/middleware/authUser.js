import { verifyDashboardBearerToken } from '../../../server/dashboardJwt.js';

/**
 * JWT for device/dashboard APIs: Supabase access token first (if SUPABASE_JWT_SECRET set),
 * then legacy Express SQLite auth token.
 */
export function authUserJwt(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  const token = h.slice(7).trim();
  const out = verifyDashboardBearerToken(token);
  if (!out) {
    return res.status(401).json({ error: 'Session expired or invalid. Sign in again.' });
  }
  req.user = { id: out.sub, login: out.login, authSource: out.authSource };
  next();
}
