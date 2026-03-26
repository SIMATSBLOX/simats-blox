import { readAuthTokenFromStorage } from '../lib/authStorage.js';
import { API_PREFIX } from '../lib/apiConfig.js';

function authHeaders() {
  const token = readAuthTokenFromStorage();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
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
    const msg = body?.error || body?.details?.join?.(', ') || res.statusText;
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
