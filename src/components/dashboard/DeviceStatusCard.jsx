import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, History, KeyRound, Trash2 } from 'lucide-react';
import LiveStatCard from './LiveStatCard.jsx';
import DeviceHardwareSampleCode from './DeviceHardwareSampleCode.jsx';
import { deleteDevice } from '../../api/readingApi.js';
import { getStoredDeviceApiKey } from '../../lib/deviceKeyStorage.js';
import { DEVICE_OFFLINE_AFTER_MS, getDevicePresence } from '../../lib/devicePresence.js';
import { formatSensorValue, getDashboardFieldDefs } from '../../lib/sensorDashboardConfig.js';
import {
  CUSTOM_SENSOR_TYPE,
  formatSensorSelectOptionLabel,
  friendlySensorTypeLabel,
  getSensorPresetByType,
  isPlaceholderSensorDisplayName,
  shortSensorDeviceIdForLabel,
} from '../../lib/sensorAddPresets.js';
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
  const regen = useDeviceKeyRegeneration(device.deviceId, formatSensorSelectOptionLabel(device), onAfterRegenerate);
  const fields = getDashboardFieldDefs(device.sensorType, latest ? [latest] : []);
  const data = latest?.data ?? {};
  const hasStoredKey = Boolean(getStoredDeviceApiKey(device.deviceId));
  const usesRealName = !isPlaceholderSensorDisplayName(device.name);
  const displayTitle = usesRealName ? device.name.trim() : friendlySensorTypeLabel(device.sensorType);
  const preset = getSensorPresetByType(device.sensorType);
  const idShort = shortSensorDeviceIdForLabel(device.deviceId);
  const subtitleParts = usesRealName
    ? [friendlySensorTypeLabel(device.sensorType), idShort, device.location].filter(Boolean)
    : [
        preset?.subtitle ?? (device.sensorType === CUSTOM_SENSOR_TYPE ? 'Your fields in JSON data' : ''),
        idShort,
        device.location,
      ].filter(Boolean);
  const subtitleLine = subtitleParts.join(' · ') || null;

  const presence = getDevicePresence(device, latest);
  const idleHint =
    DEVICE_OFFLINE_AFTER_MS >= 60_000
      ? `${Math.round(DEVICE_OFFLINE_AFTER_MS / 60_000)} min`
      : `${Math.round(DEVICE_OFFLINE_AFTER_MS / 1000)} s`;

  async function handleDelete() {
    if (deleting) return;
    const label = usesRealName ? device.name.trim() : `${displayTitle} (${device.deviceId})`;
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
    <div className="rounded-lg border border-studio-border/80 bg-[#1e2228] p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug text-slate-100">
            <Link
              to={`/devices/${encodeURIComponent(device.deviceId)}`}
              className="text-inherit hover:text-studio-accent hover:underline-offset-2"
            >
              {displayTitle}
            </Link>
          </h3>
          {subtitleLine ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{subtitleLine}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
              presence.isOnline
                ? 'bg-emerald-900/50 text-emerald-300'
                : 'bg-slate-700/60 text-studio-muted'
            }`}
            title={
              presence.isOnline ? `Seen within the last ${idleHint}` : `No reading for ${idleHint} — offline`
            }
          >
            {presence.isOnline ? 'Online' : 'Offline'}
          </span>
          <div className="mt-0.5 text-[10px] text-studio-muted">Last {formatSeen(lastSeenDisplay)}</div>
        </div>
      </div>

      <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
        {fields.map((f) => (
          <LiveStatCard
            key={f.key}
            label={f.label}
            value={formatSensorValue(device.sensorType, data, f.key)}
            sub={latest?.createdAt ? `Updated ${formatSeen(latest.createdAt)}` : undefined}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-studio-border/35 pt-2.5">
        <Link
          to={`/devices/${encodeURIComponent(device.deviceId)}`}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-studio-border bg-studio-panel px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-[#2c323a]"
        >
          <Activity className="h-3.5 w-3.5 opacity-70" aria-hidden />
          View live
        </Link>
        <Link
          to={logsLink}
          className="inline-flex items-center justify-center gap-1 rounded-md border border-studio-border bg-studio-panel px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:bg-[#2c323a]"
        >
          <History className="h-3.5 w-3.5 opacity-70" aria-hidden />
          Logs &amp; history
        </Link>
        <button
          type="button"
          className="inline-flex items-center justify-center gap-1 rounded-md border border-red-900/35 bg-red-950/15 px-2.5 py-1.5 text-[11px] font-medium text-red-300/95 hover:bg-red-950/35 disabled:opacity-40"
          disabled={deleting}
          title="Remove this sensor from your account"
          onClick={() => void handleDelete()}
        >
          <Trash2 className="h-3.5 w-3.5 opacity-80" aria-hidden />
          Remove
        </button>
      </div>

      {regen.newKey ? (
        <div className="mt-3 rounded-md border border-amber-900/40 bg-amber-950/20 px-2.5 py-2 text-[11px] text-amber-100">
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

      <details
        className="mt-3 rounded-md border border-studio-border/35 border-dashed bg-[#1a1d22]/40"
        data-device-advanced={device.deviceId}
      >
        <summary className="cursor-pointer list-none px-2.5 py-2 text-[10px] font-medium text-slate-500 hover:text-slate-400 [&::-webkit-details-marker]:hidden">
          Configuration · IDs, samples &amp; keys
        </summary>
        <div className="space-y-3 border-t border-studio-border/40 px-2.5 pb-3 pt-2.5 text-[11px] text-studio-muted">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-600">Sensor ID</div>
              <div className="mt-0.5 break-all font-mono text-[10px] text-slate-400">{device.deviceId}</div>
            </div>
            <div>
              <div className="text-[9px] uppercase tracking-wide text-slate-600">Key in this browser</div>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                {hasStoredKey ? (
                  <span className="text-emerald-200/85">Saved for IDE &amp; copy buttons below.</span>
                ) : (
                  <span>Paste under Setup, or use &quot;New device key&quot; below.</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" className="!text-[10px]" onClick={() => void copyEndpoint()}>
              Copy cloud address
            </Button>
            <Button type="button" variant="ghost" className="!text-[10px]" onClick={() => void copyJsonExample()}>
              Copy sample JSON
            </Button>
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
