/**
 * Debounced autosave of the current Blockly session to sessionRecoveryStore (localStorage).
 */
import * as Blockly from 'blockly';
import { useIdeStore } from '../store/ideStore.js';
import {
  clearSessionDraft,
  isSessionDraftMeaningful,
  writeSessionDraft,
} from './sessionRecoveryStore.js';

let debounceTimer = 0;

function writeDraftFromWorkspace(workspace) {
  try {
    if (!workspace) return;
    const st = useIdeStore.getState();
    const blockly = Blockly.serialization.workspaces.save(workspace);
    const payload = {
      savedAt: new Date().toISOString(),
      ...st.getExportPayload(),
      boardId: st.boardId,
      blockly,
    };
    if (!isSessionDraftMeaningful(payload)) {
      clearSessionDraft();
      return;
    }
    writeSessionDraft(payload);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('blockly/core/workspace').WorkspaceSvg | null} workspace
 * @param {number} [delayMs]
 */
export function scheduleSessionAutosave(workspace, delayMs = 2000) {
  if (!workspace) return;
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    debounceTimer = 0;
    writeDraftFromWorkspace(workspace);
  }, delayMs);
}

/**
 * @param {import('blockly/core/workspace').WorkspaceSvg | null} workspace
 */
export function flushSessionAutosave(workspace) {
  window.clearTimeout(debounceTimer);
  debounceTimer = 0;
  writeDraftFromWorkspace(workspace);
}
