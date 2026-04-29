import { create } from 'zustand';
import { normalizeCategoryId } from '../blockly/toolbox.js';
import { filterSerialMonitorOutput } from '../lib/serialDisplayFilter.js';
import { uuid } from '../lib/uuid.js';

/** @typedef {{ id: string, text: string }} SerialLine */
/** @typedef {'esp32'} BoardId */

/** Cap stored serial rows (oldest dropped first). */
const SERIAL_MAX_LINES = 2000;
/** Cap total characters across all rows (oldest dropped first). */
const SERIAL_MAX_TOTAL_CHARS = 450_000;
/** If the UI thread stalls, flush pending text anyway so memory stays bounded. */
const SERIAL_PENDING_CHAR_CAP = 48_000;

/** @type {string} */
let serialPending = '';
/** @type {number} */
let serialFlushRaf = 0;

/**
 * @param {SerialLine[]} lines
 * @returns {{ lines: SerialLine[], trimmed: boolean }}
 */
function trimSerialLines(lines) {
  let out = [...lines];
  let trimmed = false;

  while (out.length > SERIAL_MAX_LINES) {
    out.shift();
    trimmed = true;
  }

  let total = out.reduce((n, l) => n + l.text.length, 0);
  while (total > SERIAL_MAX_TOTAL_CHARS && out.length) {
    const first = out[0];
    const over = total - SERIAL_MAX_TOTAL_CHARS;
    if (first.text.length <= over) {
      total -= first.text.length;
      out.shift();
      trimmed = true;
      continue;
    }
    out[0] = { ...first, text: first.text.slice(over) };
    trimmed = true;
    break;
  }

  return { lines: out, trimmed };
}

/** @param {(fn: (s: any) => any) => void} set */
function pushSerialTextChunk(set, chunk) {
  if (!chunk) return;
  set((s) => {
    const next = [...s.serialLines, { id: uuid(), text: chunk }];
    const { lines, trimmed } = trimSerialLines(next);
    return {
      serialLines: lines,
      serialHistoryTrimmed: !!(s.serialHistoryTrimmed || trimmed),
    };
  });
}

/** @param {(fn: (s: any) => any) => void} set */
function flushSerialPendingNow(set) {
  if (!serialPending.length) return;
  const chunk = serialPending;
  serialPending = '';
  pushSerialTextChunk(set, chunk);
}

function cancelSerialAnimationOnly() {
  if (serialFlushRaf) {
    cancelAnimationFrame(serialFlushRaf);
    serialFlushRaf = 0;
  }
}

function cancelSerialFlushSchedule() {
  cancelSerialAnimationOnly();
  serialPending = '';
}

/** @param {(fn: (s: any) => any) => void} set */
function scheduleSerialFlush(set) {
  if (serialFlushRaf || !serialPending.length) return;
  serialFlushRaf = requestAnimationFrame(() => {
    serialFlushRaf = 0;
    flushSerialPendingNow(set);
    if (serialPending.length) {
      scheduleSerialFlush(set);
    }
  });
}

export const BOARD_LABEL = {
  esp32: 'ESP32 · MicroPython',
};

/** Web Serial `port.open({ baudRate })` for ESP32 MicroPython USB REPL (product is ESP32-only). */
export const ESP32_USB_SERIAL_BAUD = 115200;

