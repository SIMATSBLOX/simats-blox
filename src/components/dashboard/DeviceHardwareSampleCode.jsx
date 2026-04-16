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
    <div className="rounded-lg border border-amber-900/35 bg-amber-950/15 px-2.5 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <Code2 className="h-3.5 w-3.5 text-amber-200/80" aria-hidden />
        <span className="text-[10px] font-medium text-amber-200/90">Save device key in this browser</span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">
        Paste the key once under{' '}
        <Link to="/devices?tab=setup" className="text-studio-accent hover:underline">
          Setup
        </Link>
        , or use <strong className="text-slate-300">Save for IDE</strong> after a new key. Then copy buttons unlock.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Link
          to="/devices?tab=setup"
          className="inline-flex items-center justify-center rounded border border-studio-accent/50 bg-studio-accent/12 px-2 py-1 text-[10px] font-medium text-studio-accent hover:bg-studio-accent/20"
        >
          Open Setup
        </Link>
        {onPrepareCode ? (
          <Button type="button" variant="ghost" className="!px-2 !py-1 !text-[10px]" onClick={onPrepareCode}>
            Advanced
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
        onClick={() => void copyText('C++ (ESP32) sample copied.', samples.arduino)}
      >
        <Copy className="h-3 w-3" aria-hidden />
        Copy C++ (ESP32)
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
    <div className="rounded-lg border border-studio-border/45 bg-[#22262c]/80 px-2.5 py-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-[10px] font-medium text-slate-400">Sample code</span>
        <span className="text-[10px] text-slate-500">{samples.label}</span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-500">
        {hintSuccess ??
          'Wi‑Fi, cloud URL, ID, and key are in the snippet — paste into the Arduino‑ESP32 core or a MicroPython editor.'}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{buttons}</div>
      <details className="mt-2 rounded border border-studio-border/35 bg-[#1a1d22]/60">
        <summary className="cursor-pointer list-none px-2 py-1.5 text-[10px] text-slate-500 hover:text-slate-400 [&::-webkit-details-marker]:hidden">
          Preview code (optional)
        </summary>
        <div className="border-t border-studio-border/35 px-2 pb-2 pt-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-0.5 !text-[10px]"
              onClick={() => setPreview((p) => (p === 'arduino' ? null : 'arduino'))}
            >
              {preview === 'arduino' ? 'Hide' : 'Show'} C++ (ESP32)
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-0.5 !text-[10px]"
              onClick={() => setPreview((p) => (p === 'micropython' ? null : 'micropython'))}
            >
              {preview === 'micropython' ? 'Hide' : 'Show'} MicroPython
            </Button>
          </div>
          {preview ? (
            <pre
              className="mt-2 max-h-40 overflow-auto rounded border border-studio-border/50 bg-[#14171b] p-2 font-mono text-[9px] leading-relaxed text-emerald-100/95"
              tabIndex={0}
            >
              {preview === 'arduino' ? samples.arduino : samples.micropython}
            </pre>
          ) : null}
        </div>
      </details>
    </div>
  );
}
