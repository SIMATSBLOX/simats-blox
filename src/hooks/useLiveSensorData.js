import { useCallback, useEffect, useState } from 'react';
import { fetchDeviceLatest, fetchDeviceList } from '../api/readingApi.js';
import { connectSensorSocket, getSensorSocket } from '../api/socketClient.js';
import { useDashboardSession } from './useDashboardSession.js';

/**
 * Load all devices + latest reading each; subscribe to sensor:update for live refresh.
 * @returns {{ devices: object[], latestById: Record<string, { data: object, createdAt: string, sensorType: string }|null>, loading: boolean, error: string|null, refetch: () => Promise<void> }}
 */
export function useLiveSensorData() {
  const { isAuthenticated } = useDashboardSession();
  const [devices, setDevices] = useState(/** @type {object[]} */ ([]));
  const [latestById, setLatestById] = useState(/** @type {Record<string, object|null>} */ ({}));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string|null} */ (null));

  const refetch = useCallback(async () => {
    if (!isAuthenticated) {
      setDevices([]);
      setLatestById({});
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { devices: list } = await fetchDeviceList();
      const devs = Array.isArray(list) ? list : [];
      setDevices(devs);
      const entries = await Promise.all(
        devs.map(async (d) => {
          try {
            const pack = await fetchDeviceLatest(d.deviceId);
            return [d.deviceId, pack.latest ?? null];
          } catch {
            return [d.deviceId, null];
          }
        }),
      );
      setLatestById(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load devices');
      setDevices([]);
      setLatestById({});
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    const ac = new AbortController();

    void (async () => {
      await connectSensorSocket();
      if (ac.signal.aborted) return;
      const s = getSensorSocket();
      if (!s) return;

      const onUpdate = (payload) => {
        if (!payload?.deviceId) return;
        setLatestById((prev) => ({
          ...prev,
          [payload.deviceId]: {
            data: payload.data ?? {},
            sensorType: payload.sensorType,
            createdAt: payload.createdAt,
          },
        }));
        setDevices((prev) =>
          prev.map((d) =>
            d.deviceId === payload.deviceId
              ? { ...d, status: 'online', lastSeenAt: payload.createdAt }
              : d,
          ),
        );
      };

      s.on('sensor:update', onUpdate);
      ac.signal.addEventListener('abort', () => {
        s.off('sensor:update', onUpdate);
      });
    })();

    return () => ac.abort();
  }, [isAuthenticated]);

  return { devices, latestById, loading, error, refetch };
}
