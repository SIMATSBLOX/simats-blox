import { useCallback, useEffect, useState } from 'react';
import { fetchDeviceHistory } from '../api/readingApi.js';
import { connectSensorSocket, getSensorSocket } from '../api/socketClient.js';
import { getDashboardAccessToken } from '../lib/dashboardAuthToken.js';
import { useDashboardSession } from './useDashboardSession.js';

/**
 * Lightweight reading status for IDE kit banner (limit 1 history hit).
 * Uses existing JWT history API + sensor:update when socket is available.
 * @param {string} deviceId
 * @param {boolean} enabled
 */
export function useKitDeviceSetupProgress(deviceId, enabled) {
  const { isAuthenticated } = useDashboardSession();
  const [hasReading, setHasReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState(/** @type {string | null} */ (null));

  const reload = useCallback(async () => {
    if (!deviceId || !enabled) return;
    const { token } = await getDashboardAccessToken();
    if (!token) {
      setAuthRequired(true);
      setHasReading(false);
      setLoading(false);
      setError(null);
      return;
    }
    setAuthRequired(false);
    setLoading(true);
    setError(null);
    try {
      const pack = await fetchDeviceHistory(deviceId, 1);
      const readings = Array.isArray(pack.readings) ? pack.readings : [];
      setHasReading(readings.length > 0);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not load sensor status';
      setError(msg);
      setHasReading(false);
      if (/401|403|unauthoriz|sign in|not authenticated|missing token/i.test(msg)) {
        setAuthRequired(true);
      }
    } finally {
      setLoading(false);
    }
  }, [deviceId, enabled]);

  useEffect(() => {
    if (!deviceId || !enabled) {
      setHasReading(false);
      setAuthRequired(false);
      setError(null);
      setLoading(false);
      return;
    }
    void reload();
  }, [deviceId, enabled, isAuthenticated, reload]);

  useEffect(() => {
    if (!deviceId || !enabled) return undefined;
    const ac = new AbortController();
    void (async () => {
      await connectSensorSocket();
      if (ac.signal.aborted) return;
      const s = getSensorSocket();
      if (!s) return;
      const onUpdate = (p) => {
        if (p?.deviceId === deviceId) void reload();
      };
      s.on('sensor:update', onUpdate);
      ac.signal.addEventListener('abort', () => s.off('sensor:update', onUpdate));
    })();
    return () => ac.abort();
  }, [deviceId, enabled, isAuthenticated, reload]);

  useEffect(() => {
    if (!deviceId || !enabled || hasReading || authRequired) return undefined;
    const id = window.setInterval(() => void reload(), 12_000);
    return () => window.clearInterval(id);
  }, [deviceId, enabled, hasReading, authRequired, reload]);

  return { hasReading, loading, authRequired, error, reload };
}
