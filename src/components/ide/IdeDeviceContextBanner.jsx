import { Link } from 'react-router-dom';
import { Check, Loader2, X } from 'lucide-react';
import { friendlySensorTypeLabel } from '../../lib/sensorAddPresets.js';
import { useKitDeviceSetupProgress } from '../../hooks/useKitDeviceSetupProgress.js';
import SensorDataPathsHint from '../ui/SensorDataPathsHint.jsx';

/**
 * Shown when opening the IDE from a sensor device page (`?device=&kit=1`).
 * @param {{
 *   deviceId: string;
 *   deviceName: string;
 *   sensorType: string;
 *   onDismiss: () => void;
 * }} props
 */
export default function IdeDeviceContextBanner({ deviceId, deviceName, sensorType, onDismiss }) {
  const label = (deviceName && deviceName.trim()) || deviceId;
  const typeLine = sensorType ? friendlySensorTypeLabel(sensorType) : null;

  const { hasReading, loading, authRequired, error } = useKitDeviceSetupProgress(deviceId, true);

  return (
    <div
      className="shrink-0 border-b border-studio-border/90 bg-[#252a31]/95 px-3 py-2 text-[11px] text-slate-300 backdrop-blur-sm"
      role="region"
      aria-label="Sensor setup hint"
    >
      <div className="mx-auto flex max-w-[1800px] items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-slate-100">Finish setup in IDE</span>
            {typeLine ? <span className="text-studio-muted">· {typeLine}</span> : null}
          </div>

          <SensorDataPathsHint variant="banner" className="mt-1.5" />

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] leading-tight">
            <span className="inline-flex items-center gap-1 rounded bg-emerald-950/45 px-1.5 py-0.5 font-medium text-emerald-300/95">
              <Check className="h-3 w-3 shrink-0" aria-hidden />
              Sensor linked
            </span>
            <span className="text-studio-muted">→</span>
            {authRequired ? (
              <span className="inline-flex items-center gap-1 rounded bg-amber-950/35 px-1.5 py-0.5 font-medium text-amber-200/95">
                Sign in for status
              </span>
            ) : hasReading ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-950/45 px-1.5 py-0.5 font-medium text-emerald-300/95">
                <Check className="h-3 w-3 shrink-0" aria-hidden />
                Live data started
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-studio-accent/12 px-1.5 py-0.5 font-medium text-studio-accent">
                {loading ? (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
                ) : (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-studio-accent" aria-hidden />
                )}
                Waiting for first reading
              </span>
            )}
          </div>

          <p className="mt-1.5 leading-snug text-slate-400">
            <strong className="text-slate-200">{label}</strong>
            {authRequired ? (
              <>
                {' '}
                — use <strong className="text-slate-300">Settings → Account</strong> to sign in, or open the sensor page to
                verify readings.
              </>
            ) : hasReading ? (
              <>
                {' '}
                is sending data. Open the sensor page for charts and history.
              </>
            ) : (
              <>
                . Flash with <strong className="text-slate-300">Upload</strong>, watch{' '}
                <strong className="text-slate-300">Serial Monitor</strong>, or forward lines from Serial (
                <Link to="/devices?tab=setup" className="text-studio-accent hover:underline">
                  Setup
                </Link>
                ).
              </>
            )}
          </p>

          {error && !authRequired ? (
            <p className="mt-1 text-[10px] text-amber-200/85">Could not refresh status — open the sensor page to confirm.</p>
          ) : null}

          <p className="mt-1.5 text-[10px] text-slate-500">
            <Link to={`/devices/${encodeURIComponent(deviceId)}`} className="text-studio-accent hover:underline">
              ← Sensor details &amp; checklist
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-1 text-studio-muted hover:bg-white/10 hover:text-slate-200"
          aria-label="Dismiss setup hint"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
