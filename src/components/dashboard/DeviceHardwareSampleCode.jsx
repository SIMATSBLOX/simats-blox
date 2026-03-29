import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Code2, Copy } from 'lucide-react';
import { getReadingsPostUrl } from '../../lib/apiConfig.js';
import {
  getEsp32Samples,
  hasUsableDeviceKeyForSamples,
  supportsDeviceHardwareSample,
} from '../../lib/deviceHardwareSamples.js';
import { useStoredDeviceKey } from '../../hooks/useStoredDeviceKey.js';
import { toast } from '../../lib/toast.js';
import Button from '../ui/Button.jsx';

/**
 * Shown when we support this sensor but don’t have a key in-browser yet — no broken sample text.
 * @param {{ variant: 'panel' | 'inline'; successMode: boolean; onPrepareCode?: () => void }} props
 */
function PrepareCodePrompt({ variant, successMode, onPrepareCode }) {
  if (successMode) {
    return (
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 text-[10px] leading-snug text-amber-100">
        <strong className="text-amber-200">Couldn’t load your key in this step.</strong> Close the dialog and add the
        sensor again, or open this sensor from My sensors after saving the key under{' '}
        <Link to="/devices?tab=setup" className="text-studio-accent hover:underline">
          Setup
        </Link>
        .
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div className="flex max-w-[280px] flex-col gap-1.5 rounded border border-amber-900/35 bg-amber-950/15 px-2 py-1.5 sm:max-w-none">
        <span className="text-[10px] font-medium text-amber-200/95">Prepare code</span>
        <span className="text-[9px] leading-snug text-slate-400">
          Save this sensor’s device key in this browser first — then full sample code appears here.
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Link
            to="/devices?tab=setup"
            className="inline-flex rounded border border-amber-800/50 bg-amber-950/30 px-2 py-0.5 text-[9px] font-medium text-amber-100 hover:bg-amber-950/50"
          >
            Open Setup
          </Link>
          {onPrepareCode ? (
            <button
              type="button"
              onClick={onPrepareCode}
              className="rounded border border-studio-border/70 bg-[#25292f] px-2 py-0.5 text-[9px] text-slate-300 hover:bg-[#2c323a]"
            >
              Where to save key
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-lg border border-amber-900/35 bg-amber-950/20 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Code2 className="h-3.5 w-3.5 text-amber-200/80" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-200/90">Prepare code</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-300">
        Ready-to-use firmware is only copied when this browser knows your <strong>device key</strong> (it stays in local
        storage, not on our servers).
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] text-slate-400">
        <li>
          <strong className="text-slate-300">New sensor on another device?</strong> Open{' '}
          <Link to="/devices?tab=setup" className="text-studio-accent hover:underline">
            Setup → Connect sensor readings from the IDE
          </Link>{' '}
          and paste the key once.
        </li>
        <li>
          <strong className="text-slate-300">New key after “Issue new device key”?</strong> Copy it, then tap{' '}
          <strong className="text-slate-300">Save for IDE &amp; samples</strong> in the yellow banner.
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/devices?tab=setup"
          className="inline-flex items-center justify-center rounded border border-studio-accent/60 bg-studio-accent/15 px-2.5 py-1 text-[10px] font-medium text-studio-accent hover:bg-studio-accent/25"
        >
          Go to Setup
        </Link>
        {onPrepareCode ? (
          <Button type="button" variant="ghost" className="!px-2 !py-1 !text-[10px]" onClick={onPrepareCode}>
            Open Advanced on this card
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Copy / preview firmware samples for a device (complete code only — requires a real key).
 * @param {{
 *   device: { deviceId: string; sensorType: string };
 *   pendingApiKey?: string | null;
 *   variant?: 'panel' | 'inline';
 *   successMode?: boolean;
 *   onPrepareCode?: () => void;
 * }} props
 */
export default function DeviceHardwareSampleCode({
  device,
  pendingApiKey,
  variant = 'panel',
  successMode = false,
  onPrepareCode,
}) {
  const [preview, setPreview] = useState(/** @type {'arduino' | 'micropython' | null} */ (null));
  const storedKey = useStoredDeviceKey(device.deviceId);
  const apiKey = (pendingApiKey && String(pendingApiKey).trim()) || storedKey || '';

  const readingsUrl = useMemo(() => getReadingsPostUrl(), []);
  const supported = supportsDeviceHardwareSample(device.sensorType);
  const hasKey = hasUsableDeviceKeyForSamples(apiKey);

  const samples = useMemo(() => {
    if (!supported || !hasKey) return null;
    return getEsp32Samples(device.sensorType, {
      readingsUrl,
      deviceId: device.deviceId,
      apiKey,
    });
  }, [supported, hasKey, readingsUrl, device.deviceId, device.sensorType, apiKey]);

  if (!supported) return null;

  if (!hasKey || !samples) {
    return <PrepareCodePrompt variant={variant} successMode={successMode} onPrepareCode={onPrepareCode} />;
  }

  async function copyText(label, text) {
    try {
      await navigator.clipboard.writeText(text);
      toast('success', label);
    } catch {
      toast('error', 'Could not copy.');
    }
  }

  const hintSuccess = successMode
    ? 'Set your Wi‑Fi name and password in the file, then upload to the ESP32.'
    : null;

  const buttons = (
    <>
      <Button
        type="button"
        variant="default"
        className="!gap-1 !px-2 !py-1 !text-[10px]"
        onClick={() => void copyText('Arduino sample copied.', samples.arduino)}
      >
        <Copy className="h-3 w-3" aria-hidden />
        Copy Arduino
      </Button>
      <Button
        type="button"
        variant="default"
        className="!gap-1 !px-2 !py-1 !text-[10px]"
        onClick={() => void copyText('MicroPython sample copied.', samples.micropython)}
      >
        <Copy className="h-3 w-3" aria-hidden />
        Copy MicroPython
      </Button>
    </>
  );

  if (variant === 'inline') {
    return <div className="flex flex-wrap items-center gap-2">{buttons}</div>;
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-600/40 bg-[#25292f]/90 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Code2 className="h-3.5 w-3.5 text-studio-muted" aria-hidden />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-studio-muted">Sample code</span>
        <span className="text-[10px] text-slate-500">{samples.label}</span>
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
        {hintSuccess ?? (
          <>
            Includes <span className="text-slate-300">Wi‑Fi placeholders</span>,{' '}
            <span className="text-slate-300">cloud URL</span>, <span className="text-slate-300">sensor ID</span>, and{' '}
            <span className="text-slate-300">your device key</span> — ready to paste into the Arduino or MicroPython
            editor.
          </>
        )}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {buttons}
        <Button
          type="button"
          variant="ghost"
          className="!px-2 !py-1 !text-[10px]"
          onClick={() => setPreview((p) => (p === 'arduino' ? null : 'arduino'))}
        >
          {preview === 'arduino' ? 'Hide' : 'Preview'} Arduino
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="!px-2 !py-1 !text-[10px]"
          onClick={() => setPreview((p) => (p === 'micropython' ? null : 'micropython'))}
        >
          {preview === 'micropython' ? 'Hide' : 'Preview'} MicroPython
        </Button>
      </div>
      {preview ? (
        <pre
          className="mt-2 max-h-48 overflow-auto rounded border border-studio-border/60 bg-[#14171b] p-2 font-mono text-[9px] leading-relaxed text-emerald-100/95"
          tabIndex={0}
        >
          {preview === 'arduino' ? samples.arduino : samples.micropython}
        </pre>
      ) : null}
    </div>
  );
}
