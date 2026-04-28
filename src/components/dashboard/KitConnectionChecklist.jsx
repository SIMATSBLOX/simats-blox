import { Link } from 'react-router-dom';
import { Check, Circle, Loader2, Radio } from 'lucide-react';
import { hasUsableDeviceKeyForSamples, supportsDeviceHardwareSample } from '../../lib/deviceHardwareSamples.js';
import { useStoredDeviceKey } from '../../hooks/useStoredDeviceKey.js';

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

  const stepGoDone = hasReading;
  const stepGoCurrent = step2Done && !hasReading;

  /** @param {{ state: 'done' | 'current' | 'upcoming'; busy?: boolean }} props */
  function StepIcon({ state, busy = false }) {
    if (state === 'done') {
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-950/70 text-emerald-400">
          <Check className="h-3.5 w-3.5" aria-hidden />
        </span>
      );
    }
    if (state === 'current') {
      if (busy) {
        return (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-studio-accent/60 bg-studio-accent/10 text-studio-accent">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          </span>
        );
      }
      return (
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-studio-accent/70 bg-studio-accent/10 text-studio-accent"
          aria-hidden
        >
          <span className="h-1.5 w-1.5 rounded-full bg-studio-accent" />
        </span>
      );
    }
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-studio-border/80 bg-[#1e2226] text-studio-muted">
        <Circle className="h-3 w-3" aria-hidden />
      </span>
    );
  }

  const steps = [
    {
      key: 'created',
      title: 'Sensor on your account',
      subtitle: 'You can always return here to check status.',
      state: step1Done ? 'done' : 'upcoming',
    },
    {
      key: 'code',
      title: sampleOk ? 'Device key & sample code' : 'Program the board',
      subtitle: sampleOk
        ? hasKey
          ? 'Copy the MicroPython sample below.'
          : 'Save the key in this browser (banner or Setup) to unlock copies.'
        : 'Use the Blockly IDE or your own firmware for this sensor type.',
      state: step2Done ? 'done' : step2Current ? 'current' : 'upcoming',
    },
    {
      key: 'go',
      title: hasReading ? 'Receiving data' : 'Flash & first reading',
      subtitle: hasReading
        ? presenceOnline
          ? 'Online — values update on this page.'
          : 'Last reading stays visible until the board checks in again.'
        : 'Fill in Wi‑Fi in the sample, upload, power on. This page updates when data arrives.',
      state: stepGoDone ? 'done' : stepGoCurrent ? 'current' : 'upcoming',
    },
  ];

  return (
    <section
      className="mb-4 rounded-lg border border-studio-border/45 bg-[#1a1f24]/90 px-3 py-3"
      aria-label="Kit connection checklist"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next steps</h2>
        {hasReading ? (
          <span className="text-[10px] font-medium text-emerald-400/90">Live</span>
        ) : (
          <span className="text-[10px] text-studio-muted">Setup</span>
        )}
      </div>
      <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
        <span className="text-slate-400">Recommended:</span> Wi‑Fi sample below.{' '}
        <span className="text-slate-400">Alternative:</span>{' '}
        <Link to="/devices?tab=setup" className="text-studio-accent hover:underline">
          Serial bridge
        </Link>{' '}
        from the IDE (USB).
      </p>

      <ol className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.key} className="flex gap-2.5">
            <StepIcon state={s.state} busy={s.state === 'current' && s.key === 'go'} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div
                className={
                  s.state === 'current'
                    ? 'text-[12px] font-medium text-slate-100'
                    : s.state === 'done'
                      ? 'text-[12px] font-medium text-slate-300'
                      : 'text-[12px] font-medium text-slate-500'
                }
              >
                {s.title}
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{s.subtitle}</p>
              {s.key === 'code' && sampleOk && hasKey && onScrollToSample ? (
                <button
                  type="button"
                  onClick={onScrollToSample}
                  className="mt-1.5 rounded border border-studio-border/60 bg-[#25292f] px-2 py-0.5 text-[10px] text-studio-accent hover:bg-[#2c323a]"
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
          className="mt-3 flex gap-2 rounded border border-emerald-900/25 bg-emerald-950/10 px-2 py-2 text-[10px] text-slate-400"
          aria-live="polite"
        >
          <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-hidden />
          <p className="leading-snug">
            <span className="font-medium text-emerald-200/90">No data yet?</span> Check Wi‑Fi in the snippet and that the
            board can reach your network. Or use{' '}
            <Link to="/devices?tab=setup" className="text-studio-accent hover:underline">
              Serial bridge
            </Link>
            .
          </p>
        </div>
      ) : null}
    </section>
  );
}
