const LS_KEYS = 'simats_device_api_keys';

function notifyKeysChanged() {
  try {
    window.dispatchEvent(new CustomEvent('simats-device-keys-changed'));
  } catch {
    /* no window */
  }
}

/**
 * @returns {Record<string, string>}
 */
function readMap() {
  try {
    const raw = localStorage.getItem(LS_KEYS);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch {
    return {};
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(LS_KEYS, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {string} deviceId
 * @param {string} apiKey
 */
export function rememberDeviceApiKey(deviceId, apiKey) {
  const id = String(deviceId ?? '').trim();
  const key = String(apiKey ?? '').trim();
  if (!id || !key) return;
  const map = readMap();
  map[id] = key;
  writeMap(map);
  notifyKeysChanged();
}

/**
 * @param {string} deviceId
 */
export function forgetDeviceApiKey(deviceId) {
  const id = String(deviceId ?? '').trim();
  if (!id) return;
  const map = readMap();
  delete map[id];
  writeMap(map);
  notifyKeysChanged();
}

/**
 * @param {string} deviceId
 * @returns {string|null}
 */
export function getStoredDeviceApiKey(deviceId) {
  const id = String(deviceId ?? '').trim();
  if (!id) return null;
  const v = readMap()[id];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * @returns {string[]} deviceIds that have a saved key
 */
export function listDeviceIdsWithStoredKeys() {
  const map = readMap();
  return Object.keys(map).filter((id) => typeof map[id] === 'string' && map[id].trim());
}
