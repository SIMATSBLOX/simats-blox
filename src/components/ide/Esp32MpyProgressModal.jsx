import { useEffect } from 'react';
import Button from '../ui/Button.jsx';

/**
 * ESP32 MicroPython multi-step protocol progress (upload or run again) — not board serial output.
 * @param {{
 *   open: boolean,
 *   title: string,
 *   phase: string,
 *   percent: number,
 *   runState: 'running' | 'success' | 'error',
 *   errorMessage?: string,
 *   successMessage?: string,
 *   onClose: () => void,
 *   onRetry?: () => void,
 *   autoCloseSuccessMs?: number,
 * }} props
 */
export default function Esp32MpyProgressModal({
  open,
  title,
  phase,
  percent,
  runState,
  errorMessage = '',
  successMessage = 'Uploaded successfully',
  onClose,
  onRetry,
  autoCloseSuccessMs = 1800,
}) {
  useEffect(() => {
    if (!open || runState !== 'success') return undefined;
    const t = window.setTimeout(() => {
      onClose();
    }, autoCloseSuccessMs);
    return () => window.clearTimeout(t);
  }, [open, runState, onClose, autoCloseSuccessMs]);

  if (!open) return null;

  const pct = runState === 'success' ? 100 : Math.min(100, Math.max(0, Math.round(percent)));
  const showBar = runState === 'running' || runState === 'success';

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/45 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="esp32-mpy-progress-title"
      aria-busy={runState === 'running'}
    >
      <div className="w-full max-w-[22rem] rounded-lg border border-studio-border/90 bg-[#252a31] shadow-2xl shadow-black/40">
        <div className="border-b border-studio-border/80 px-4 py-2.5">
          <h2 id="esp32-mpy-progress-title" className="text-[13px] font-semibold tracking-tight text-slate-100">
            {title}
          </h2>
        </div>
        <div className="space-y-3 px-4 py-3.5">
          {runState === 'error' ? (
            <div className="space-y-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-red-300/90">Upload failed</p>
              <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-red-100/90">
                {errorMessage || 'Something went wrong during upload.'}
              </p>
            </div>
          ) : runState === 'success' ? (
            <div className="space-y-1">
              <p className="text-[13px] font-semibold text-emerald-300/95">{successMessage}</p>
              <p className="text-[10px] leading-snug text-slate-500">
                Serial Monitor below shows live board output. This dialog closes automatically.
              </p>
            </div>
          ) : (
            <div className="min-h-[2.75rem] space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Current step</p>
              <p className="text-[12px] leading-snug text-slate-200">{phase || 'Preparing…'}</p>
            </div>
          )}

          {showBar ? (
            <div className="space-y-1.5 pt-0.5">
              <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-[#1a1e24]"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className={`h-full rounded-full ${
                    runState === 'success' ? 'bg-emerald-500/95' : 'bg-studio-accent/95'
                  }`}
                  style={{
                    width: `${pct}%`,
                    transition: 'width 480ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              </div>
              <p className="text-[10px] tabular-nums text-slate-500">{pct}%</p>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-studio-border/80 px-4 py-2.5">
          {runState === 'error' ? (
            <>
              {typeof onRetry === 'function' ? (
                <Button variant="ghost" className="!px-3 !py-1 !text-xs" type="button" onClick={onRetry}>
                  Retry
                </Button>
              ) : null}
              <Button variant="primary" className="!px-3 !py-1 !text-xs" type="button" onClick={onClose}>
                Close
              </Button>
            </>
          ) : runState === 'success' ? (
            <Button variant="ghost" className="!px-3 !py-1 !text-xs text-slate-400" type="button" onClick={onClose}>
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
