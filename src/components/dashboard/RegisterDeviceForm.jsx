import { useState } from 'react';
import { registerDevice } from '../../api/readingApi.js';
import { rememberDeviceApiKey } from '../../lib/deviceKeyStorage.js';
import { SENSOR_ADD_PRESETS } from '../../lib/sensorAddPresets.js';
import Button from '../ui/Button.jsx';

/**
 * Workshop / advanced: register with your own sensor ID (backend still requires a unique id string).
 * @param {{ onRegistered?: () => void }} props
 */
export default function RegisterDeviceForm({ onRegistered }) {
  const [deviceId, setDeviceId] = useState('');
  const [name, setName] = useState('');
  const [sensorType, setSensorType] = useState(SENSOR_ADD_PRESETS[0]?.sensorType ?? 'dht11');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string|null} */ (null));
  const [newKey, setNewKey] = useState(/** @type {string|null} */ (null));

  async function submit(e) {
    e.preventDefault();
    setErr(null);
    setNewKey(null);
    setBusy(true);
    const idForKey = deviceId.trim();
    try {
      const res = await registerDevice({
        deviceId: idForKey,
        name: name.trim(),
        sensorType,
        location: location.trim(),
      });
      const apiKey = typeof res.apiKey === 'string' ? res.apiKey : null;
      setNewKey(apiKey);
      if (apiKey && idForKey) rememberDeviceApiKey(idForKey, apiKey);
      setDeviceId('');
      setName('');
      setLocation('');
      onRegistered?.();
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Could not add sensor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-xl border border-studio-border bg-[#1e2228] sm:p-0">
      <summary className="cursor-pointer list-none px-4 py-4 text-sm font-medium text-slate-200 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="text-studio-accent">▸</span> Manual sensor ID (advanced — workshops)
        <p className="mt-1.5 text-[11px] font-normal text-studio-muted">
          Only if you need a specific ID. Everyone else should use <span className="text-slate-400">+ Add sensor</span>.
        </p>
      </summary>

      <div className="border-t border-studio-border/70 px-4 pb-5 pt-4 sm:px-5">
        {err ? (
          <div className="mb-3 rounded border border-red-900/40 bg-red-950/25 px-2 py-1.5 text-[11px] text-red-200">{err}</div>
        ) : null}

        {newKey ? (
          <div className="mb-3 rounded border border-emerald-900/40 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-100">
            <div className="font-medium text-emerald-200">Device key (copy once)</div>
            <div className="mt-1.5 break-all font-mono text-[10px] text-slate-200">{newKey}</div>
            <p className="mt-2 border-t border-emerald-900/30 pt-2 text-[10px] text-emerald-100/85">
              Saved in this browser for sample code and the IDE serial link.
            </p>
          </div>
        ) : null}

        <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 block text-[11px] text-studio-muted">
            Sensor ID <span className="text-slate-500">(your choice, unique on your account)</span>
            <input
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
              required
              autoComplete="off"
              placeholder="e.g. lab_table_3"
            />
          </label>
          <label className="block text-[11px] text-studio-muted">
            Display name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
              required
              placeholder="Friendly name"
            />
          </label>
          <label className="block text-[11px] text-studio-muted">
            Sensor type
            <select
              value={sensorType}
              onChange={(e) => setSensorType(e.target.value)}
              className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
            >
              {SENSOR_ADD_PRESETS.map((p) => (
                <option key={p.id} value={p.sensorType}>
                  {p.title} — {p.subtitle}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2 block text-[11px] text-studio-muted">
            Location <span className="text-slate-500">(optional)</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
              placeholder="e.g. Windowsill"
            />
          </label>
          <div className="sm:col-span-2 pt-1">
            <Button type="submit" variant="default" className="text-xs" disabled={busy}>
              {busy ? 'Saving…' : 'Add with this ID'}
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}
