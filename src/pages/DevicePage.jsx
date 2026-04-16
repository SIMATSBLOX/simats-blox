import { useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Laptop } from 'lucide-react';
import { useDeviceHistory } from '../hooks/useDeviceHistory.js';
import { useDeviceKeyRegeneration } from '../hooks/useDeviceKeyRegeneration.js';
import { usePresenceTick } from '../hooks/usePresenceTick.js';
import { connectSensorSocket, getSensorSocket } from '../api/socketClient.js';
import DeviceHardwareSampleCode from '../components/dashboard/DeviceHardwareSampleCode.jsx';
import KitConnectionChecklist from '../components/dashboard/KitConnectionChecklist.jsx';
import LiveStatCard from '../components/dashboard/LiveStatCard.jsx';
import SensorChart from '../components/dashboard/SensorChart.jsx';
import RecentReadingsTable from '../components/dashboard/RecentReadingsTable.jsx';
import Button from '../components/ui/Button.jsx';
import { getDevicePresence } from '../lib/devicePresence.js';
import { formatSensorValue, getDashboardFieldDefs } from '../lib/sensorDashboardConfig.js';
import {
  formatSensorSelectOptionLabel,
  friendlySensorTypeLabel,
  isPlaceholderSensorDisplayName,
  shortSensorDeviceIdForLabel,
} from '../lib/sensorAddPresets.js';
import { supportsDeviceHardwareSample } from '../lib/deviceHardwareSamples.js';

function formatSeen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

