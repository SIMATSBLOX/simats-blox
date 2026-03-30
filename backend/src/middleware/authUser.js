import { verifyDashboardBearerToken } from '../../../server/dashboardJwt.js';

/**
 * JWT for device/dashboard APIs: Supabase access token (via auth.getUser) when URL + service role are set,
 * then legacy Express SQLite auth token.
 */
export async function authUserJwt(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  const token = h.slice(7).trim();
  try {
    const out = await verifyDashboardBearerToken(token);
    if (!out) {
      return res.status(401).json({ error: 'Session expired or invalid. Sign in again.' });
    }
    req.user = { id: out.sub, login: out.login, authSource: out.authSource };
    next();
  } catch (e) {
    console.error('[authUserJwt]', e?.message || e);
    return res.status(401).json({ error: 'Session expired or invalid. Sign in again.' });
  }
}
