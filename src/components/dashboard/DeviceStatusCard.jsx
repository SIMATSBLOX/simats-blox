import { Link } from 'react-router-dom';
import LiveStatCard from './LiveStatCard.jsx';
import { formatSensorValue, getFieldsForSensorType } from '../../lib/sensorDashboardConfig.js';

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
 *   latest: { data?: object, createdAt?: string, sensorType?: string } | null
 * }} props
 */
export default function DeviceStatusCard({ device, latest }) {
  const fields = getFieldsForSensorType(device.sensorType);
  const data = latest?.data ?? {};

  return (
    <div className="rounded-xl border border-studio-border bg-[#1e2228] p-4 shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to={`/devices/${encodeURIComponent(device.deviceId)}`}
            className="text-base font-semibold text-studio-accent hover:text-studio-accentHover"
          >
            {device.name}
          </Link>
          <div className="mt-0.5 font-mono text-[11px] text-studio-muted">{device.deviceId}</div>
          {device.location ? (
            <div className="mt-1 text-xs text-slate-400">{device.location}</div>
          ) : null}
        </div>
        <div className="text-right">
          <span
            className={`inline-block rounded px-2 py-0.5 text-[11px] font-medium ${
              device.status === 'online'
                ? 'bg-emerald-900/50 text-emerald-300'
                : 'bg-slate-700/60 text-studio-muted'
            }`}
          >
            {device.status === 'online' ? 'Online' : 'Offline'}
          </span>
          <div className="mt-1 text-[10px] text-studio-muted">Last seen: {formatSeen(device.lastSeenAt)}</div>
        </div>
      </div>

      <div className="mt-3 text-[10px] uppercase tracking-wide text-studio-muted">
        Type · <span className="text-slate-300">{device.sensorType}</span>
      </div>

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
    </div>
  );
}
