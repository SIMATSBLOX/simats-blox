import { useToastStore } from '../../store/toastStore.js';
import { X } from 'lucide-react';

const styles = {
  success: 'border-emerald-600/45 bg-emerald-950/92 text-emerald-50',
  info: 'border-studio-border bg-[#2a3038]/95 text-slate-100',
  warning: 'border-amber-600/45 bg-amber-950/90 text-amber-50',
  error: 'border-red-600/45 bg-red-950/90 text-red-50',
};

export default function ToastStack() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[260] flex max-w-[min(20rem,calc(100vw-2rem))] flex-col gap-2"
      aria-live="polite"
      aria-relevant="additions text"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-start gap-2 rounded-md border px-3 py-2 text-xs shadow-lg shadow-black/40 ${styles[t.kind] ?? styles.info}`}
        >
          <p className="min-w-0 flex-1 leading-snug">{t.message}</p>
          <button
            type="button"
            className="shrink-0 rounded p-0.5 opacity-70 hover:bg-white/10 hover:opacity-100"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
