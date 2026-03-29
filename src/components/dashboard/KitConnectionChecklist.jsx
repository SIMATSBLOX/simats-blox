import { Link } from 'react-router-dom';
import { Check, Circle, Loader2, Radio } from 'lucide-react';
import { hasUsableDeviceKeyForSamples, supportsDeviceHardwareSample } from '../../lib/deviceHardwareSamples.js';
import { useStoredDeviceKey } from '../../hooks/useStoredDeviceKey.js';
import SensorDataPathsHint from '../ui/SensorDataPathsHint.jsx';

/**
 * Beginner-friendly steps from “sensor exists” → first live reading.
 * @param {{
 *   deviceId: string;
 *   sensorType: string;
 *   readingCount: number;
 *   pendingApiKey?: string | null;
 *   presenceOnline: boolean;
 *   onScrollToSample?: () => void;
 * }} props
 */
export default function KitConnectionChecklist({
  deviceId,
  sensorType,
  readingCount,
  pendingApiKey = null,
  presenceOnline,
  onScrollToSample,
}) {
  const storedKey = useStoredDeviceKey(deviceId);
  const apiKey = (pendingApiKey && String(pendingApiKey).trim()) || storedKey || '';
  const hasKey = hasUsableDeviceKeyForSamples(apiKey);
  const sampleOk = supportsDeviceHardwareSample(sensorType);

  const hasReading = readingCount > 0;

  const step1Done = Boolean(deviceId && sensorType);
  const step2Done = sampleOk ? hasKey : true;
  const step2Current = step1Done && sampleOk && !hasKey;

  const step3Done = hasReading;
  const step3Current = step2Done && !hasReading;

  const step4Done = hasReading;
  const step4Current = step2Done && !hasReading;

  const step5Done = hasReading;

  /** @param {{ state: 'done' | 'current' | 'upcoming'; busy?: boolean }} props */
  function StepIcon({ state, busy = false }) {
    if (state === 'done') {
      return (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-950/70 text-emerald-400">
          <Check className="h-4 w-4" aria-hidden />
        </span>
      );
    }
    if (state === 'current') {
      if (busy) {
        return (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-studio-accent/60 bg-studio-accent/10 text-studio-accent">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </span>
        );
      }
      return (
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-studio-accent/70 bg-studio-accent/10 text-studio-accent"
          aria-hidden
        >
          <span className="h-2 w-2 rounded-full bg-studio-accent" />
        </span>
      );
    }
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-studio-border/80 bg-[#1e2226] text-studio-muted">
        <Circle className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }

  const steps = [
    {
      key: 'created',
      title: 'Sensor created',
      subtitle: 'This sensor is on your account.',
      state: step1Done ? 'done' : 'upcoming',
    },
    {
      key: 'code',
      title: sampleOk ? 'Copy device code' : 'Get a program on the board',
      subtitle: sampleOk
        ? hasKey
          ? 'Use sample code below — copy Arduino or MicroPython.'
          : 'Save this browser’s device key (see banner or Setup) to unlock sample code.'
        : 'We don’t have a ready-made sample for this type — use the Blockly IDE or your own sketch.',
      state: step2Done ? 'done' : step2Current ? 'current' : 'upcoming',
    },
    {
      key: 'upload',
      title: 'Upload & run on ESP32',
      subtitle: 'Paste Wi‑Fi details in the file, flash the board, then power it on.',
      state: step3Done ? 'done' : step3Current ? 'current' : 'upcoming',
    },
    {
      key: 'wait',
      title: 'Waiting for first reading',
      subtitle: hasReading
        ? 'Data is reaching SIMATS BLOX.'
        : 'Keep this page open — the chart fills in when the board sends its first update.',
      state: step4Done ? 'done' : step4Current ? 'current' : 'upcoming',
    },
    {
      key: 'live',
      title: 'Live data started',
      subtitle: hasReading
        ? presenceOnline
          ? 'Online — values update live.'
          : 'Offline for now — last reading is shown above when the board checks in again.'
        : 'Appears after the first successful reading.',
      state: step5Done ? 'done' : 'upcoming',
    },
  ];

  return (
    <section
      className="mb-6 rounded-xl border border-slate-600/35 bg-[#1a1f24] px-4 py-4 shadow-sm sm:px-5"
      aria-label="Kit connection checklist"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Kit connection</h2>
        {hasReading ? (
          <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-400/90">Connected</span>
        ) : (
          <span className="text-[10px] font-medium uppercase tracking-wide text-studio-muted">Getting started</span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-400">
        Follow these steps once per sensor — from new board to your first live values.
      </p>

      <SensorDataPathsHint variant="checklist" className="mt-3" />

      <ol className="mt-4 space-y-3">
        {steps.map((s) => (
          <li key={s.key} className="flex gap-3">
            <StepIcon state={s.state} busy={s.state === 'current' && s.key === 'wait'} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div
                className={
                  s.state === 'current'
                    ? 'text-[13px] font-medium text-slate-100'
                    : s.state === 'done'
                      ? 'text-[13px] font-medium text-slate-300'
                      : 'text-[13px] font-medium text-slate-500'
                }
              >
                {s.title}
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{s.subtitle}</p>
              {s.key === 'code' && sampleOk && hasKey && onScrollToSample ? (
                <button
                  type="button"
                  onClick={onScrollToSample}
                  className="mt-2 rounded border border-studio-border/70 bg-[#25292f] px-2 py-1 text-[10px] text-studio-accent hover:bg-[#2c323a]"
                >
                  Jump to sample code
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ol>

      {!hasReading && step2Done ? (
        <div
          className="mt-4 flex gap-2 rounded-lg border border-emerald-900/30 bg-emerald-950/15 px-3 py-2.5 text-[11px] text-slate-300"
          aria-live="polite"
        >
          <Radio className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400/90" aria-hidden />
          <div>
            <div className="font-medium text-emerald-200/95">Still waiting?</div>
            <p className="mt-1 leading-snug text-slate-400">
              Double-check Wi‑Fi in the sample, USB power, and that the board can reach your network. If Wi‑Fi is tricky,
              you can still send readings from the computer via{' '}
              <Link to="/devices?tab=setup" className="text-studio-accent hover:underline">
                Setup → Serial bridge
              </Link>{' '}
              (optional fallback).
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
