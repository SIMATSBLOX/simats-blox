import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/jwt.js';

/**
 * Same JWT contract as SQLite auth API (`Authorization: Bearer …`).
 */
export function authUserJwt(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sign in required.' });
  }
  const token = h.slice(7).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload?.sub || typeof payload.sub !== 'string') {
      return res.status(401).json({ error: 'Invalid session.' });
    }
    req.user = { id: payload.sub, login: String(payload.login || '') };
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid. Sign in again.' });
  }
}
