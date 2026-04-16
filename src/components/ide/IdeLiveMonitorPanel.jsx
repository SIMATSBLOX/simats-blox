import { Link } from 'react-router-dom';
import { ExternalLink, X } from 'lucide-react';
import { useIdeDeviceMonitor } from '../../hooks/useIdeDeviceMonitor.js';
import { usePresenceTick } from '../../hooks/usePresenceTick.js';
import { getDevicePresence } from '../../lib/devicePresence.js';
import { getDashboardFieldDefs, formatSensorValue } from '../../lib/sensorDashboardConfig.js';
import {
  friendlySensorTypeLabel,
  sensorPrimaryLabel,
  sensorSecondaryLabel,
  shortSensorDeviceIdForLabel,
} from '../../lib/sensorAddPresets.js';

function formatSeen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

/**
 * Minimal IDE-only live readout. No history, no registration UI.
 *
 * @param {{ deviceId: string; sensorTypeHint?: string; onClose: () => void; className?: string }} props
 */
export default function IdeLiveMonitorPanel({ deviceId, sensorTypeHint = '', onClose, className = '' }) {
  usePresenceTick(12_000);
  const { device, latest, sensorType, loading, error } = useIdeDeviceMonitor(deviceId, sensorTypeHint);

  const presence = getDevicePresence(device ?? {}, latest, Date.now());
  const primaryTitle = device
    ? sensorPrimaryLabel(device)
    : sensorTypeHint || sensorType
      ? friendlySensorTypeLabel(sensorTypeHint || sensorType)
      : deviceId || 'Sensor';
  const secondaryTitle = device
    ? sensorSecondaryLabel(device)
    : shortSensorDeviceIdForLabel(deviceId);
  const fields = getDashboardFieldDefs(sensorType, latest ? [{ data: latest.data }] : []);
  const data = latest?.data && typeof latest.data === 'object' ? latest.data : {};

  return (
    <aside
      className={`flex flex-col bg-[#12151a]/80 ${className}`}
      aria-label="Live sensor monitor"
    >
      <div className="flex shrink-0 items-start justify-between gap-2 border-b border-studio-border/60 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold text-slate-100" title={primaryTitle}>
            {primaryTitle}
          </div>
          <div className="truncate font-mono text-[10px] text-studio-muted" title={secondaryTitle}>
            {secondaryTitle}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded p-1 text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200"
          title="Close live monitor"
          aria-label="Close live monitor"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-2.5 py-2 text-[10px]">
        {loading ? <p className="text-studio-muted">Loading…</p> : null}
        {error ? <p className="text-red-300/90">{error}</p> : null}

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className={presence.isOnline ? 'font-medium text-emerald-400' : 'text-slate-500'}>
            {presence.isOnline ? 'Online' : 'Offline'}
          </span>
          <span className="text-studio-muted">
            Last seen {formatSeen(presence.lastActivityIso)}
          </span>
        </div>

        <div>
          <div className="mb-1 text-[9px] font-medium uppercase tracking-wide text-slate-500">
            Latest values
          </div>
          {fields.length ? (
            <ul className="space-y-1">
              {fields.map((f) => (
                <li key={f.key} className="flex justify-between gap-2 border-b border-white/5 pb-1 last:border-0">
                  <span className="text-studio-muted">{f.label}</span>
                  <span className="shrink-0 font-mono text-slate-200">
                    {formatSensorValue(sensorType, data, f.key)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-studio-muted">{latest ? 'No mapped fields for this type.' : 'Waiting for data…'}</p>
          )}
        </div>

        <Link
          to={`/devices/${encodeURIComponent(deviceId)}`}
          className="mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-studio-accent/45 bg-studio-accent/12 py-1.5 text-[10px] font-medium text-studio-accent hover:border-studio-accent/60 hover:bg-studio-accent/18"
        >
          <ExternalLink className="h-3 w-3 shrink-0 opacity-90" aria-hidden />
          Open in full page
        </Link>
      </div>
    </aside>
  );
}
