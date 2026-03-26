/**
 * MicroPython over Web Serial: upload main.py (raw REPL + ubinascii), exec run,
 * interrupt, and rerun — keeps USB serial up (no machine.soft_reset in these flows).
 *
 * Flash writes use raw REPL (multi-line + Ctrl-D). Running main.py uses the
 * friendly REPL (one line + Enter): raw REPL exec of a non-terminating script
 * follows the programmatic protocol (host reads until 0x04), so live print output
 * often never appears in a line-based Serial Monitor. Friendly REPL matches
 * normal interactive exec() and streams stdout reliably.
 */

import {
  drainSerialRxFor,
  waitForSerialRx,
  writeSerialText,
  writeSerialUtf8InChunks,
} from './webSerialService.js';

/**
 * Exec main.py as __main__ — CRLF-terminated for friendly REPL (not raw Ctrl-D).
 * compile() surfaces SyntaxError with line numbers if the file on flash is corrupt.
 */
const RUN_MAIN_PY_FRIENDLY =
  "exec(compile(open('main.py').read(),'main.py','exec'),{'__name__':'__main__'})\r\n";

/** MicroPython raw REPL ends execution with ASCII EOT (\\x04). */
const EOT = '\x04';

/** @param {number} ms */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function devMpyLog(phase, detail) {
  if (import.meta.env.DEV) {
    console.debug(`[mpy protocol] ${phase}`, detail ?? '');
  }
}

function devUploadPhase(phase) {
  if (import.meta.env.DEV) {
    console.debug('[mpy upload phase]', phase);
  }
}

/**
 * @param {string} before
 * @returns {boolean}
 */
function rawReplOkPresentBefore(before) {
  if (/\r?\nOK\r?\n/.test(before)) return true;
  if (/^OK\r?\n/m.test(before.trimStart())) return true;
  if (/(^|[\r\n])OK\s*$/m.test(before)) return true;
  if (/\bOK\s+__MPYWROTE__\s+\d+/.test(before)) return true;
  if (/\bOK\b/.test(before)) return true;
  return false;
}

/**
 * Last `__MPYWROTE__ <n>` in buf (raw REPL may echo older lines in rare cases).
 * @param {string} buf
 * @returns {RegExpExecArray | null}
 */
function findLastMpywroteMatch(buf) {
  const re = /__MPYWROTE__\s+(\d+)/g;
  /** @type {RegExpExecArray | null} */
  let last = null;
  /** @type {RegExpExecArray | null} */
  let m;
  while ((m = re.exec(buf)) !== null) last = m;
  return last;
}

/**
 * Evaluate raw main.py write completion (for matcher + dev diagnostics).
 * When the board prints __MPYWROTE__ with the exact preview byte length, treat the write as done.
 * Requiring 0x04 in the JS string caused endless waits: some stacks never surface XOFF/EOT in TextDecoder output.
 * @param {string} buf
 * @param {number} expectedUtf8Bytes
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function evaluateRawMainPyWriteComplete(buf, expectedUtf8Bytes) {
  const last = findLastMpywroteMatch(buf);
  const lastTbGlobal = buf.lastIndexOf('Traceback');
  const got = last ? parseInt(last[1], 10) : NaN;
  const writeOkAfterLastTraceback =
    last &&
    Number.isFinite(got) &&
    got === expectedUtf8Bytes &&
    (lastTbGlobal < 0 || last.index > lastTbGlobal);

  if (buf.includes('Traceback') && !writeOkAfterLastTraceback) {
    const tb = buf.indexOf('Traceback');
    return buf.indexOf(EOT, tb) >= 0
      ? { ok: true }
      : { ok: false, reason: 'Traceback seen but no EOT after it' };
  }

  if (!last) return { ok: false, reason: 'no __MPYWROTE__ in buffer' };
  if (!Number.isFinite(got)) return { ok: false, reason: 'invalid __MPYWROTE__ number' };
  if (got !== expectedUtf8Bytes) {
    return { ok: false, reason: `byteCount mismatch got=${got} expected=${expectedUtf8Bytes}` };
  }

  const afterLine = last.index + last[0].length;
  const lastTb = buf.lastIndexOf('Traceback');
  if (lastTb >= afterLine) {
    const head = buf.slice(lastTb, lastTb + 520);
    if (!/KeyboardInterrupt/i.test(head)) {
      return { ok: false, reason: 'Traceback after __MPYWROTE__ (not benign interrupt)' };
    }
  }

  return { ok: true };
}

function rawMainPyWriteComplete(buf, expectedUtf8Bytes) {
  return evaluateRawMainPyWriteComplete(buf, expectedUtf8Bytes).ok;
}

/**
 * If strict waitForSerialRx timed out but the board already reported the correct byte count on flash,
 * continue upload (USB/REPL quirks sometimes drop 0x04 from the accumulated string).
 * Reject if a real Traceback appears after the __MPYWROTE__ line (unless it is only KeyboardInterrupt).
 * @param {string} buf
 * @param {number} expectedUtf8Bytes
 */
