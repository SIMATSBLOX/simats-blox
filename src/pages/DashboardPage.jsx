import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useLiveSensorData } from '../hooks/useLiveSensorData.js';
import DeviceStatusCard from '../components/dashboard/DeviceStatusCard.jsx';
import RegisterDeviceForm from '../components/dashboard/RegisterDeviceForm.jsx';
import Button from '../components/ui/Button.jsx';
import { useAuthStore } from '../store/authStore.js';

export default function DashboardPage() {
  const login = useAuthStore((s) => s.login);
  const { devices, latestById, loading, error, refetch } = useLiveSensorData();

  return (
    <div className="min-h-screen bg-studio-bg text-slate-100">
      <header className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-studio-border bg-[#22262c]/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Devices &amp; sensors</h1>
          <p className="text-[11px] text-studio-muted">
            Signed in as <span className="text-slate-400">{login ?? '—'}</span> · Live data syncs to this account (MongoDB + Socket.IO)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" title="Refresh" onClick={() => void refetch()}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Link
            to="/"
            className="rounded border border-studio-border bg-studio-panel px-3 py-1.5 text-sm text-slate-200 hover:bg-[#2c323a]"
          >
            Open IDE
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <RegisterDeviceForm onRegistered={() => void refetch()} />

        {error ? (
          <div className="mt-6 rounded-lg border border-amber-900/50 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
            <strong className="font-medium">Could not load devices.</strong> {error}
            <p className="mt-2 text-xs text-amber-200/80">
              Ensure MongoDB is running, set <code className="font-mono text-amber-100">MONGODB_URI</code> for the API
              server, then run <code className="font-mono text-amber-100">npm run dev:full</code>. Device APIs require the
              same local account session as Save → Local API.
            </p>
          </div>
        ) : null}

        {loading && !devices.length ? (
          <p className="mt-6 text-sm text-studio-muted">Loading devices…</p>
        ) : null}

        {!loading && !error && devices.length === 0 ? (
          <div className="mt-6 rounded-lg border border-studio-border bg-studio-panel px-4 py-6 text-sm text-studio-muted">
            No devices yet. Register one above, then POST readings to{' '}
            <code className="rounded bg-black/30 px-1 font-mono text-[11px] text-slate-300">/api/readings</code> with{' '}
            <code className="rounded bg-black/30 px-1 font-mono text-[11px] text-slate-300">x-device-key</code>.
          </div>
        ) : null}

        <div className="mt-6 grid gap-4">
          {devices.map((d) => (
            <DeviceStatusCard key={d.deviceId} device={d} latest={latestById[d.deviceId] ?? null} />
          ))}
        </div>
      </main>
    </div>
  );
}
