/**
 * Client-side “stale = offline” using last activity time. Server still stores status/last_seen_at;
 * this layer matches user expectation when readings stop (no server cron required).
 *
 * Override with VITE_DEVICE_OFFLINE_AFTER_MS (milliseconds). Default: 120000 (2 minutes).
 */
export const DEVICE_OFFLINE_AFTER_MS = (() => {
  const n = Number(import.meta.env.VITE_DEVICE_OFFLINE_AFTER_MS);
  return Number.isFinite(n) && n >= 10_000 ? n : 120_000;
})();

/**
 * @param {{ lastSeenAt?: string | null, status?: string }} device
 * @param {{ createdAt?: string } | null | undefined} latestReading
 * @param {number} nowMs
 * @returns {{ isOnline: boolean, lastActivityMs: number | null, lastActivityIso: string | null }}
 */
export function getDevicePresence(device, latestReading, nowMs = Date.now()) {
  const t1 = device?.lastSeenAt ? Date.parse(String(device.lastSeenAt)) : NaN;
  const t2 = latestReading?.createdAt ? Date.parse(String(latestReading.createdAt)) : NaN;
  const last = Math.max(
    Number.isFinite(t1) ? t1 : 0,
    Number.isFinite(t2) ? t2 : 0,
  );
  if (!last) {
    return { isOnline: false, lastActivityMs: null, lastActivityIso: null };
  }
  const stale = nowMs - last > DEVICE_OFFLINE_AFTER_MS;
  return {
    isOnline: !stale,
    lastActivityMs: last,
    lastActivityIso: new Date(last).toISOString(),
  };
}
