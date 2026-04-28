/**
 * Browser Web Serial API — connect / read / write / disconnect (no upload).
 * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Serial_API
 */

import { SERIAL_MSG } from './serialUserMessages.js';

/** @typedef {(line: string) => void} SerialLineCallback */
/** @typedef {() => void} VoidCallback */

let activePort = /** @type {SerialPort | null} */ (null);
let abortController = /** @type {AbortController | null} */ (null);
/** @type {ReadableStreamDefaultReader<Uint8Array> | null} */
let activeReader = null;
let removeDisconnectListener = /** @type {null | (() => void)} */ (null);

/** Raw decoded UTF-8 chunks (includes \\x04 etc.) for MicroPython REPL protocol waits. */
/** @type {Set<(chunk: string) => void>} */
const serialRxChunkListeners = new Set();

/**
 * Subscribe to every incoming decoded chunk before line splitting / sanitization.
 * @param {(chunk: string) => void} fn
 * @returns {() => void} unsubscribe
 */
export function subscribeSerialRxChunk(fn) {
  serialRxChunkListeners.add(fn);
  return () => {
    serialRxChunkListeners.delete(fn);
  };
}

function notifySerialRxChunkListeners(chunk) {
  for (const fn of serialRxChunkListeners) {
    try {
      fn(chunk);
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[webSerial] serialRxChunk listener', e);
      }
    }
  }
}

/**
 * Wait until predicate(accumulatedString) is true, or timeout. Accumulator only sees
 * bytes that arrive after this function is called (fresh session).
 * @param {(acc: string) => boolean} predicate
 * @param {number} timeoutMs
 * @returns {Promise<string>} final accumulated string
 */
export function waitForSerialRx(predicate, timeoutMs) {
  return new Promise((resolve, reject) => {
    let acc = '';
    const unsub = subscribeSerialRxChunk((c) => {
      acc += c;
      if (acc.length > 65536) acc = acc.slice(-32768);
      try {
        if (predicate(acc)) {
          clearTimeout(tid);
          unsub();
          resolve(acc);
        }
      } catch (e) {
        clearTimeout(tid);
        unsub();
        reject(e);
      }
    });
    const tid = setTimeout(() => {
      unsub();
      reject(new Error(`Serial RX wait timed out after ${timeoutMs} ms`));
    }, timeoutMs);
  });
}

/**
 * Let UART / REPL spit out any pending bytes without accumulating them for the next waiter.
 * Does not affect other subscribers (e.g. Serial Monitor) — upload verification still gets a
 * cleaner first chunk after this + a framed readback command.
 * @param {number} ms
 */
export function drainSerialRxFor(ms) {
  return new Promise((resolve) => {
    const unsub = subscribeSerialRxChunk(() => {});
    setTimeout(() => {
      unsub();
      resolve(undefined);
    }, ms);
  });
}

/**
 * Whether the current environment can use Web Serial (API + secure context).
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function getWebSerialAvailability() {
  if (typeof navigator === 'undefined' || !('serial' in navigator) || !navigator.serial) {
    return {
      ok: false,
      message: SERIAL_MSG.browserUnsupported,
    };
  }
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return {
      ok: false,
      message: SERIAL_MSG.secureContext,
    };
  }
  return { ok: true };
}

/**
 * @param {unknown} err
 * @returns {string}
 */
export function formatWebSerialError(err) {
  if (err && typeof err === 'object' && 'name' in err) {
    const name = /** @type {{ name: string }} */ (err).name;
    if (name === 'NotFoundError') return SERIAL_MSG.noPortSelected;
    if (name === 'SecurityError') return SERIAL_MSG.serialBlocked;
    if (name === 'InvalidStateError') return 'The serial port is already in use — try Disconnect, then Connect.';
    if (name === 'NetworkError') return SERIAL_MSG.deviceDisconnected;
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Could not use the serial port.';
}

/**
 * Max time to hold a non-terminated tail before pushing it to the monitor.
 * Timer is NOT reset on every USB chunk — steady trickle traffic still flushes.
 */
const PARTIAL_FLUSH_MS = 50;

/** Avoid unbounded buffer if firmware spews binary without newlines. */
const MAX_PENDING_CHARS = 16384;

/** Collapse boot / UART binary blobs so they are not expanded into huge ^A/^D noise lines. */
/** Collapse noisy UART / raw-REPL blobs sooner so Serial Monitor stays readable. */
const BINARY_CHUNK_MIN = 12;
const BINARY_CTRL_FRACTION = 0.22;
const MAX_CONTROL_EXPANSIONS = 14;

function rawControlByteFraction(s) {
  if (!s.length) return 0;
  let ctrl = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) ctrl++;
  }
  return ctrl / s.length;
}

