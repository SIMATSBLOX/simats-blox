import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getFieldsForSensorType } from '../../lib/sensorDashboardConfig.js';

function formatTick(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/**
 * History line chart — only numeric fields for this sensorType.
 * @param {{ readings: { data?: object, createdAt?: string }[], sensorType: string }} props
 */
export default function SensorChart({ readings, sensorType }) {
  const fields = getFieldsForSensorType(sensorType).filter((f) => f.kind !== 'boolean');
  if (fields.length === 0 || !readings?.length) {
    return (
      <div className="rounded-lg border border-studio-border/60 border-dashed bg-studio-panel/40 px-4 py-8 text-center text-sm text-studio-muted">
        No numeric history to chart for this sensor type.
      </div>
    );
  }

  const chronological = [...readings].reverse();
  const data = chronological.map((r) => {
    const row = { t: formatTick(r.createdAt), createdAt: r.createdAt };
    const d = r.data ?? {};
    for (const f of fields) {
      const v = d[f.key];
      row[f.key] = typeof v === 'number' && Number.isFinite(v) ? v : null;
    }
    return row;
  });

  const colors = ['#34a67a', '#5b8def', '#e0a345', '#c75b9b'];

  return (
    <div className="h-72 w-full rounded-lg border border-studio-border bg-studio-panel/60 p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#353a42" />
          <XAxis dataKey="t" tick={{ fill: '#8b929c', fontSize: 10 }} stroke="#353a42" />
          <YAxis tick={{ fill: '#8b929c', fontSize: 10 }} stroke="#353a42" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#22262c',
              border: '1px solid #353a42',
              borderRadius: 6,
              fontSize: 12,
            }}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.createdAt
                ? new Date(payload[0].payload.createdAt).toLocaleString()
                : ''
            }
          />
          {fields.map((f, i) => (
            <Line
              key={f.key}
              type="monotone"
              dataKey={f.key}
              name={`${f.label}${f.unit ? ` (${f.unit})` : ''}`}
              stroke={colors[i % colors.length]}
              dot={false}
              strokeWidth={2}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