function rawMainPyWriteRecoveryAccepted(buf, expectedUtf8Bytes) {
  return evaluateRawMainPyWriteComplete(buf, expectedUtf8Bytes).ok;
}

/**
 * @param {string} buf
 * @param {number} expectedUtf8Bytes
 * @returns {string}
 */
function formatWriteWaitTimeoutDiag(buf, expectedUtf8Bytes) {
  const ev = evaluateRawMainPyWriteComplete(buf, expectedUtf8Bytes);
  const eotCount = buf.split(EOT).length - 1;
  const last = findLastMpywroteMatch(buf);
  const got = last ? parseInt(last[1], 10) : NaN;
  const afterMarker = last ? last.index + last[0].length : -1;
  const firstEotAfter = last ? buf.indexOf(EOT, afterMarker) : -1;
  const upToFirstEot =
    firstEotAfter >= 0 ? buf.slice(0, firstEotAfter) : buf;
  const okBeforeFirstEot = rawReplOkPresentBefore(upToFirstEot);
  const max = 900;
  const esc = (s) =>
    s.length > max
      ? `${JSON.stringify(s.slice(0, max))}…(+${s.length - max} chars)`
      : JSON.stringify(s);
  return `evaluateOk=${ev.ok} rejectReason=${ev.ok ? 'n/a' : ev.reason} expectedUtf8=${expectedUtf8Bytes} lastMpywrote=${Number.isFinite(got) ? got : 'none'} eotTotal=${eotCount} firstEotAfterMarker=${firstEotAfter >= 0} okBeforeFirstEotOnly=${okBeforeFirstEot} accLen=${buf.length} accSample=${esc(buf)}`;
}

/** Double Ctrl+C + newline — break running script / get to a prompt (best-effort). */
export async function sendMicroPythonInterrupt() {
  devMpyLog('interrupt', 'Ctrl-C x2 + CRLF');
  await writeSerialText('\x03');
  await delay(120);
  await writeSerialText('\x03');
  await delay(120);
  await writeSerialText('\r\n');
  await delay(120);
}

async function enterRawRepl() {
  devMpyLog('enterRawRepl', 'Ctrl-A; wait for banner + raw ">" prompt (single RX wait — avoids missing >)');
  // One waiter: if we used two sequential waitForSerialRx calls, the ">" line can arrive before the
  // second subscription and the upload script would be sent before the REPL accepts paste (0-byte writes).
  const ready = waitForSerialRx(
    (buf) =>
      /raw\s*REPL/i.test(buf) &&
      (/CTRL-B/i.test(buf) || /Ctrl-B/i.test(buf)) &&
      /\r?\n>/.test(buf),
    5000,
  );
  await writeSerialText('\x01');
  try {
    await ready;
    devMpyLog('enterRawRepl', 'banner + > ok');
  } catch (e) {
    devMpyLog('enterRawRepl', `wait failed: ${String(/** @type {Error} */ (e)?.message || e)}`);
    await delay(280);
  }
  await delay(150);
}

