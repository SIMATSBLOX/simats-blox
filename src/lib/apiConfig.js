/**
 * API + real-time configuration for deploy-later workflows.
 *
 * Local dev (default): leave VITE_API_URL unset — browser uses same origin; Vite proxies
 * `/api` and `/socket.io` to the Express server (see vite.config.js).
 *
 * Deployed: set VITE_API_URL to your API origin only (no trailing slash), e.g.
 * `https://api.yourdomain.com` — REST becomes `${VITE_API_URL}/api/...` and Socket.IO
 * connects to that host (CORS must allow your web app origin on the server).
 */
const trimmedApiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** REST prefix: `/api` behind dev proxy, or absolute URL in production. */
export const API_PREFIX = trimmedApiOrigin ? `${trimmedApiOrigin}/api` : '/api';

/**
 * Socket.IO server URL (origin only). Matches REST host when VITE_API_URL is set;
 * otherwise current page origin (dev proxy forwards `/socket.io`).
 * @returns {string}
 */
export function getSocketIoUrl() {
  if (trimmedApiOrigin) return trimmedApiOrigin;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return '';
}
