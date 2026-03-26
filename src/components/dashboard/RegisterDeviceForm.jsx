import { useState } from 'react';
import { SENSOR_UI_BY_TYPE } from '../../lib/sensorDashboardConfig.js';
import { registerDevice } from '../../api/readingApi.js';
import Button from '../ui/Button.jsx';

const SENSOR_TYPES = Object.keys(SENSOR_UI_BY_TYPE);

export default function RegisterDeviceForm({ onRegistered }) {
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [sensorType, setSensorType] = useState(SENSOR_TYPES[0] ?? 'dht11');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string|null} */ (null));
  const [newKey, setNewKey] = useState(/** @type {string|null} */ (null));

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setNewKey(null);
    setBusy(true);
    try {
      const res = await registerDevice({
        deviceId: deviceId.trim(),
        name: name.trim(),
        sensorType,
        location: location.trim(),
      });
      setNewKey(typeof res.apiKey === 'string' ? res.apiKey : null);
      setDeviceId('');
      setName('');
      setLocation('');
      onRegistered?.();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-studio-border bg-[#1e2228] p-4">
      <h2 className="text-sm font-semibold text-slate-200">Register a device</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-studio-muted">
        Create a row for your ESP32, then POST readings with header <code className="font-mono text-slate-400">x-device-key</code>{' '}
        (shown once below).
      </p>

      {err ? (
        <div className="mt-2 rounded border border-red-900/40 bg-red-950/25 px-2 py-1.5 text-[11px] text-red-200">
          {err}
        </div>
      ) : null}

      {newKey ? (
        <div className="mt-2 rounded border border-emerald-900/40 bg-emerald-950/20 px-2 py-2 text-[11px] text-emerald-100">
          <div className="font-medium text-emerald-200">Copy this API key onto the device (shown once):</div>
          <div className="mt-1 break-all font-mono text-[10px] text-slate-200">{newKey}</div>
        </div>
      ) : null}

      <form onSubmit={(e) => void submit(e)} className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="sm:col-span-2 block text-[11px] text-studio-muted">
          Device ID (unique, e.g. MAC or lab name)
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
            required
            autoComplete="off"
          />
        </label>
        <label className="block text-[11px] text-studio-muted">
          Display name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
            required
          />
        </label>
        <label className="block text-[11px] text-studio-muted">
          Sensor type
          <select
            value={sensorType}
            onChange={(e) => setSensorType(e.target.value)}
            className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
          >
            {SENSOR_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2 block text-[11px] text-studio-muted">
          Location (optional)
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
          />
        </label>
        <div className="sm:col-span-2">
          <Button type="submit" variant="default" className="text-xs" disabled={busy}>
            {busy ? 'Saving…' : 'Add device'}
          </Button>
        </div>
      </form>
    </div>
  );
}
