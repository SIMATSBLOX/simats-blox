import { useCallback, useEffect, useState } from 'react';
import { fetchDeviceLatest, fetchDeviceList } from '../api/readingApi.js';
import { connectSensorSocket, getSensorSocket } from '../api/socketClient.js';
import { useDashboardSession } from './useDashboardSession.js';

/**
 * Narrow live monitor: one device list row + latest reading + filtered sensor:update.
 * Read-only; same API/socket patterns as the dashboard, no new backend routes.
 *
 * @param {string} deviceId
 * @param {string} [sensorTypeHint] URL/state hint before list row loads
 */
export function useIdeDeviceMonitor(deviceId, sensorTypeHint = '') {
  const { isAuthenticated } = useDashboardSession();
  const [device, setDevice] = useState(/** @type {object | null} */ (null));
  const [latest, setLatest] = useState(/** @type {object | null} */ (null));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const load = useCallback(async () => {
    if (!deviceId?.trim() || !isAuthenticated) {
      setDevice(null);
      setLatest(null);
      setLoading(false);
      setError(null);
      return;
    }
    const id = deviceId.trim();
    setLoading(true);
    setError(null);
    try {
      const { devices: list } = await fetchDeviceList();
      const devs = Array.isArray(list) ? list : [];
      const row = devs.find((d) => d.deviceId === id);
      setDevice(
        row ??
          (id
            ? {
                deviceId: id,
                name: '',
                sensorType: sensorTypeHint || null,
                status: null,
                lastSeenAt: null,
              }
            : null),
      );
      const pack = await fetchDeviceLatest(id);
      setLatest(pack.latest ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
      setDevice(null);
      setLatest(null);
    } finally {
      setLoading(false);
    }
  }, [deviceId, isAuthenticated, sensorTypeHint]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isAuthenticated || !deviceId?.trim()) return undefined;
    const id = deviceId.trim();
    const ac = new AbortController();

    void (async () => {
      await connectSensorSocket();
      if (ac.signal.aborted) return;
      const s = getSensorSocket();
      if (!s) return;

      const onUpdate = (payload) => {
        if (payload?.deviceId !== id) return;
        setLatest({
          data: payload.data ?? {},
          sensorType: payload.sensorType,
          createdAt: payload.createdAt,
        });
        setDevice((prev) => {
          if (!prev || prev.deviceId !== id) {
            return {
              deviceId: id,
              name: '',
              sensorType: (payload.sensorType ?? sensorTypeHint) || null,
              status: 'online',
              lastSeenAt: payload.createdAt,
            };
          }
          return { ...prev, status: 'online', lastSeenAt: payload.createdAt };
        });
      };

      s.on('sensor:update', onUpdate);
      ac.signal.addEventListener('abort', () => {
        s.off('sensor:update', onUpdate);
      });
    })();

    return () => ac.abort();
  }, [isAuthenticated, deviceId, sensorTypeHint]);

  const sensorType =
    (device?.sensorType && String(device.sensorType)) ||
    (latest?.sensorType && String(latest.sensorType)) ||
    sensorTypeHint ||
    '';

  return { device, latest, sensorType, loading, error, refetch: load };
}
