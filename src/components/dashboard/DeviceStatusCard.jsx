import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, History, KeyRound, Trash2 } from 'lucide-react';
import LiveStatCard from './LiveStatCard.jsx';
import DeviceHardwareSampleCode from './DeviceHardwareSampleCode.jsx';
import { deleteDevice } from '../../api/readingApi.js';
import { getStoredDeviceApiKey } from '../../lib/deviceKeyStorage.js';
import { DEVICE_OFFLINE_AFTER_MS, getDevicePresence } from '../../lib/devicePresence.js';
import { formatSensorValue, getFieldsForSensorType } from '../../lib/sensorDashboardConfig.js';
import { friendlySensorTypeLabel } from '../../lib/sensorAddPresets.js';
import { formatExampleReadingJson } from '../../lib/serialBridgeExamples.js';
import { getReadingsPostUrl } from '../../lib/apiConfig.js';
import { useDeviceKeyRegeneration } from '../../hooks/useDeviceKeyRegeneration.js';
import { usePresenceTick } from '../../hooks/usePresenceTick.js';
import { toast } from '../../lib/toast.js';
import Button from '../ui/Button.jsx';

function formatSeen(iso) {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

/**
 * @param {{
 *   device: { deviceId: string, name: string, sensorType: string, status: string, lastSeenAt?: string|null, location?: string },
 *   latest: { data?: object, createdAt?: string, sensorType?: string } | null,
 *   onDeviceDeleted?: () => void,
 *   onAfterRegenerate?: () => void
 * }} props
 */
export default function DeviceStatusCard({ device, latest, onDeviceDeleted, onAfterRegenerate }) {
  usePresenceTick();
  const [deleting, setDeleting] = useState(false);
  const regen = useDeviceKeyRegeneration(device.deviceId, device.name, onAfterRegenerate);
  const fields = getFieldsForSensorType(device.sensorType);
  const data = latest?.data ?? {};
  const hasStoredKey = Boolean(getStoredDeviceApiKey(device.deviceId));

  const presence = getDevicePresence(device, latest);
  const idleHint =
    DEVICE_OFFLINE_AFTER_MS >= 60_000
      ? `${Math.round(DEVICE_OFFLINE_AFTER_MS / 60_000)} min`
      : `${Math.round(DEVICE_OFFLINE_AFTER_MS / 1000)} s`;

  async function handleDelete() {
    if (deleting) return;
    const label = device.name || device.deviceId;
    const ok = window.confirm(
      `Remove “${label}” from your account? History for this sensor will be deleted. You can add a new sensor anytime.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteDevice(device.deviceId);
      toast('success', `Removed “${label}”.`);
      onDeviceDeleted?.();
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not remove sensor.');
    } finally {
      setDeleting(false);
    }
  }

  async function copyEndpoint() {
    try {
      await navigator.clipboard.writeText(getReadingsPostUrl());
      toast('success', 'Cloud address copied.');
    } catch {
      toast('error', 'Could not copy.');
    }
  }

  async function copyJsonExample() {
    const s = formatExampleReadingJson(device.sensorType, device.deviceId);
    if (!s.trim()) {
      toast('error', 'No sample for this type.');
      return;
    }
    try {
      await navigator.clipboard.writeText(s);
      toast('success', 'Sample JSON copied.');
    } catch {
      toast('error', 'Could not copy.');
    }
  }

  const lastSeenDisplay = presence.lastActivityIso ?? device.lastSeenAt;
  const logsLink = `/devices?tab=logs&logDevice=${encodeURIComponent(device.deviceId)}`;

  function focusCardAdvanced() {
    const el = document.querySelector(`details[data-device-advanced="${device.deviceId}"]`);
    if (el) {
      el.open = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  return (
    <div className="rounded-xl border border-studio-border bg-[#1e2228] p-4 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-studio-muted" aria-hidden />
            <Link
              to={`/devices/${encodeURIComponent(device.deviceId)}`}
              className="text-base font-semibold text-studio-accent hover:text-studio-accentHover"
            >
              {device.name}
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {friendlySensorTypeLabel(device.sensorType)}
            {device.location ? (
              <>
                {' '}
                · <span className="text-slate-500">{device.location}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
              presence.isOnline
                ? 'bg-emerald-900/50 text-emerald-300'
                : 'bg-slate-700/60 text-studio-muted'
            }`}
            title={
              presence.isOnline
                ? `Seen within the last ${idleHint}`
                : `No reading for ${idleHint} — offline`
            }
          >
            {presence.isOnline ? 'Online' : 'Offline'}
          </span>
          <div className="mt-1 text-[10px] text-studio-muted">Last seen {formatSeen(lastSeenDisplay)}</div>
        </div>
      </div>

      {regen.newKey ? (
        <div className="mt-3 rounded border border-amber-900/45 bg-amber-950/25 px-2.5 py-2 text-[11px] text-amber-100">
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

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <LiveStatCard
            key={f.key}
            label={f.label}
            value={formatSensorValue(device.sensorType, data, f.key)}
            sub={latest?.createdAt ? `Updated ${formatSeen(latest.createdAt)}` : undefined}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-studio-border/50 pt-3">
        <Link
          to={`/devices/${encodeURIComponent(device.deviceId)}`}
          className="inline-flex items-center justify-center gap-1 rounded border border-studio-border bg-studio-panel px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-[#2c323a]"
        >
          <Activity className="h-3.5 w-3.5 opacity-70" aria-hidden />
          View live
        </Link>
        <Link
          to={logsLink}
          className="inline-flex items-center justify-center gap-1 rounded border border-studio-border bg-studio-panel px-2.5 py-1 text-[11px] font-medium text-slate-200 hover:bg-[#2c323a]"
        >
          <History className="h-3.5 w-3.5 opacity-70" aria-hidden />
          Logs &amp; history
        </Link>
        <DeviceHardwareSampleCode
          device={device}
          pendingApiKey={regen.newKey}
          variant="inline"
          onPrepareCode={focusCardAdvanced}
        />
      </div>

      <details
        className="mt-3 rounded-lg border border-studio-border/60 bg-[#1a1d22]/80 px-2 py-1"
        data-device-advanced={device.deviceId}
      >
        <summary className="cursor-pointer select-none px-1 py-2 text-[11px] font-medium text-slate-400 hover:text-slate-300">
          Advanced · IDs, keys &amp; tools
        </summary>
        <div className="space-y-3 border-t border-studio-border/50 px-1 pb-3 pt-3 text-[11px] text-studio-muted">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Sensor ID</div>
            <div className="mt-0.5 break-all font-mono text-[10px] text-slate-300">{device.deviceId}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500">Device key in this browser</div>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {hasStoredKey ? (
                <span className="text-emerald-200/90">Saved — you can copy full sample code above and in Advanced.</span>
              ) : (
                <span>Not saved here — use Setup to paste the key, or create a new key and tap Save for IDE &amp; samples.</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="default" className="!text-[10px]" onClick={() => void copyEndpoint()}>
              Copy cloud address
            </Button>
            <Button type="button" variant="ghost" className="!text-[10px]" onClick={() => void copyJsonExample()}>
              Copy sample JSON
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-studio-border/40 pt-2">
            <Button
              type="button"
              variant="ghost"
              className="!gap-1 !text-[10px] text-amber-200/90"
              disabled={regen.busy}
              onClick={() => void regen.run()}
            >
              <KeyRound className="h-3 w-3" aria-hidden />
              {regen.busy ? 'Working…' : 'New device key'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!text-[10px] text-red-300/90"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="mr-1 inline h-3 w-3" aria-hidden />
              {deleting ? 'Removing…' : 'Remove sensor'}
            </Button>
          </div>
          <DeviceHardwareSampleCode
            device={device}
            pendingApiKey={regen.newKey}
            variant="panel"
            onPrepareCode={focusCardAdvanced}
          />
        </div>
      </details>
    </div>
  );
}
