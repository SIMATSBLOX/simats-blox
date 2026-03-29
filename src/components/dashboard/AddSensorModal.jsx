import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { registerDevice } from '../../api/readingApi.js';
import { rememberDeviceApiKey } from '../../lib/deviceKeyStorage.js';
import { generateSensorDeviceId, SENSOR_ADD_PRESETS } from '../../lib/sensorAddPresets.js';
import { toast } from '../../lib/toast.js';
import Button from '../ui/Button.jsx';
import DeviceHardwareSampleCode from './DeviceHardwareSampleCode.jsx';

/**
 * Guided Add Sensor: type cards → name/location → success + code copies.
 * @param {{ open: boolean; onClose: () => void; onCreated: () => void }} props
 */
export default function AddSensorModal({ open, onClose, onCreated }) {
  const [step, setStep] = useState(/** @type {'pick' | 'details' | 'success'} */ ('pick'));
  /** @type {{ id: string; title: string; subtitle: string; sensorType: string } | null} */
  const [preset, setPreset] = useState(null);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string|null} */ (null));
  /** @type {{ deviceId: string; name: string; sensorType: string; apiKey: string } | null} */
  const [created, setCreated] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep('pick');
    setPreset(null);
    setName('');
    setLocation('');
    setBusy(false);
    setErr(null);
    setCreated(null);
  }, [open]);

  const createdDevice = useMemo(() => {
    if (!created) return null;
    return { deviceId: created.deviceId, sensorType: created.sensorType, name: created.name };
  }, [created]);

  if (!open) return null;

  async function submitDetails(e) {
    e.preventDefault();
    if (!preset || !name.trim()) return;
    setErr(null);
    setBusy(true);
    const deviceId = generateSensorDeviceId();
    try {
      const res = await registerDevice({
        deviceId,
        name: name.trim(),
        sensorType: preset.sensorType,
        location: location.trim(),
      });
      const apiKey = typeof res.apiKey === 'string' ? res.apiKey : null;
      if (!apiKey) throw new Error('No key returned — try again.');
      rememberDeviceApiKey(deviceId, apiKey);
      setCreated({
        deviceId,
        name: name.trim(),
        sensorType: preset.sensorType,
        apiKey,
      });
      setStep('success');
      onCreated();
      toast('success', `${name.trim()} is ready — copy code below when you’re set up on Wi‑Fi.`);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : 'Could not add sensor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-sensor-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-studio-border bg-[#1e2228] shadow-2xl">
        <div className="flex items-center justify-between border-b border-studio-border/80 px-4 py-3">
          <h2 id="add-sensor-title" className="text-sm font-semibold text-slate-100">
            {step === 'success' ? 'Your sensor is ready' : 'Add sensor'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-studio-muted hover:bg-white/5 hover:text-slate-200"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {step === 'pick' ? (
            <>
              <p className="text-xs text-studio-muted">Pick what you’re connecting. You can add more sensors anytime.</p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {SENSOR_ADD_PRESETS.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPreset(p);
                        setStep('details');
                      }}
                      className="flex w-full flex-col rounded-lg border border-studio-border bg-[#25292f] px-3 py-3 text-left transition-colors hover:border-studio-accent/50 hover:bg-[#2c323a]"
                    >
                      <span className="text-sm font-medium text-slate-100">{p.title}</span>
                      <span className="mt-0.5 text-[11px] text-studio-muted">{p.subtitle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {step === 'details' && preset ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setStep('pick');
                  setPreset(null);
                  setErr(null);
                }}
                className="mb-3 inline-flex items-center gap-1 text-[11px] text-studio-accent hover:text-studio-accentHover"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <p className="text-xs text-slate-300">
                <span className="font-medium text-slate-100">{preset.title}</span>
                <span className="text-studio-muted"> — {preset.subtitle}</span>
              </p>
              <form onSubmit={(e) => void submitDetails(e)} className="mt-4 grid gap-3">
                {err ? (
                  <div className="rounded border border-red-900/40 bg-red-950/25 px-2.5 py-2 text-[11px] text-red-200">
                    {err}
                  </div>
                ) : null}
                <label className="block text-[11px] text-studio-muted">
                  Name <span className="text-slate-500">(shown on your dashboard)</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="e.g. Classroom window"
                    className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-sm text-slate-200"
                  />
                </label>
                <label className="block text-[11px] text-studio-muted">
                  Location <span className="text-slate-500">(optional)</span>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    autoComplete="off"
                    placeholder="e.g. Lab bench A"
                    className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-sm text-slate-200"
                  />
                </label>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" variant="primary" disabled={busy} className="!text-xs">
                    {busy ? 'Creating…' : 'Create sensor'}
                  </Button>
                  <Button type="button" variant="ghost" className="!text-xs" onClick={onClose}>
                    Cancel
                  </Button>
                </div>
              </form>
            </>
          ) : null}

          {step === 'success' && created && createdDevice ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-studio-accent/35 bg-studio-accent/10 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-studio-accent">Next step</p>
                <p className="mt-1.5 text-[13px] font-medium text-slate-100">
                  Open your sensor page for a short checklist (copy code → flash → first reading).
                </p>
                <Link
                  to={`/devices/${encodeURIComponent(created.deviceId)}`}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-studio-accent bg-studio-accent px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-studio-accentHover sm:w-auto"
                >
                  Open sensor page
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </Link>
                <p className="mt-2 text-[11px] leading-snug text-slate-400">
                  Stay on this screen if you want to copy sample code first — then use the button above when you’re ready.
                </p>
              </div>

              <div className="rounded-lg border border-emerald-900/35 bg-emerald-950/20 px-3 py-3 text-[12px] text-emerald-100">
                <p className="font-medium text-emerald-200">{created.name}</p>
                <p className="mt-1 text-[11px] text-emerald-100/90">
                  Sample code below includes Wi‑Fi placeholders, the cloud address, and this sensor’s credentials. Add your
                  network name and password, then flash the ESP32.
                </p>
              </div>

              <DeviceHardwareSampleCode
                device={createdDevice}
                pendingApiKey={created.apiKey}
                variant="panel"
                successMode
              />

              <div className="flex flex-wrap gap-2 border-t border-studio-border/50 pt-3">
                <Button type="button" variant="default" className="!text-xs" onClick={onClose}>
                  Back to My sensors
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Floating / header trigger */
export function AddSensorTrigger({ onClick }) {
  return (
    <Button type="button" variant="primary" className="!gap-1.5 !text-xs sm:!text-sm" onClick={onClick}>
      <Plus className="h-4 w-4" aria-hidden />
      Add sensor
    </Button>
  );
}
