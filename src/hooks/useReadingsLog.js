import { useCallback, useEffect, useState } from 'react';
import { fetchReadingsHistoryLog } from '../api/readingApi.js';

const DEFAULT_LIMIT = 120;

/**
 * Load aggregated readings log (all devices or one). Fetches when `enabled` is true.
 * @param {boolean} enabled
 * @param {string} deviceIdFilter — empty string = all devices
 * @param {number} [limit]
 */
export function useReadingsLog(enabled, deviceIdFilter, limit = DEFAULT_LIMIT) {
  const [readings, setReadings] = useState(/** @type {object[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const refetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const trimmed = String(deviceIdFilter ?? '').trim();
      const body = await fetchReadingsHistoryLog({
        deviceId: trimmed || undefined,
        limit: Math.min(500, Math.max(1, limit)),
      });
      setReadings(Array.isArray(body.readings) ? body.readings : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load readings log');
      setReadings([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, deviceIdFilter, limit]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { readings, loading, error, refetch };
}