export const useIdeStore = create((set, get) => ({
  projectName: 'Untitled hardware project',
  /** Optional blurb; included in saved JSON when non-empty. */
  description: '',
  boardId: /** @type {BoardId} */ ('esp32'),
  /** When set, File → Save updates this row in browser localStorage. */
  browserProjectId: /** @type {string | null} */ (null),
  /** When set, Save updates this project on the account (API). */
  cloudProjectId: /** @type {string | null} */ (null),
  /** True when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are set (updated at app init). */
  supabaseCloudConfigured: false,
  /**
   * Resolved save/Open backend preference for the next wiring pass.
   * @type {'local' | 'express_api' | 'supabase'}
   */
  persistTarget: 'local',
  activeCategoryId: 'control',
  /** USB serial via Web Serial: disconnected | connecting | connected */
  connectState: /** @type {'disconnected' | 'connecting' | 'connected'} */ ('disconnected'),
  /** Increment to ask ConsolePanel to switch to the Serial Monitor tab (e.g. toolbar Terminal). */
  serialTabFocusKey: 0,
  /** Fixed for ESP32 MicroPython USB; Web Serial `open({ baudRate })`. */
  serialBaudRate: ESP32_USB_SERIAL_BAUD,
  /**
   * True while connect/disconnect is in flight or any multi-step serial write runs (upload, send, MP stop/run).
   * Keeps Send / Stop / Run again / Upload from overlapping.
   */
  serialPipelineBusy: false,
  logLines: [
    { id: '1', level: 'info', text: 'Hardware block editor: code preview only in this build.' },
    {
      id: '2',
      level: 'info',
      text: 'Connect (Chrome / Edge / Opera) opens USB serial. Upload writes MicroPython to main.py on ESP32 when connected.',
    },
  ],
  serialLines: [],
  /** True once oldest serial output was dropped due to size limits (cleared on Clear). */
  serialHistoryTrimmed: false,

  setProjectName: (projectName) => set({ projectName }),
  setDescription: (description) => set({ description: typeof description === 'string' ? description : '' }),
  /** Product is ESP32-only; kept for API compatibility (no-op aside from normalizing state). */
  setBoardId: () => set({ boardId: 'esp32' }),
  setBrowserProjectId: (browserProjectId) =>
    set({ browserProjectId: browserProjectId && typeof browserProjectId === 'string' ? browserProjectId : null }),
  setCloudProjectId: (cloudProjectId) =>
    set({ cloudProjectId: cloudProjectId && typeof cloudProjectId === 'string' ? cloudProjectId : null }),
  setSupabaseCloudConfigured: (supabaseCloudConfigured) => set({ supabaseCloudConfigured: !!supabaseCloudConfigured }),
  /** @param {'local' | 'express_api' | 'supabase'} persistTarget */
  setPersistTarget: (persistTarget) => set({ persistTarget }),
  resetForNewSketch: () =>
    set({
      projectName: 'Untitled hardware project',
      description: '',
    }),
  setActiveCategoryId: (activeCategoryId) =>
    set({ activeCategoryId: normalizeCategoryId(activeCategoryId) }),
  /** @param {'disconnected' | 'connecting' | 'connected'} connectState */
  setConnectState: (connectState) => set({ connectState }),

  focusSerialMonitorTab: () => set((s) => ({ serialTabFocusKey: s.serialTabFocusKey + 1 })),

  /** @param {number} [_rate] Kept for compatibility; baud is fixed at {@link ESP32_USB_SERIAL_BAUD}. */
  setSerialBaudRate: (_rate) => set({ serialBaudRate: ESP32_USB_SERIAL_BAUD }),

  setSerialPipelineBusy: (serialPipelineBusy) => set({ serialPipelineBusy: !!serialPipelineBusy }),

  appendLog: (level, text) =>
    set((s) => ({
      logLines: [...s.logLines, { id: uuid(), level, text }],
    })),

  appendSerial: (text) => {
    const filtered = filterSerialMonitorOutput(text);
    if (filtered == null || filtered === '') return;
    serialPending += filtered;
    if (serialPending.length >= SERIAL_PENDING_CHAR_CAP) {
      cancelSerialAnimationOnly();
      while (serialPending.length >= SERIAL_PENDING_CHAR_CAP) {
        const take = serialPending.slice(0, SERIAL_PENDING_CHAR_CAP);
        serialPending = serialPending.slice(SERIAL_PENDING_CHAR_CAP);
        pushSerialTextChunk(set, take);
      }
    }
    if (serialPending.length) {
      scheduleSerialFlush(set);
    }
  },

  clearSerial: () => {
    cancelSerialFlushSchedule();
    set({ serialLines: [], serialHistoryTrimmed: false });
  },

  getExportPayload: () => {
    const s = get();
    const nameRaw = String(s.projectName ?? '').trim();
    const projectName = nameRaw || 'Untitled hardware project';
    const desc = typeof s.description === 'string' ? s.description.trim() : '';
    /** @type {Record<string, unknown>} */
    const out = {
      version: 1,
      projectName,
      boardId: s.boardId,
    };
    if (desc) out.description = desc;
    return out;
  },

  /**
   * Replace project metadata from an imported payload (JSON project, example, browser/cloud row).
   * Board is always normalized to ESP32 for this product.
   * @param {object} payload
   */
  applyImportPayload: (payload) =>
    set((s) => {
      const activeCategoryId = s.activeCategoryId;

      const rawName = payload?.projectName;
      const projectName = (() => {
        if (rawName == null) return 'Imported project';
        const t = String(rawName).trim();
        return t || 'Imported project';
      })();

      const rawDesc = payload?.description;
      const description = typeof rawDesc === 'string' ? rawDesc : '';

      return {
        projectName,
        description,
        boardId: 'esp32',
        activeCategoryId,
      };
    }),
}));