export default function DevicePage() {
  usePresenceTick();
  const { deviceId } = useParams();
  const decodedId = deviceId ? decodeURIComponent(deviceId) : '';
  const { readings, device, loading, error, reload } = useDeviceHistory(decodedId, 120);
  const regen = useDeviceKeyRegeneration(
    decodedId,
    device ? formatSensorSelectOptionLabel(device) : decodedId,
    () => void reload(),
  );

  useEffect(() => {
    const ac = new AbortController();
    void (async () => {
      await connectSensorSocket();
      if (ac.signal.aborted) return;
      const s = getSensorSocket();
      if (!s) return;
      const onUpdate = (p) => {
        if (p?.deviceId === decodedId) void reload();
      };
      s.on('sensor:update', onUpdate);
      ac.signal.addEventListener('abort', () => s.off('sensor:update', onUpdate));
    })();
    return () => ac.abort();
  }, [decodedId, reload]);

  const latest = readings[0] ?? null;
  const sensorType = device?.sensorType ?? latest?.sensorType ?? '';
  const fields = useMemo(() => getDashboardFieldDefs(sensorType, readings), [sensorType, readings]);
  const data = latest?.data ?? {};
  const presence = getDevicePresence(device, latest);
  const lastSeenDisplay = presence.lastActivityIso ?? device?.lastSeenAt;

  const showWaitingForFirstReading =
    Boolean(device && sensorType) && !loading && !error && readings.length === 0;

  const pageTitle = useMemo(() => {
    if (!device) return 'Sensor';
    if (!isPlaceholderSensorDisplayName(device.name)) return device.name.trim();
    return sensorType ? friendlySensorTypeLabel(sensorType) : 'Sensor';
  }, [device, sensorType]);

  if (!decodedId) {
    return (
      <div className="p-6 text-sm text-studio-muted">
        Missing sensor. <Link to="/devices" className="text-studio-accent">My sensors</Link>
      </div>
    );
  }

  function openDeviceAdvanced() {
    const el = document.querySelector(`details[data-device-page-advanced="${decodedId}"]`);
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function scrollToKitSample() {
    document.getElementById('kit-device-sample')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="min-h-screen bg-studio-bg text-slate-100">
      <header className="sticky top-0 z-10 border-b border-studio-border bg-[#22262c]/95 px-4 py-2.5 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link to="/devices" className="text-[11px] text-studio-muted hover:text-slate-300">
              ← My sensors
            </Link>
            <h1 className="mt-0.5 text-base font-semibold text-slate-100">{pageTitle}</h1>
            <p className="text-[11px] text-slate-500">
              {device && isPlaceholderSensorDisplayName(device.name) ? (
                <>
                  <span className="font-mono text-[10px] text-slate-500">
                    {shortSensorDeviceIdForLabel(decodedId)}
                  </span>
                  {device?.location ? (
                    <>
                      {' '}
                      · <span className="text-slate-600">{device.location}</span>
                    </>
                  ) : null}
                </>
              ) : (
                <>
                  <span>{sensorType ? friendlySensorTypeLabel(sensorType) : '—'}</span>
                  <span className="text-slate-600"> · </span>
                  <span className="font-mono text-[10px] text-slate-500">
                    {shortSensorDeviceIdForLabel(decodedId)}
                  </span>
                  {device?.location ? (
                    <>
                      {' '}
                      · <span className="text-slate-600">{device.location}</span>
                    </>
                  ) : null}
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 text-right text-[11px] text-studio-muted">
            {decodedId ? (
              <Link
                to={`/?device=${encodeURIComponent(decodedId)}&kit=1${
                  sensorType ? `&type=${encodeURIComponent(sensorType)}` : ''
                }&monitor=${encodeURIComponent(decodedId)}${
                  sensorType ? `&mt=${encodeURIComponent(sensorType)}` : ''
                }`}
                state={{
                  ideDeviceContext: {
                    deviceName: device?.name ?? '',
                    sensorType,
                  },
                }}
                title={`Continue this sensor in the Blockly IDE (${decodedId})`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-studio-accent/55 bg-studio-accent/15 px-3 py-1.5 text-xs font-medium text-studio-accent hover:bg-studio-accent/25"
              >
                <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Finish setup in IDE
              </Link>
            ) : null}
            <div>
              <span className={presence.isOnline ? 'font-medium text-emerald-400' : ''}>
                {presence.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div>Last seen {formatSeen(lastSeenDisplay)}</div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-4">
        {regen.newKey ? (
          <div className="mb-4 rounded-md border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[11px] text-amber-100">
            <div className="font-medium text-amber-200">New device key — copy once</div>
            <div className="mt-1.5 break-all font-mono text-[10px] text-slate-200">{regen.newKey}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button type="button" variant="default" className="!text-[10px]" onClick={() => void regen.copyKey()}>
                Copy key
              </Button>
              <Button type="button" variant="primary" className="!text-[10px]" onClick={() => regen.saveInBrowser()}>
                Save for IDE &amp; samples
              </Button>
              <Button type="button" variant="ghost" className="!text-[10px]" onClick={() => regen.dismiss()}>
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        {loading ? <p className="text-sm text-studio-muted">Loading…</p> : null}
        {error ? (
          <div className="rounded border border-red-900/40 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div>
        ) : null}

        {device && sensorType ? (
          <>
            <KitConnectionChecklist
              deviceId={decodedId}
              sensorType={sensorType}
              readingCount={readings.length}
              pendingApiKey={regen.newKey}
              presenceOnline={presence.isOnline}
              onScrollToSample={scrollToKitSample}
            />

            {showWaitingForFirstReading ? (
              supportsDeviceHardwareSample(sensorType) ? (
                <div id="kit-device-sample" className="mb-4">
                  <DeviceHardwareSampleCode
                    device={device}
                    pendingApiKey={regen.newKey}
                    variant="panel"
                    onPrepareCode={openDeviceAdvanced}
                  />
                </div>
              ) : (
                <p className="mb-4 rounded border border-studio-border/40 bg-[#1a1f24]/80 px-2.5 py-2 text-[10px] leading-snug text-slate-500">
                  No built-in sample for this type — use the{' '}
                  <Link to="/" className="text-studio-accent hover:underline">
                    IDE
                  </Link>{' '}
                  or your own firmware with the same POST shape.
                </p>
              )
            ) : (
              <>
                <section className="mb-5">
                  <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-studio-muted">
                    Live values
                  </h2>
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

                {device && supportsDeviceHardwareSample(sensorType) ? (
                  <div id="kit-device-sample" className="mb-4">
                    <DeviceHardwareSampleCode
                      device={device}
                      pendingApiKey={regen.newKey}
                      variant="panel"
                      onPrepareCode={openDeviceAdvanced}
                    />
                  </div>
                ) : null}

                <section className="mb-5">
                  <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-studio-muted">
                    History
                  </h2>
                  <SensorChart readings={readings} sensorType={sensorType} />
                </section>

                <section className="mb-5">
                  <h2 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-studio-muted">
                    Recent readings
                  </h2>
                  <RecentReadingsTable
                    readings={readings}
                    sensorType={sensorType}
                    deviceLabel={pageTitle}
                  />
                </section>
              </>
            )}

            <details
              className="rounded-lg border border-studio-border/70 bg-[#1a1d22]/80 px-3 py-2"
              data-device-page-advanced={decodedId}
            >
              <summary className="cursor-pointer text-[11px] font-medium text-slate-400">Advanced</summary>
              <div className="mt-3 space-y-3 border-t border-studio-border/50 pt-3 text-[11px] text-studio-muted">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">Sensor ID</div>
                  <div className="mt-0.5 break-all font-mono text-[10px] text-slate-300">{decodedId}</div>
                </div>
                {device ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="!text-[10px] text-amber-200/90"
                    disabled={regen.busy}
                    onClick={() => void regen.run()}
                  >
                    {regen.busy ? 'Working…' : 'Issue new device key'}
                  </Button>
                ) : null}
              </div>
            </details>
          </>
        ) : null}
      </main>
    </div>
  );
}