/** Ctrl-B: leave raw REPL back to `>>>` — wait for prompt before continuing. */
async function exitRawToFriendlyRepl() {
  devUploadPhase('exit raw REPL (Ctrl-B)');
  devMpyLog('exitRawToFriendlyRepl', 'Ctrl-B then wait for >>>');
  const friendly = waitForSerialRx((buf) => buf.includes('>>>'), 6000);
  await writeSerialText('\x02');
  try {
    await friendly;
    devUploadPhase('friendly REPL ready (>>> prompt)');
    devMpyLog('exitRawToFriendlyRepl', '>>> seen');
  } catch (e) {
    devMpyLog('exitRawToFriendlyRepl', `>>> wait failed: ${String(/** @type {Error} */ (e)?.message || e)}`);
    await delay(500);
  }
  await delay(150);
}

async function execMainPyFromFriendlyRepl() {
  devUploadPhase('exec start (friendly REPL exec line)');
  devMpyLog('execMainPy', 'friendly exec line');
  await writeSerialText(RUN_MAIN_PY_FRIENDLY);
  await delay(220);
  devUploadPhase('exec line sent — main.py should be running');
}

/**
 * UTF-8 source → even-length hex strings (safe in Python '…' literals, no btoa/Latin1 issues).
 * @param {string} sourceCode
 * @param {number} maxHexCharsPerChunk must be even so each chunk unhexlify's cleanly
 */
function sourceToHexChunks(sourceCode, maxHexCharsPerChunk = 512) {
  const u8 = new TextEncoder().encode(sourceCode);
  let hex = '';
  for (let i = 0; i < u8.length; i++) {
    hex += u8[i].toString(16).padStart(2, '0');
  }
  const parts = [];
  for (let i = 0; i < hex.length; i += maxHexCharsPerChunk) {
    parts.push(hex.slice(i, i + maxHexCharsPerChunk));
  }
  return parts;
}

/**
 * Minimal reliable main.py write: explicit open / write loop / close / sync, then size probe.
 * @param {string[]} hexParts
 */
function buildDeviceScript(hexParts) {
  const IND = '    ';
  if (hexParts.length === 0) {
    return [
      "f=open('main.py','wb')",
      'try:',
      `${IND}pass`,
      'finally:',
      `${IND}f.close()`,
      "print('__MPYWROTE__',len(open('main.py','rb').read()))",
      '',
    ].join('\n');
  }
  const tupleInner = hexParts.map((h) => `'${h}'`).join(',');
  return [
    'import ubinascii',
    `_hs=(${tupleInner},)`,
    "f=open('main.py','wb')",
    'try:',
    `${IND}for _x in _hs:`,
    `${IND}${IND}f.write(ubinascii.unhexlify(_x))`,
    'finally:',
    `${IND}f.close()`,
    'try:',
    `${IND}import os`,
    `${IND}os.sync()`,
    'except Exception:',
    `${IND}pass`,
    "print('__MPYWROTE__',len(open('main.py','rb').read()))",
    '',
  ].join('\n');
}

/**
 * Client-side guard so we never upload a sketch that cannot keep the REPL busy.
 * @param {string} src trimmed preview source
 */
function assertRunnableMainPySource(src) {
  if (!/\bsetup\s*\(\s*\)/m.test(src)) {
    throw new Error('Generated main.py is missing setup() — fix blocks or regenerate before upload.');
  }
  if (!/\bloop\s*\(\s*\)/m.test(src)) {
    throw new Error('Generated main.py is missing loop() — fix blocks or regenerate before upload.');
  }
  if (!/while\s+True\s*:/m.test(src)) {
    throw new Error(
      'Generated main.py is missing the required “while True:” runner — the board would return to >>> immediately.',
    );
  }
}

const READBACK_B64_MAX_BYTES = 28_000;

/**
 * @param {string} expected
 * @param {string} actual
 * @returns {{ line: number, previewLine: string, boardLine: string } | null}
 */
function firstMainPyLineMismatch(expected, actual) {
  const eLines = expected.split('\n');
  const aLines = actual.split('\n');
  const n = Math.max(eLines.length, aLines.length);
  for (let i = 0; i < n; i++) {
    const e = eLines[i] ?? '';
    const a = aLines[i] ?? '';
    if (e !== a) {
      return {
        line: i + 1,
        previewLine: e || '(missing in preview)',
        boardLine: a || '(missing on board)',
      };
    }
  }
  return null;
}

