import Button from '../ui/Button.jsx';
import { formatDraftAgeLabel } from '../../lib/sessionRecoveryStore.js';

/**
 * @param {{
 *   open: boolean,
 *   draft: { projectName?: string, savedAt?: string, description?: string } | null,
 *   onRestore: () => void,
 *   onDiscard: () => void,
 * }} props
 */
export default function SessionRecoveryModal({ open, draft, onRestore, onDiscard }) {
  if (!open || !draft) return null;

  const title = String(draft.projectName ?? 'Untitled').trim() || 'Untitled';
  const age = formatDraftAgeLabel(draft.savedAt);
  const desc = String(draft.description ?? '').trim();

  return (
    <div
      className="fixed inset-0 z-[210] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-recovery-title"
    >
      <div className="w-full max-w-md rounded-lg border border-studio-border bg-[#2a2f36] shadow-xl">
        <div className="border-b border-studio-border px-4 py-3">
          <h2 id="session-recovery-title" className="text-sm font-semibold text-slate-100">
            Restore last unsaved session?
          </h2>
          <p className="mt-1.5 text-[11px] leading-relaxed text-studio-muted">
            We found an automatic backup from this browser{age ? ` (${age})` : ''}. This is not your named Save list — only
            a safety copy from your last visit. Restoring will replace the current canvas and toolbar title/notes and will
            unlink the current Save slot until you save again.
          </p>
        </div>
        <div className="space-y-2 px-4 py-3">
          <p className="text-[11px] text-slate-300">
            <span className="text-studio-muted">Title:</span>{' '}
            <span className="font-medium text-slate-200">{title}</span>
          </p>
          {desc ? (
            <p className="line-clamp-2 text-[10px] leading-snug text-slate-500">{desc}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-studio-border px-4 py-3">
          <Button variant="ghost" className="!text-xs" type="button" onClick={onDiscard}>
            Discard backup
          </Button>
          <Button variant="primary" className="!text-xs" type="button" onClick={onRestore}>
            Restore session
          </Button>
        </div>
      </div>
    </div>
  );
}
