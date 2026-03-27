import { readAuthTokenFromStorage } from '../lib/authStorage.js';
import { API_PREFIX } from '../lib/apiConfig.js';

function authHeaders() {
  const token = readAuthTokenFromStorage();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Express often returns HTML like `<pre>Cannot DELETE /api/foo</pre>` for unknown routes. */
function isExpressUnmatchedRouteBody(msg) {
  if (typeof msg !== 'string') return false;
  const plain = msg.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return /\bCannot [A-Z]+ \/api\//.test(plain);
}

async function handle(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text || res.statusText };
  }
  if (!res.ok) {
    let msg = body?.error || body?.details?.join?.(', ') || res.statusText;
    if (typeof msg === 'string' && res.status === 404 && isExpressUnmatchedRouteBody(msg)) {
      msg =
        'This API build does not support that request (404). Redeploy the API host with the latest code — e.g. device delete needs DELETE /api/devices/:id on the server.';
    }
    throw new Error(typeof msg === 'string' ? msg : 'Request failed');
  }
  return body;
}

export async function fetchDeviceList() {
  const res = await fetch(`${API_PREFIX}/devices`, { headers: { ...authHeaders() } });
  return handle(res);
}

/**
 * @param {string} deviceId
 */
export async function fetchDeviceLatest(deviceId) {
  const res = await fetch(`${API_PREFIX}/devices/${encodeURIComponent(deviceId)}/latest`, {
    headers: { ...authHeaders() },
  });
  return handle(res);
}

/**
 * @param {string} deviceId
 * @param {number} [limit]
 */
export async function fetchDeviceHistory(deviceId, limit = 80) {
  const q = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${API_PREFIX}/devices/${encodeURIComponent(deviceId)}/history?${q}`, {
    headers: { ...authHeaders() },
  });
  return handle(res);
}

/**
 * Register a device for the signed-in user. Returns `apiKey` once — store it on the ESP32.
 * @param {{ deviceId: string; name: string; sensorType: string; location?: string; apiKey?: string }} body
 */
export async function registerDevice(body) {
  const res = await fetch(`${API_PREFIX}/devices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  return handle(res);
}

/**
 * @param {string} deviceId
 */
export async function deleteDevice(deviceId) {
  const res = await fetch(`${API_PREFIX}/devices/${encodeURIComponent(deviceId)}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  return handle(res);
}
