import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import { connectSensorSocket, getSensorSocket } from '../api/socketClient.js';
import AddSensorModal, { AddSensorTrigger } from '../components/dashboard/AddSensorModal.jsx';
import AggregatedReadingsLogTable from '../components/dashboard/AggregatedReadingsLogTable.jsx';
import DeviceStatusCard from '../components/dashboard/DeviceStatusCard.jsx';
import RegisterDeviceForm from '../components/dashboard/RegisterDeviceForm.jsx';
import SerialBridgeKeyCard from '../components/dashboard/SerialBridgeKeyCard.jsx';
import Button from '../components/ui/Button.jsx';
import { useLiveSensorData } from '../hooks/useLiveSensorData.js';
import { useReadingsLog } from '../hooks/useReadingsLog.js';
import { useDashboardSession } from '../hooks/useDashboardSession.js';
import { buildReadingsLogCsv, downloadCsvFile } from '../lib/readingsLogCsv.js';

const TABS = [
  { id: 'devices', label: 'My sensors' },
  { id: 'logs', label: 'Logs & history' },
  { id: 'setup', label: 'Setup' },
];

export default function DashboardPage() {
  const { displayLogin: login, isAuthenticated } = useDashboardSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState(/** @type {'setup' | 'devices' | 'logs'} */ ('devices'));
  const [logDeviceFilter, setLogDeviceFilter] = useState('');
  const [addSensorOpen, setAddSensorOpen] = useState(false);
  const { devices, latestById, loading, error, refetch } = useLiveSensorData();

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'logs' || t === 'setup' || t === 'devices') {
      setTab(t);
    }
    const ld = searchParams.get('logDevice')?.trim();
    if (ld) setLogDeviceFilter(ld);
  }, [searchParams]);

  useEffect(() => {
    const ld = searchParams.get('logDevice')?.trim();
    if (ld && devices.some((d) => d.deviceId === ld)) {
      setLogDeviceFilter(ld);
    }
  }, [devices, searchParams]);

  useEffect(() => {
    if (!logDeviceFilter) return;
    if (!devices.some((d) => d.deviceId === logDeviceFilter)) {
      setLogDeviceFilter('');
    }
  }, [devices, logDeviceFilter]);

  function goTab(next) {
    setTab(next);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('tab', next);
    if (next !== 'logs') {
      nextParams.delete('logDevice');
      setLogDeviceFilter('');
    }
    setSearchParams(nextParams, { replace: true });
  }

  const logsEnabled = tab === 'logs' && isAuthenticated && devices.length > 0;
  const { readings: logReadings, loading: logLoading, error: logError, refetch: refetchLog } = useReadingsLog(
    logsEnabled,
    logDeviceFilter,
  );

  useEffect(() => {
    if (!logsEnabled) return undefined;
    const ac = new AbortController();
    void (async () => {
      await connectSensorSocket();
      if (ac.signal.aborted) return;
      const s = getSensorSocket();
      if (!s) return;
      const onUpdate = () => {
        void refetchLog();
      };
      s.on('sensor:update', onUpdate);
      ac.signal.addEventListener('abort', () => s.off('sensor:update', onUpdate));
    })();
    return () => ac.abort();
  }, [logsEnabled, refetchLog]);

  function refreshAll() {
    void refetch();
    if (tab === 'logs') void refetchLog();
  }

  function exportLogsCsv() {
    if (!logReadings.length) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const suffix = logDeviceFilter ? logDeviceFilter.replace(/[^\w-]+/g, '_').slice(0, 40) : 'all-devices';
    downloadCsvFile(buildReadingsLogCsv(logReadings), `readings-log-${suffix}-${stamp}.csv`);
  }

  const showError = error ? (
    <div className="rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
      <strong className="font-medium">Could not load sensors.</strong> {error}
      <p className="mt-2 text-xs text-amber-200/80">
        Start the hub (<code className="font-mono text-amber-100">npm run dev:full</code> or{' '}
        <code className="font-mono text-amber-100">npm run server</code>), then sign in under{' '}
        <span className="text-amber-100">Settings</span>.
      </p>
    </div>
  ) : null;

  return (
    <div className="min-h-screen bg-studio-bg text-slate-100">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-studio-border bg-[#22262c]/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">My sensors</h1>
          <p className="text-[11px] text-studio-muted">
            Signed in as <span className="text-slate-400">{login ?? '—'}</span> · Live updates
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" title="Refresh" onClick={() => refreshAll()}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {isAuthenticated ? <AddSensorTrigger onClick={() => setAddSensorOpen(true)} /> : null}
          <Link
            to="/"
            className="rounded border border-studio-border bg-studio-panel px-3 py-1.5 text-sm text-slate-200 hover:bg-[#2c323a]"
          >
            Open IDE
          </Link>
        </div>
      </header>

      <AddSensorModal open={addSensorOpen} onClose={() => setAddSensorOpen(false)} onCreated={() => void refetch()} />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <nav className="mb-6 flex flex-wrap gap-1 border-b border-studio-border/90" aria-label="Sensor workspace">
          {TABS.map(({ id, label }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => goTab(/** @type {'setup' | 'devices' | 'logs'} */ (id))}
                className={[
                  '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'border-studio-accent text-studio-accent'
                    : 'border-transparent text-studio-muted hover:text-slate-300',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {tab === 'setup' ? (
          <div className="space-y-5">
            <p className="text-sm text-studio-muted">
              Optional tools: connect the Blockly IDE’s serial forwarding, or register a sensor with your own ID (for
              workshops).
            </p>
            <SerialBridgeKeyCard devices={devices} />
            <RegisterDeviceForm onRegistered={() => void refetch()} />
            {showError}
            {loading && !devices.length ? <p className="text-sm text-studio-muted">Loading…</p> : null}
            {!loading && !error && devices.length === 0 ? (
              <div className="rounded-lg border border-studio-border bg-studio-panel px-4 py-5 text-sm text-studio-muted">
                No sensors yet. Use <span className="text-slate-400">+ Add sensor</span> in the header.
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'devices' ? (
          <div className="space-y-5">
            {showError}
            {loading && !devices.length ? <p className="text-sm text-studio-muted">Loading your sensors…</p> : null}
            {!loading && !error && devices.length === 0 ? (
              <div className="rounded-xl border border-dashed border-studio-border/80 bg-studio-panel/50 px-6 py-10 text-center">
                <p className="text-sm font-medium text-slate-200">No sensors yet</p>
                <p className="mt-2 text-sm text-studio-muted">
                  Add one to get ready-made ESP32 code and a live dashboard.
                </p>
                {isAuthenticated ? (
                  <div className="mt-6 flex justify-center">
                    <AddSensorTrigger onClick={() => setAddSensorOpen(true)} />
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-studio-muted">Sign in to add sensors.</p>
                )}
              </div>
            ) : null}
            {devices.length > 0 ? (
              <section>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold tracking-tight text-slate-200">Your sensors</h2>
                  {isAuthenticated ? <AddSensorTrigger onClick={() => setAddSensorOpen(true)} /> : null}
                </div>
                <div className="grid gap-4">
                  {devices.map((d) => (
                    <DeviceStatusCard
                      key={d.deviceId}
                      device={d}
                      latest={latestById[d.deviceId] ?? null}
                      onDeviceDeleted={() => void refetch()}
                      onAfterRegenerate={() => void refetch()}
                    />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === 'logs' ? (
          <div className="space-y-4">
            <p className="text-sm text-studio-muted">
              Recent readings (newest first). Open a sensor for charts, or filter below.
            </p>
            {devices.length > 0 ? (
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex max-w-md min-w-[200px] flex-1 flex-col gap-1 text-sm">
                  <span className="text-studio-muted">Sensor</span>
                  <select
                    value={logDeviceFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      setLogDeviceFilter(v);
                      const next = new URLSearchParams(searchParams);
                      next.set('tab', 'logs');
                      if (v) next.set('logDevice', v);
                      else next.delete('logDevice');
                      setSearchParams(next, { replace: true });
                    }}
                    className="rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-slate-200"
                  >
                    <option value="">All sensors</option>
                    {devices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  className="shrink-0 border border-studio-border bg-studio-panel"
                  title="Download rows you see in the table"
                  disabled={logLoading || logReadings.length === 0}
                  onClick={exportLogsCsv}
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </Button>
              </div>
            ) : (
              <p className="text-sm text-studio-muted">Add a sensor, then history will appear here.</p>
            )}

            {logError ? (
              <div className="rounded-lg border border-red-900/40 bg-red-950/25 px-3 py-2 text-sm text-red-200">
                {logError}
              </div>
            ) : null}
            {logLoading ? <p className="text-sm text-studio-muted">Loading…</p> : null}
            {!logLoading && devices.length > 0 ? <AggregatedReadingsLogTable readings={logReadings} /> : null}
          </div>
        ) : null}
      </main>
    </div>
  );
}
