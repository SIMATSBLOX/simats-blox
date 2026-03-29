import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  forgetDeviceApiKey,
  getStoredDeviceApiKey,
  listDeviceIdsWithStoredKeys,
  rememberDeviceApiKey,
} from '../../lib/deviceKeyStorage.js';
import { postDeviceReading } from '../../api/readingApi.js';
import { getReadingsPostUrl } from '../../lib/apiConfig.js';
import {
  ARDUINO_DHT11_PRINT_BLOCK,
  SAMPLE_SERIAL_LINE_DHT11,
  exampleReadingBodyForSensor,
  formatExampleReadingJson,
} from '../../lib/serialBridgeExamples.js';
import { toast } from '../../lib/toast.js';
import Button from '../ui/Button.jsx';

/**
 * Optional: IDE serial forwarding — paste a key if this browser doesn’t have it (e.g. another computer).
 * @param {{ devices: object[] }} props
 */
export default function SerialBridgeKeyCard({ devices }) {
  const [deviceId, setDeviceId] = useState('');
  const [apiKeyDraft, setApiKeyDraft] = useState('');
  const [msg, setMsg] = useState(/** @type {{ kind: 'ok' | 'err'; text: string } | null} */ (null));
  const [keyEpoch, setKeyEpoch] = useState(0);
  const [testBusy, setTestBusy] = useState(false);

  useEffect(() => {
    const fn = () => setKeyEpoch((n) => n + 1);
    window.addEventListener('simats-device-keys-changed', fn);
    return () => window.removeEventListener('simats-device-keys-changed', fn);
  }, []);

  const savedIds = useMemo(() => {
    void keyEpoch;
    return listDeviceIdsWithStoredKeys();
  }, [devices, keyEpoch]);

  const savedRows = useMemo(() => {
    const byId = new Map(devices.map((d) => [d.deviceId, d]));
    return savedIds
      .map((id) => {
        const d = byId.get(id);
        return { deviceId: id, name: d?.name ?? id };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, savedIds]);

  const targetForExamples = useMemo(() => {
    const id = deviceId.trim() || savedRows[0]?.deviceId;
    if (!id) return null;
    const dev = devices.find((d) => d.deviceId === id);
    return dev ? { deviceId: id, sensorType: dev.sensorType } : null;
  }, [deviceId, devices, savedRows]);

  async function copyText(toastLabel, text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('success', toastLabel);
    } catch {
      toast('error', 'Could not copy — try selecting the text manually.');
    }
  }

  function copyReadingsUrl() {
    void copyText('Cloud address copied.', getReadingsPostUrl());
  }

  function copyJsonExample() {
    const t = targetForExamples;
    if (!t) {
      toast('error', 'Choose a sensor above first.');
      return;
    }
    const s = formatExampleReadingJson(t.sensorType, t.deviceId);
    if (!s.trim()) {
      toast('error', 'No sample for this sensor type.');
      return;
    }
    void copyText('Sample JSON copied.', s);
  }

  function resolveTargetDeviceId() {
    const fromForm = deviceId.trim();
    if (fromForm && getStoredDeviceApiKey(fromForm)) return fromForm;
    return savedRows[0]?.deviceId ?? '';
  }

  async function sendExampleReading() {
    setMsg(null);
    const id = resolveTargetDeviceId();
    if (!id) {
      setMsg({ kind: 'err', text: 'Save a device key below first, or use + Add sensor on your main computer.' });
      return;
    }
    const key = getStoredDeviceApiKey(id);
    const dev = devices.find((d) => d.deviceId === id);
    if (!key || !dev) {
      setMsg({ kind: 'err', text: 'Pick your sensor and paste its device key.' });
      return;
    }
    const body = exampleReadingBodyForSensor(dev.sensorType, id);
    if (!body) {
      setMsg({ kind: 'err', text: 'This sensor type has no classroom sample yet.' });
      return;
    }
    setTestBusy(true);
    try {
      await postDeviceReading(key, body);
      toast('success', 'Test reading sent — check My sensors.');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not send.');
    } finally {
      setTestBusy(false);
    }
  }

  function saveManual(e) {
    e.preventDefault();
    setMsg(null);
    const id = deviceId.trim();
    const key = apiKeyDraft.trim();
    if (!id || !key) {
      setMsg({ kind: 'err', text: 'Choose a sensor and paste its device key.' });
      return;
    }
    const known = devices.some((d) => d.deviceId === id);
    if (!known) {
      setMsg({ kind: 'err', text: 'Add the sensor on this account first (header: + Add sensor).' });
      return;
    }
    rememberDeviceApiKey(id, key);
    setApiKeyDraft('');
    setMsg({
      kind: 'ok',
      text: 'Saved. In the IDE, open Serial Monitor and turn on “Send lines to Devices”.',
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-studio-border bg-[#1e2228] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-200">Connect sensor readings from the IDE</h2>
        <p className="mt-2 max-w-xl text-[11px] leading-snug text-studio-muted">
          <span className="text-slate-400">+ Add sensor</span> already saves the device key here automatically. Use this
          section only on another laptop/tablet, or if you cleared browser data — paste the key so the{' '}
          <Link to="/" className="text-studio-accent hover:text-studio-accentHover">
            IDE
          </Link>{' '}
          can forward Serial Monitor lines to your dashboard.
        </p>

        {msg ? (
          <div
            className={`mt-3 rounded border px-2.5 py-2 text-[11px] ${
              msg.kind === 'ok'
                ? 'border-emerald-900/40 bg-emerald-950/20 text-emerald-100'
                : 'border-red-900/40 bg-red-950/25 text-red-200'
            }`}
          >
            {msg.text}
          </div>
        ) : null}

        <form onSubmit={saveManual} className="mt-4 grid gap-3">
          <label className="block text-[11px] text-studio-muted">
            Sensor
            <select
              value={deviceId}
              onChange={(e) => setDeviceId(e.target.value)}
              className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 text-xs text-slate-200"
            >
              <option value="">Select…</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.name}
                  {getStoredDeviceApiKey(d.deviceId) ? ' · key saved' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[11px] text-studio-muted">
            Paste device key
            <input
              type="password"
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              autoComplete="off"
              placeholder="From email / handout / regenerate"
              className="mt-0.5 w-full rounded border border-studio-border bg-[#14171b] px-2 py-1.5 font-mono text-xs text-slate-200"
            />
          </label>
          <div>
            <Button type="submit" variant="default" className="text-xs">
              Save here
            </Button>
          </div>
        </form>

        {savedRows.length ? (
          <ul className="mt-4 space-y-2 border-t border-studio-border/60 pt-4">
            {savedRows.map((row) => (
              <li
                key={row.deviceId}
                className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300"
              >
                <span className="font-medium text-slate-200">{row.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  className="!px-2 !py-0.5 !text-[10px] text-red-300/90 hover:bg-red-950/35"
                  onClick={() => {
                    forgetDeviceApiKey(row.deviceId);
                    setMsg({ kind: 'ok', text: 'Removed saved key for this browser.' });
                  }}
                >
                  Remove saved key
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 border-t border-studio-border/60 pt-4 text-[11px] text-studio-muted">
            No keys stored here yet — add a sensor or paste a key above.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-studio-border/80 bg-[#1a1d22] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-slate-200">Quick classroom checks</h2>
        <p className="mt-2 text-[11px] text-studio-muted">
          Try a fake reading (DHT-style) or copy tiny snippets — optional.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="primary"
            className="!text-[11px]"
            disabled={testBusy || savedRows.length === 0}
            title={savedRows.length === 0 ? 'Save a key first' : 'Sends one test reading'}
            onClick={() => void sendExampleReading()}
          >
            {testBusy ? 'Sending…' : 'Send test reading'}
          </Button>
        </div>

        <details className="mt-4 rounded border border-studio-border/50 bg-[#14171b]/40 px-3 py-2">
          <summary className="cursor-pointer text-[11px] font-medium text-slate-400">Developer / lesson extras</summary>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-studio-border/40 pt-3">
            <Button type="button" variant="ghost" className="!text-[10px]" onClick={() => copyReadingsUrl()}>
              Copy cloud address
            </Button>
            <Button type="button" variant="ghost" className="!text-[10px]" onClick={() => copyJsonExample()}>
              Copy sample JSON
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!text-[10px]"
              onClick={() => void copyText('DHT print snippet copied.', ARDUINO_DHT11_PRINT_BLOCK)}
            >
              Copy DHT Serial.print snippet
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!text-[10px]"
              onClick={() => void copyText('Example line copied.', SAMPLE_SERIAL_LINE_DHT11)}
            >
              Copy example serial line
            </Button>
          </div>
        </details>
      </div>
    </div>
  );
}