/**
 * Strip NUL (can truncate DOM text) and map other C0 controls to a visible form so
 * MicroPython/raw-REPL bytes (Ctrl-A/B/C/D, etc.) never “disappear” in the UI.
 * Keeps \t \n \r as-is for layout.
 * Long runs of control bytes (connect noise, flash/boot garbage) collapse to one line.
 * @param {string} s
 */
function sanitizeSerialForDom(s) {
  if (s.length >= BINARY_CHUNK_MIN && rawControlByteFraction(s) >= BINARY_CTRL_FRACTION) {
    return '[Serial: non-text / boot noise omitted]\n';
  }
  let out = '';
  let expansions = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 0) continue;
    if (c < 32 && c !== 9 && c !== 10 && c !== 13) {
      if (expansions >= MAX_CONTROL_EXPANSIONS) {
        out += ' …[ctrl bytes omitted]';
        break;
      }
      expansions += 1;
      out += `^${String.fromCharCode(c === 27 ? 91 : c + 64)}`; // ESC → ^[, Ctrl-B → ^B
      continue;
    }
    out += s[i];
  }
  return out;
}

/**
 * Emit complete logical lines from `buffer` using CRLF, LF, or CR as terminators.
 * MicroPython / USB serial often use CR-only redraws; friendly REPL prompts may lack
 * a trailing newline until the next byte arrives — caller handles that via debounced flush.
 * @param {string} buffer
 * @param {(line: string) => void} emit
 * @returns {string} tail after last consumed terminator
 */
function takeTerminatedLines(buffer, emit) {
  let pending = buffer;
  while (pending.length > 0) {
    const rn = pending.indexOf('\r\n');
    const n = pending.indexOf('\n');
    const r = pending.indexOf('\r');
    let cut = -1;
    let sepLen = 0;
    if (rn !== -1 && (n === -1 || rn <= n) && (r === -1 || rn <= r)) {
      cut = rn;
      sepLen = 2;
    } else if (n !== -1 && (r === -1 || n <= r)) {
      cut = n;
      sepLen = 1;
    } else if (r !== -1) {
      cut = r;
      sepLen = 1;
    } else {
      break;
    }
    emit(pending.slice(0, cut) + '\n');
    pending = pending.slice(cut + sepLen);
  }
  return pending;
}

/**
 * @param {SerialPort} port
 * @param {AbortSignal} signal
 * @param {SerialLineCallback} onLine
 */
async function readLoop(port, signal, onLine) {
  if (!port.readable) return;
  const reader = port.readable.getReader();
  activeReader = reader;

  const decoder = new TextDecoder();
  let pending = '';
  /** @type {ReturnType<typeof setTimeout> | null} */
  let partialFlushTimer = null;

  const cancelPartialFlush = () => {
    if (partialFlushTimer != null) {
      clearTimeout(partialFlushTimer);
      partialFlushTimer = null;
    }
  };

  const safeOnLine = (line) => {
    try {
      onLine(sanitizeSerialForDom(line));
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[webSerial] onLine threw', e);
      }
    }
  };

  /**
   * Schedule a one-shot flush of `pending` if needed. Does not reset an existing timer
   * so bytes that arrive every few ms still become visible within PARTIAL_FLUSH_MS.
   */
  const ensurePartialFlushScheduled = () => {
    if (partialFlushTimer != null || !pending.length || signal.aborted) return;
    partialFlushTimer = setTimeout(() => {
      partialFlushTimer = null;
      if (signal.aborted || !pending.length) return;
      const fragment = pending;
      pending = '';
      safeOnLine(fragment);
    }, PARTIAL_FLUSH_MS);
  };

  const spillPendingIfHuge = () => {
    while (pending.length > MAX_PENDING_CHARS) {
      cancelPartialFlush();
      const spill = pending.slice(0, MAX_PENDING_CHARS);
      pending = pending.slice(MAX_PENDING_CHARS);
      safeOnLine(spill);
    }
  };

  try {
    while (!signal.aborted) {
      let readResult;
      try {
        readResult = await reader.read();
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[webSerial] reader.read() error — read loop stopping', e);
        }
        break;
      }
      const { value, done } = readResult;
      if (done) {
        break;
      }
      if (value && value.byteLength) {
        const chunk = decoder.decode(value, { stream: true });
        if (serialRxChunkListeners.size) {
          notifySerialRxChunkListeners(chunk);
        }
        if (import.meta.env.DEV) {
          const max = 220;
          const preview = chunk.length > max ? `${chunk.slice(0, max)}…(+${chunk.length - max})` : chunk;
          console.debug('[webSerial] RX raw chunk', JSON.stringify(preview));
        }
        pending += chunk;
        pending = takeTerminatedLines(pending, safeOnLine);
        spillPendingIfHuge();
        if (!pending.length) {
          cancelPartialFlush();
        } else {
          ensurePartialFlushScheduled();
        }
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[webSerial] read loop exception', e);
    }
  } finally {
    cancelPartialFlush();
    try {
      pending += decoder.decode();
    } catch {
      /* ignore */
    }
    pending = takeTerminatedLines(pending, safeOnLine);
    if (pending.length) {
      safeOnLine(pending);
    }
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
    if (activeReader === reader) activeReader = null;
  }
}