const READBACK_START = '__MPYREADB64__';
const READBACK_END = '@@END@@';
const READBACK_FRAME_PREFIX = '__RBFRM__';

function makeReadbackFrameToken() {
  const t = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`.replace(/[^a-zA-Z0-9]/g, '');
  return t.slice(0, 24);
}

/**
 * @param {string} acc
 * @param {string} frameToken
 */
function readbackHaystackAfterFrame(acc, frameToken) {
  const tag = `${READBACK_FRAME_PREFIX}${frameToken}`;
  const pos = acc.lastIndexOf(tag);
  // Do not fall back to full acc — stale RX would let echo/old markers match and false-verify.
  if (pos < 0) return { hay: '', frameFound: false, framePos: -1 };
  return { hay: acc.slice(pos + tag.length), frameFound: true, framePos: pos };
}

/**
 * REPL often echoes the pasted one-liner, which contains literal __MPYREADB64__ and @@END@@ in
 * source form. Using a single lastIndexOf(READBACK_START) decodes junk between those echoes (~20 B).
 * After the frame token, try every READBACK_START…READBACK_END span and keep only a decode whose
 * byte length matches the preview UTF-8 length (real printed output).
 *
 * @param {string} hay — RX after __RBFRM__<token>
 * @param {number} expectedUtf8Len
 */
function tryDecodeReadbackSpansInHay(hay, expectedUtf8Len) {
  /** @type {{ start: number, end: number, decodedLen: number }[]} */
  const tried = [];
  let pos = hay.length;
  while (true) {
    const start = hay.lastIndexOf(READBACK_START, pos);
    if (start < 0) break;
    const end = hay.indexOf(READBACK_END, start + READBACK_START.length);
    if (end > start) {
      const middle = hay.slice(start + READBACK_START.length, end);
      const b64 = middle.replace(/[^A-Za-z0-9+/=]/g, '');
      try {
        const bin = atob(b64.length ? b64 : '');
        tried.push({ start, end, decodedLen: bin.length });
        if (bin.length === expectedUtf8Len) {
          const out = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) {
            out[i] = bin.charCodeAt(i);
          }
          return { bytes: out, start, end, tried };
        }
      } catch {
        tried.push({ start, end, decodedLen: -1 });
      }
    }
    pos = start - 1;
    if (pos < 0) break;
  }
  return { bytes: null, start: -1, end: -1, tried };
}

/**
 * @param {string} acc
 * @param {string} frameToken
 * @param {number} expectedUtf8Len
 * @returns {Uint8Array | null}
 */
function extractFramedReadback(acc, frameToken, expectedUtf8Len) {
  const { hay, frameFound, framePos } = readbackHaystackAfterFrame(acc, frameToken);
  const { bytes, start, end, tried } = tryDecodeReadbackSpansInHay(hay, expectedUtf8Len);
  if (import.meta.env.DEV) {
    console.debug('[mpy verify] frameToken=', frameToken, 'framePos=', framePos, 'frameFound=', frameFound, 'hayLen=', hay.length);
    console.debug('[mpy verify] expectedUtf8Len=', expectedUtf8Len, 'verifyCandidates=', tried, 'chosenStart=', start, 'chosenEnd=', end);
    if (bytes?.length) {
      const hex = Array.from(bytes.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.debug('[mpy verify] decodedFirst32Hex=', hex);
    }
  }
  return bytes;
}

/**
 * @param {string} acc
 * @param {string} frameToken
 * @param {number} expectedUtf8Len
 */
function readbackRxCompleteFramed(acc, frameToken, expectedUtf8Len) {
  const { hay, frameFound } = readbackHaystackAfterFrame(acc, frameToken);
  if (!frameFound) return false;
  const { bytes } = tryDecodeReadbackSpansInHay(hay, expectedUtf8Len);
  return bytes !== null;
}

async function sha256HexOfUtf8(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Large-sketch verify needs SHA-256 (use HTTPS or localhost).');
  }
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Read main.py back from the board and compare to the exact preview bytes (not length-only).
 * @param {string} trimmedSource
 */
async function verifyMainPyContentOnDevice(trimmedSource) {
  devUploadPhase('verify phase start');
  const expectedBytes = new TextEncoder().encode(trimmedSource);
  const n = expectedBytes.byteLength;

  if (n <= READBACK_B64_MAX_BYTES) {
    await sendMicroPythonInterrupt();
    await delay(200);
    await drainSerialRxFor(120);
    const frameToken = makeReadbackFrameToken();
    devMpyLog('verify', `readback frameToken=${frameToken}`);
    if (import.meta.env.DEV) {
      console.debug('[mpy verify] start framed readback, expectedBytes=', n);
    }

    const rx = waitForSerialRx((a) => readbackRxCompleteFramed(a, frameToken, n), 22_000);
    const cmd = `print('${READBACK_FRAME_PREFIX}${frameToken}');import ubinascii;__b=open('main.py','rb').read();print('${READBACK_START}'+ubinascii.b2a_base64(__b).decode()+'${READBACK_END}')\r\n`;
    await writeSerialText(cmd);
    let acc;
    try {
      acc = await rx;
    } catch {
      throw new Error(
        'Could not read back main.py from the board (timeout). Try Upload again or reconnect USB.',
      );
    }
    if (import.meta.env.DEV) {
      const { hay, frameFound, framePos } = readbackHaystackAfterFrame(acc, frameToken);
      console.debug(
        '[mpy verify] accLen=',
        acc.length,
        'frameFound=',
        frameFound,
        'framePos=',
        framePos,
        'hayLen=',
        hay.length,
        'tail=',
        JSON.stringify(acc.slice(-400)),
      );
    }
    const gotBytes = extractFramedReadback(acc, frameToken, n);
    if (!gotBytes) {
      const lm = acc.lastIndexOf(READBACK_START);
      const lt = acc.lastIndexOf('Traceback');
      const endPos = lm >= 0 ? acc.indexOf(READBACK_END, lm + READBACK_START.length) : -1;
      const tracebackInsideSpan = lt >= 0 && lm >= 0 && lt > lm && (endPos < 0 || lt < endPos);
      if (tracebackInsideSpan && !/KeyboardInterrupt/i.test(acc.slice(lt, lt + 400))) {
        throw new Error(
          'MicroPython could not read back main.py — check Serial Monitor for Traceback, then try Upload again.',
        );
      }
      throw new Error(
        'Could not parse main.py readback from the board — upload verification failed. Try Upload again.',
      );
    }
    if (gotBytes.length !== expectedBytes.length) {
      const dec = new TextDecoder('utf-8', { fatal: false });
      const gotStr = dec.decode(gotBytes);
      const diff = firstMainPyLineMismatch(trimmedSource, gotStr);
      const hint = diff
        ? ` First mismatch at line ${diff.line} — preview: ${JSON.stringify(diff.previewLine.slice(0, 120))} vs board: ${JSON.stringify(diff.boardLine.slice(0, 120))}.`
        : '';
      throw new Error(
        `Uploaded main.py size differs from preview (${gotBytes.length} bytes on board vs ${expectedBytes.length} in preview).${hint}`,
      );
    }
    for (let i = 0; i < n; i++) {
      if (gotBytes[i] !== expectedBytes[i]) {
        const dec = new TextDecoder('utf-8', { fatal: false });
        const gotStr = dec.decode(gotBytes);
        const diff = firstMainPyLineMismatch(trimmedSource, gotStr);
        const line15Preview = trimmedSource.split('\n')[14] ?? '(n/a)';
        const line15Board = gotStr.split('\n')[14] ?? '(n/a)';
        if (import.meta.env.DEV) {
          console.warn('[mpy upload] byte mismatch at index', i, { line15Preview, line15Board });
        }
        const hint = diff
          ? ` First line difference at line ${diff.line}. Preview: ${JSON.stringify(diff.previewLine.slice(0, 140))} | Board: ${JSON.stringify(diff.boardLine.slice(0, 140))}.`
          : '';
        throw new Error(`main.py on the board does not match the preview (binary differs at byte ${i + 1}).${hint}`);
      }
    }
    devUploadPhase('verify phase success (byte-for-byte readback)');
    if (import.meta.env.DEV) {
      console.debug('[mpy verify] compare OK —', n, 'bytes match preview');
    }
    return;
  }

  const expectHash = await sha256HexOfUtf8(trimmedSource);
  const rx = waitForSerialRx((acc) => /__MPYHASH__\s+[0-9a-f]{64}/i.test(acc), 12_000);
  await writeSerialText(
    "import hashlib;print('__MPYHASH__',hashlib.sha256(open('main.py','rb').read()).hexdigest())\r\n",
  );
  let acc;
  try {
    acc = await rx;
  } catch {
    throw new Error('Could not hash main.py on the board (timeout). Try a smaller sketch or Upload again.');
  }
  const hm = acc.match(/__MPYHASH__\s+([0-9a-f]{64})/i);
  if (!hm) {
    throw new Error('Could not read main.py hash from the board — verification failed.');
  }
  if (hm[1].toLowerCase() !== expectHash) {
    throw new Error(
      'main.py on the board does not match the preview (SHA-256 differs). File may be corrupted; try Upload again.',
    );
  }
  devUploadPhase('verify phase success (SHA-256 on device)');
}

/**
 * @typedef {{ onStep?: (label: string) => void }} MicroPythonSessionOptions
 */

/**
 * Rerun main.py from flash (same exec path as after upload). Assumes main.py exists.
 * @param {MicroPythonSessionOptions} [options]
 */
export async function rerunMicroPythonMainPy(options) {
  const onStep = typeof options?.onStep === 'function' ? options.onStep : () => {};

  onStep('Interrupt — stopping any running code…');
  await sendMicroPythonInterrupt();

  onStep('Returning to friendly REPL (Ctrl-B if device was in raw mode)…');
  await exitRawToFriendlyRepl();

  onStep('Running main.py from flash…');
  await execMainPyFromFriendlyRepl();

  onStep('Done — board output follows below.');
}

/**
 * @param {string} sourceCode — full .py text from the IDE preview
 * @param {MicroPythonSessionOptions} [options]
 */
export async function uploadMicroPythonMainPy(sourceCode, options) {
  const onStep = typeof options?.onStep === 'function' ? options.onStep : () => {};

  const trimmed = sourceCode.trim();
  if (!trimmed) {
    throw new Error('No MicroPython source to upload.');
  }

  assertRunnableMainPySource(trimmed);

  if (import.meta.env.DEV) {
    console.debug('[mpy upload] exact main.py source written to device:\n', trimmed);
  }

  const expectedUtf8 = new TextEncoder().encode(trimmed).byteLength;
  const hexParts = sourceToHexChunks(trimmed);
  const py = buildDeviceScript(hexParts);

  onStep('Stopping any running code…');
  devUploadPhase('interrupt done');
  await sendMicroPythonInterrupt();

  onStep('Entering raw REPL (upload mode)…');
  await enterRawRepl();
  devUploadPhase('raw REPL ready (banner + >)');

  onStep('Writing main.py to flash…');
  devUploadPhase('entered write phase — sending hex script + EOT');
  if (import.meta.env.DEV) {
    console.debug(
      `[mpy write] shape=hex+ubinascii.unhexlify, hexChunks=${hexParts.length}, expectedUtf8Bytes=${expectedUtf8}`,
    );
    console.debug('[mpy write] full device script:\n', py);
    devMpyLog('rawWrite', `script chars=${py.length}, firstHexChunkLen=${hexParts[0]?.length ?? 0}`);
  }
  devMpyLog('rawWrite', 'chunked UTF-8 write + Ctrl-D (EOT)');
  let writeWaitAcc = '';
  let writeDiagOnce = false;
  const execDone = waitForSerialRx((buf) => {
    writeWaitAcc = buf;
    const accepted = rawMainPyWriteComplete(buf, expectedUtf8);
    if (import.meta.env.DEV) {
      if (accepted) {
        const last = findLastMpywroteMatch(buf);
        const got = last ? parseInt(last[1], 10) : NaN;
        devMpyLog(
          'rawWriteAccept',
          `accLen=${buf.length} __MPYWROTE__=${Number.isFinite(got) ? got : '—'} expected=${expectedUtf8}`,
        );
      } else if (!writeDiagOnce && buf.includes('__MPYWROTE__')) {
        writeDiagOnce = true;
        const ev = evaluateRawMainPyWriteComplete(buf, expectedUtf8);
        const last = findLastMpywroteMatch(buf);
        const got = last ? parseInt(last[1], 10) : NaN;
        const eotA = last ? buf.indexOf(EOT, last.index + last[0].length) : -1;
        const okFirst = eotA >= 0 ? rawReplOkPresentBefore(buf.slice(0, eotA)) : false;
        devMpyLog(
          'rawWriteRx',
          `expected=${expectedUtf8} got=${got} accepted=${ev.ok} ${ev.ok ? '' : `reject=${ev.reason} `}okBeforeFirstEotOnly=${okFirst} accLen=${buf.length}`,
        );
      }
    }
    return accepted;
  }, 25000);
  await writeSerialUtf8InChunks(py + EOT, 2048);
  let acc;
  let writeRecoveredFromTimeout = false;
  try {
    acc = await execDone;
  } catch {
    if (import.meta.env.DEV) {
      console.debug('[mpy write] TIMEOUT diag:', formatWriteWaitTimeoutDiag(writeWaitAcc, expectedUtf8));
      devUploadPhase(`write wait timed out — see [mpy write] TIMEOUT diag in console`);
    }
    if (rawMainPyWriteRecoveryAccepted(writeWaitAcc, expectedUtf8)) {
      acc = writeWaitAcc;
      writeRecoveredFromTimeout = true;
      devMpyLog(
        'rawWrite',
        'RX wait timed out but board reported matching __MPYWROTE__ — continuing upload',
      );
      onStep('Write confirmed (device reported size).');
    } else {
      throw new Error(
        'Timed out while writing main.py (raw REPL). Try Upload again, or reconnect the USB serial port.',
      );
    }
  }
  devUploadPhase(
    writeRecoveredFromTimeout
      ? 'write confirmed via recovery heuristic'
      : 'write confirmed (__MPYWROTE__ + raw REPL OK + EOT)',
  );
  devMpyLog('rawWrite', `OK/EOT or recovery, rxLen=${acc.length}`);
  const lastW = findLastMpywroteMatch(acc);
  const gotRaw = lastW ? parseInt(lastW[1], 10) : NaN;
  if (import.meta.env.DEV) {
    console.debug('[mpy write] raw __MPYWROTE__ bytes=', gotRaw, 'expected=', expectedUtf8, 'match=', gotRaw === expectedUtf8);
  }
  if (!Number.isFinite(gotRaw) || gotRaw !== expectedUtf8) {
    throw new Error(
      `main.py write failed on the board (raw step reported ${gotRaw} bytes, preview is ${expectedUtf8} bytes). Try Upload again.`,
    );
  }
  if (acc.includes('Traceback')) {
    const lastTb = acc.lastIndexOf('Traceback');
    const afterLine = lastW.index + lastW[0].length;
    const tracebackAfterWriteLine = lastTb >= afterLine;
    if (tracebackAfterWriteLine) {
      const head = acc.slice(lastTb, lastTb + 520);
      if (!/KeyboardInterrupt/i.test(head)) {
        throw new Error('MicroPython error while writing main.py — check Serial Monitor for Traceback.');
      }
    }
  }

  onStep('Switching to friendly REPL for live output…');
  await exitRawToFriendlyRepl();
  await delay(200);

  onStep('Verifying main.py matches preview on flash…');
  await verifyMainPyContentOnDevice(trimmed);

  onStep('Starting main.py (exec from flash — USB link kept)…');
  await execMainPyFromFriendlyRepl();

  devUploadPhase('upload finished successfully');
  onStep('Done. Output and any errors appear below from the board.');
}
