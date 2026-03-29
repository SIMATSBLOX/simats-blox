/**
 * REST + Socket.IO base URL for the Express API (SQLite backend).
 *
 * Local: omit VITE_API_URL — same origin; Vite proxies `/api` and `/socket.io` (vite.config.js).
 * Production (split static + API): set VITE_API_URL to the API origin only (no trailing slash).
 * Server must set CLIENT_ORIGIN / CORS for your UI origin.
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

/** Absolute or origin-relative URL for `POST` sensor readings (includes `x-device-key` header). */
export function getReadingsPostUrl() {
  if (trimmedApiOrigin) return `${trimmedApiOrigin}/api/readings`;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/readings`;
  }
  return '/api/readings';
}
