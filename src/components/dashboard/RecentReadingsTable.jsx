import { formatSensorValue, getFieldsForSensorType } from '../../lib/sensorDashboardConfig.js';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

/**
 * @param {{ readings: object[], sensorType: string, deviceLabel?: string }} props
 */
export default function RecentReadingsTable({ readings, sensorType, deviceLabel }) {
  const fields = getFieldsForSensorType(sensorType);
  if (!readings?.length) {
    return (
      <div className="rounded-lg border border-studio-border/60 border-dashed px-4 py-6 text-center text-sm text-studio-muted">
        No readings yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-studio-border">
      <table className="w-full min-w-[320px] text-left text-xs">
        <thead>
          <tr className="border-b border-studio-border bg-studio-panel text-[10px] uppercase tracking-wide text-studio-muted">
            <th className="px-3 py-2 font-medium">Time</th>
            {deviceLabel ? (
              <th className="px-3 py-2 font-medium">Device</th>
            ) : null}
            {fields.map((f) => (
              <th key={f.key} className="px-3 py-2 font-medium">
                {f.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {readings.map((r) => (
            <tr key={r._id ?? `${r.createdAt}-${JSON.stringify(r.data)}`} className="border-b border-studio-border/70">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-studio-muted">
                {formatTime(r.createdAt)}
              </td>
              {deviceLabel ? (
                <td className="px-3 py-2 text-slate-300">{deviceLabel}</td>
              ) : null}
              {fields.map((f) => (
                <td key={f.key} className="px-3 py-2 font-mono text-slate-200">
                  {formatSensorValue(sensorType, r.data ?? {}, f.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
