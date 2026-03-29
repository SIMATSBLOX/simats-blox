import { useEffect, useState } from 'react';
import { getStoredDeviceApiKey } from '../lib/deviceKeyStorage.js';

/**
 * Re-read when localStorage keys map changes (same-tab Step 2 / Regenerate save).
 * @param {string} deviceId
 */
export function useStoredDeviceKey(deviceId) {
  const [key, setKey] = useState(() => getStoredDeviceApiKey(deviceId));

  useEffect(() => {
    setKey(getStoredDeviceApiKey(deviceId));
    const fn = () => setKey(getStoredDeviceApiKey(deviceId));
    window.addEventListener('simats-device-keys-changed', fn);
    return () => window.removeEventListener('simats-device-keys-changed', fn);
  }, [deviceId]);

  return key;
}
