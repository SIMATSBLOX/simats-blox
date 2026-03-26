/**
 * Map MicroPython upload / rerun onStep() labels → UI progress (0–100) and short phase title.
 * Upload phases are user-facing strings shown in Esp32MpyProgressModal (keep stable to limit flicker).
 * @param {string} label
 * @param {'upload' | 'rerun'} kind
 */
export function mapMpyStepToProgress(label, kind) {
  const l = String(label);
  if (kind === 'upload') {
    if (/stopping any running code/i.test(l)) return { percent: 8, phase: 'Preparing upload' };
    if (/Entering raw REPL/i.test(l)) return { percent: 22, phase: 'Entering upload mode' };
    if (/Writing main\.py to flash/i.test(l)) return { percent: 42, phase: 'Writing main.py' };
    if (/Write confirmed \(device reported size\)/i.test(l)) return { percent: 52, phase: 'Write done' };
    // Same friendly label for both — avoids flashing two different “verify” titles back-to-back.
    if (/Switching to friendly REPL/i.test(l)) return { percent: 58, phase: 'Verifying file' };
    if (/Verifying main\.py (size on flash|matches preview on flash)/i.test(l)) return { percent: 74, phase: 'Verifying file' };
    if (/Starting main\.py \(exec from flash/i.test(l)) return { percent: 88, phase: 'Starting program' };
    if (/^Done\.\s*Output/i.test(l)) return { percent: 98, phase: 'Done' };
    return { percent: 50, phase: l };
  }
  /* rerun */
  if (/Interrupt — stopping/i.test(l)) return { percent: 20, phase: 'Stopping running code' };
  if (/Returning to friendly REPL/i.test(l)) return { percent: 45, phase: 'Returning to friendly REPL' };
  if (/Running main\.py from flash/i.test(l)) return { percent: 75, phase: 'Running main.py' };
  if (/Done — board output follows/i.test(l)) return { percent: 100, phase: 'Finishing' };
  return { percent: 50, phase: l };
}
