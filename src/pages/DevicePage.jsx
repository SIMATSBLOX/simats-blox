import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDeviceHistory } from '../hooks/useDeviceHistory.js';
import { getSensorSocket } from '../api/socketClient.js';
import LiveStatCard from '../components/dashboard/LiveStatCard.jsx';
import SensorChart from '../components/dashboard/SensorChart.jsx';
import RecentReadingsTable from '../components/dashboard/RecentReadingsTable.jsx';
import { formatSensorValue, getFieldsForSensorType } from '../lib/sensorDashboardConfig.js';

function formatSeen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function DevicePage() {
  const { deviceId } = useParams();
  const decodedId = deviceId ? decodeURIComponent(deviceId) : '';
  const { readings, device, loading, error, reload } = useDeviceHistory(decodedId, 120);

  useEffect(() => {
    const s = getSensorSocket();
    if (!s) return undefined;
    const onUpdate = (p) => {
      if (p?.deviceId === decodedId) void reload();
    };
    s.on('sensor:update', onUpdate);
    return () => s.off('sensor:update', onUpdate);
  }, [decodedId, reload]);

  const latest = readings[0] ?? null;
  const sensorType = device?.sensorType ?? latest?.sensorType ?? '';
  const fields = useMemo(() => getFieldsForSensorType(sensorType), [sensorType]);
  const data = latest?.data ?? {};

  if (!decodedId) {
    return (
      <div className="p-6 text-sm text-studio-muted">
        Missing device id. <Link to="/devices" className="text-studio-accent">Devices</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-studio-bg text-slate-100">
      <header className="sticky top-0 z-10 border-b border-studio-border bg-[#22262c]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2">
          <div>
            <Link to="/devices" className="text-[11px] text-studio-muted hover:text-slate-300">
              ← Devices
            </Link>
            <h1 className="mt-1 text-lg font-semibold">{device?.name ?? decodedId}</h1>
            <p className="font-mono text-[11px] text-studio-muted">{decodedId}</p>
          </div>
          <div className="text-right text-[11px] text-studio-muted">
            <div>
              Status:{' '}
              <span className={device?.status === 'online' ? 'text-emerald-400' : ''}>
                {device?.status ?? '—'}
              </span>
            </div>
            <div>Last seen: {formatSeen(device?.lastSeenAt)}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        {loading ? <p className="text-sm text-studio-muted">Loading…</p> : null}
        {error ? (
          <div className="rounded border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div>
        ) : null}

        {device && sensorType ? (
          <>
            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-studio-muted">Latest</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {fields.map((f) => (
                  <LiveStatCard
                    key={f.key}
                    label={f.label}
                    value={formatSensorValue(sensorType, data, f.key)}
                    sub={latest?.createdAt ? `Recorded ${formatSeen(latest.createdAt)}` : undefined}
                  />
                ))}
              </div>
            </section>

            <section className="mb-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-studio-muted">History</h2>
              <SensorChart readings={readings} sensorType={sensorType} />
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-studio-muted">
                Recent readings
              </h2>
              <RecentReadingsTable
                readings={readings}
                sensorType={sensorType}
                deviceLabel={device?.name ?? decodedId}
              />
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
