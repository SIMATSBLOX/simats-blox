import { useCallback, useEffect, useState } from 'react';
import { fetchDeviceHistory } from '../api/readingApi.js';

/**
 * @param {string|null|undefined} deviceId
 * @param {number} [limit]
 */
export function useDeviceHistory(deviceId, limit = 80) {
  const [readings, setReadings] = useState(/** @type {object[]} */ ([]));
  const [device, setDevice] = useState(/** @type {object|null} */ (null));
  const [loading, setLoading] = useState(!!deviceId);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const load = useCallback(async () => {
    if (!deviceId) {
      setReadings([]);
      setDevice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pack = await fetchDeviceHistory(deviceId, limit);
      setDevice(pack.device ?? null);
      setReadings(Array.isArray(pack.readings) ? pack.readings : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
      setReadings([]);
      setDevice(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return { readings, device, loading, error, reload: load };
}
