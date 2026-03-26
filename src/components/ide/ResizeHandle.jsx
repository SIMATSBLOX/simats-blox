import { useCallback, useEffect, useRef } from 'react';

/**
 * @param {boolean} [invertDelta] — negate dy / keyboard step (also flips absolute row: clamp(h0 ± (clientY - y0))).
 * @param {null | { getHeight: () => number, setHeight: (h: number) => void, clamp: (h: number) => number }} [rowAbsoluteResize]
 *        When set with axis="row", pointer drag uses absolute Y from drag start (with optional invertDelta).
 */
export default function ResizeHandle({
  axis,
  onDrag,
  title = 'Drag to resize — arrow keys when focused',
  emphasize = false,
  invertDelta = false,
  rowAbsoluteResize = null,
}) {
  const dragging = useRef(false);
  const lastRef = useRef(0);
  const pointerIdRef = useRef(/** @type {number | null} */ (null));
  const targetRef = useRef(/** @type {HTMLElement | null} */ (null));
  /** @type {import('react').MutableRefObject<{ y0: number, h0: number } | null>} */
  const rowAbsRef = useRef(null);

  const applyDelta = useCallback(
    (raw) => {
      if (raw === 0) return;
      onDrag(invertDelta ? -raw : raw);
    },
    [invertDelta, onDrag],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging.current) return;
      if (axis === 'row' && rowAbsoluteResize && rowAbsRef.current) {
        const { y0, h0 } = rowAbsRef.current;
        const dy = e.clientY - y0;
        rowAbsoluteResize.setHeight(rowAbsoluteResize.clamp(h0 + (invertDelta ? -dy : dy)));
        return;
      }
      const now = axis === 'col' ? e.clientX : e.clientY;
      const movement = axis === 'col' ? e.movementX : e.movementY;
      const d =
        typeof movement === 'number' && Math.abs(movement) > 0.0001 ? movement : now - lastRef.current;
      lastRef.current = now;
      applyDelta(d);
    },
    [axis, applyDelta, invertDelta, rowAbsoluteResize],
  );

  const endDrag = useCallback(() => {
    dragging.current = false;
    rowAbsRef.current = null;
    const el = targetRef.current;
    const pid = pointerIdRef.current;
    if (el && pid != null) {
      try {
        el.releasePointerCapture(pid);
      } catch {
        /* ignore */
      }
    }
    pointerIdRef.current = null;
    targetRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', endDrag);
    window.removeEventListener('pointercancel', endDrag);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging.current = true;
      lastRef.current = axis === 'col' ? e.clientX : e.clientY;
      if (axis === 'row' && rowAbsoluteResize) {
        rowAbsRef.current = { y0: e.clientY, h0: rowAbsoluteResize.getHeight() };
      } else {
        rowAbsRef.current = null;
      }
      const el = e.currentTarget;
      targetRef.current = el;
      pointerIdRef.current = e.pointerId;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      document.body.style.cursor = axis === 'col' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', endDrag);
      window.addEventListener('pointercancel', endDrag);
    },
    [axis, onPointerMove, endDrag, rowAbsoluteResize],
  );

  useEffect(() => () => endDrag(), [endDrag]);

  return (
    <div
      role="separator"
      aria-orientation={axis === 'col' ? 'vertical' : 'horizontal'}
      aria-label={title}
      title={title}
      tabIndex={0}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 16 : 8;
        if (axis === 'col') {
          if (e.key === 'ArrowLeft') applyDelta(-step);
          if (e.key === 'ArrowRight') applyDelta(step);
        } else {
          if (e.key === 'ArrowUp') applyDelta(-step);
          if (e.key === 'ArrowDown') applyDelta(step);
        }
      }}
      onPointerDown={onPointerDown}
      className={
        axis === 'col'
          ? 'group relative z-10 flex w-3 shrink-0 cursor-col-resize justify-center border-l border-r border-transparent hover:border-studio-accent/50'
          : emphasize
            ? 'group relative z-10 flex min-h-[22px] shrink-0 cursor-row-resize items-center justify-center border-t border-b border-studio-border/60 bg-[#1e2228] hover:border-studio-accent/45 hover:bg-[#252a32]'
            : 'group relative z-10 flex h-3 shrink-0 cursor-row-resize items-center border-t border-b border-transparent hover:border-studio-accent/50'
      }
    >
      {axis === 'col' ? (
        <span className="pointer-events-none absolute inset-y-1 left-1/2 w-0.5 max-w-[3px] -translate-x-1/2 rounded-full bg-studio-border group-hover:bg-studio-accent/60 group-active:bg-studio-accent" />
      ) : emphasize ? (
        <span
          className="pointer-events-none flex flex-col items-center justify-center gap-1 py-0.5"
          aria-hidden
        >
          <span className="h-px w-9 rounded-full bg-slate-500/90 group-hover:bg-studio-accent/70" />
          <span className="h-px w-9 rounded-full bg-slate-500/90 group-hover:bg-studio-accent/70" />
        </span>
      ) : (
        <span className="pointer-events-none absolute inset-x-1 top-1/2 h-0.5 max-h-[3px] -translate-y-1/2 rounded-full bg-studio-border group-hover:bg-studio-accent/60 group-active:bg-studio-accent" />
      )}
    </div>
  );
}