/**
 * Request a port (must run from a user gesture), open at baudRate, stream decoded lines to onLine.
 * @param {number} baudRate
 * @param {SerialLineCallback} onLine
 * @param {VoidCallback} [onDeviceDisconnected] — unplug / lost connection (not called for app-initiated disconnect)
 */
export async function connectWebSerial(baudRate, onLine, onDeviceDisconnected) {
  const av = getWebSerialAvailability();
  if (!av.ok) {
    throw new Error(av.message);
  }

  await disconnectWebSerial();

  const port = await navigator.serial.requestPort();
  await port.open({ baudRate });

  abortController = new AbortController();
  activePort = port;

  const handleDisconnect = () => {
    void (async () => {
      await disconnectWebSerial();
      onDeviceDisconnected?.();
    })();
  };
  port.addEventListener('disconnect', handleDisconnect);
  removeDisconnectListener = () => port.removeEventListener('disconnect', handleDisconnect);

  void readLoop(port, abortController.signal, onLine);

  return port;
}

/**
 * Send UTF-8 bytes to the open port (full-duplex with the read loop).
 * Acquires and releases the writable stream writer per call.
 * @param {string} text
 */
export async function writeSerialText(text) {
  if (!activePort) {
    throw new Error('Not connected — use Connect in the toolbar first.');
  }
  const writable = activePort.writable;
  if (!writable) {
    throw new Error('Serial port is not writable.');
  }
  const writer = writable.getWriter();
  try {
    const enc = new TextEncoder();
    await writer.write(enc.encode(text));
  } finally {
    try {
      writer.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Write a long UTF-8 string in USB-sized chunks without splitting codepoints.
 * Keeps one writer for the whole paste (better for MicroPython raw-REPL payloads).
 * @param {string} text
 * @param {number} [maxChunkBytes]
 */
export async function writeSerialUtf8InChunks(text, maxChunkBytes = 2048) {
  if (!activePort) {
    throw new Error('Not connected — use Connect in the toolbar first.');
  }
  const writable = activePort.writable;
  if (!writable) {
    throw new Error('Serial port is not writable.');
  }
  const enc = new TextEncoder();
  const writer = writable.getWriter();
  try {
    let i = 0;
    const len = text.length;
    while (i < len) {
      let lo = i;
      let hi = len;
      while (lo < hi) {
        const mid = Math.floor((lo + hi + 1) / 2);
        if (enc.encode(text.slice(i, mid)).length <= maxChunkBytes) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      if (lo === i) {
        lo = i + 1;
      }
      await writer.write(enc.encode(text.slice(i, lo)));
      i = lo;
      if (i < len) {
        await new Promise((r) => setTimeout(r, 4));
      }
    }
  } finally {
    try {
      writer.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

/** @param {number} ms */
function serialDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Try an ESP32-style auto-reset pulse via control lines (RTS/DTR).
 * Some USB-UART bridges ignore this; returns false in that case.
 * @returns {Promise<boolean>}
 */
export async function pulseEsp32AutoResetToRun() {
  if (!activePort || typeof activePort.setSignals !== 'function') return false;
  try {
    // Typical ESP32 sequence: pull EN low briefly, then release to boot normal app.
    await activePort.setSignals({ dataTerminalReady: false, requestToSend: true });
    await serialDelay(110);
    await activePort.setSignals({ dataTerminalReady: true, requestToSend: false });
    await serialDelay(240);
    return true;
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[webSerial] auto-reset pulse failed', e);
    }
    return false;
  }
}

/**
 * Close the active port and stop the read loop (user-initiated or cleanup).
 */
export async function disconnectWebSerial() {
  if (removeDisconnectListener) {
    try {
      removeDisconnectListener();
    } catch {
      /* ignore */
    }
    removeDisconnectListener = null;
  }

  abortController?.abort();
  abortController = null;

  try {
    await activeReader?.cancel();
  } catch {
    /* ignore */
  }
  activeReader = null;

  const port = activePort;
  activePort = null;

  if (port) {
    try {
      await port.close();
    } catch {
      /* ignore */
    }
  }
}
