import { formatSensorValue, getFieldsForSensorType } from '../../lib/sensorDashboardConfig.js';

function formatTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function formatValuesLine(sensorType, data) {
  const fields = getFieldsForSensorType(sensorType);
  if (!fields.length) {
    try {
      return JSON.stringify(data ?? {});
    } catch {
      return '—';
    }
  }
  return fields.map((f) => `${f.label}: ${formatSensorValue(sensorType, data ?? {}, f.key)}`).join(' · ');
}

/**
 * @param {{ readings: { deviceId: string, deviceName: string, sensorType: string, data: object, createdAt: string }[] }} props
 */
export default function AggregatedReadingsLogTable({ readings }) {
  if (!readings?.length) {
    return (
      <div className="rounded-lg border border-studio-border/60 border-dashed px-4 py-8 text-center text-sm text-studio-muted">
        No stored readings yet. Upload sample code to your board (from a sensor card) or use{' '}
        <span className="text-slate-400">Setup → Quick classroom checks</span> to send a test reading.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-studio-border">
      <table className="w-full min-w-[520px] text-left text-xs">
        <thead>
          <tr className="border-b border-studio-border bg-studio-panel text-[10px] uppercase tracking-wide text-studio-muted">
            <th className="whitespace-nowrap px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Device</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Sensor</th>
            <th className="px-3 py-2 font-medium">Values</th>
          </tr>
        </thead>
        <tbody>
          {readings.map((r, i) => (
            <tr
              key={`${r.createdAt}-${r.deviceId}-${i}`}
              className="border-b border-studio-border/70 last:border-b-0"
            >
              <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-studio-muted">
                {formatTime(r.createdAt)}
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-slate-200">{r.deviceName || r.deviceId}</div>
                <div className="font-mono text-[10px] text-studio-muted">{r.deviceId}</div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-slate-300">{r.sensorType}</td>
              <td className="max-w-[280px] px-3 py-2 text-slate-200 sm:max-w-md">
                <span className="break-words font-mono text-[11px] leading-snug">
                  {formatValuesLine(r.sensorType, r.data)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
