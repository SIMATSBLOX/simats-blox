/**
 * Browser-local draft of the current editing session (separate from named browser projects).
 * @see sessionAutosave.js
 */

export const SESSION_DRAFT_STORAGE_KEY = 'hardware-block-ide:session-draft:v1';

/**
 * SPA navigation away from the IDE (e.g. / → /devices) unmounts IDEStudio but keeps this module
 * loaded. We suppress the recovery *modal* on the next IDE mount and silently re-apply the draft
 * instead. A real full reload re-executes the bundle and resets this flag — refresh/tab crash recovery
 * still gets the modal when appropriate.
 */
let suppressIdeRecoveryModalOnce = false;

export function markIdeSessionRecoverySpaLeave() {
  suppressIdeRecoveryModalOnce = true;
}

/**
 * @returns {boolean} true if this IDE mount should skip the recovery modal (internal return trip)
 */
export function consumeIdeRecoveryModalSuppression() {
  if (!suppressIdeRecoveryModalOnce) return false;
  suppressIdeRecoveryModalOnce = false;
  return true;
}

const DEFAULT_PROJECT_NAME = 'Untitled hardware project';

/**
 * @param {unknown} data
 * @returns {boolean}
 */
export function validateSessionDraft(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  if (!data.blockly || typeof data.blockly !== 'object') return false;
  if (data.version != null) {
    const v = Number(data.version);
    if (!Number.isFinite(v) || v < 1) return false;
  }
  return true;
}

/**
 * @param {unknown} blockly
 * @returns {number}
 */
export function countTopLevelBlocklyBlocks(blockly) {
  const arr = blockly?.blocks?.blocks;
  return Array.isArray(arr) ? arr.length : 0;
}

/**
 * Skip prompting / storing empty default sessions.
 * @param {object} data
 */
export function isSessionDraftMeaningful(data) {
  const name = String(data.projectName ?? '').trim();
  const desc = String(data.description ?? '').trim();
  const legacyBoard = data.boardId != null && data.boardId !== '' && data.boardId !== 'esp32';
  const n = countTopLevelBlocklyBlocks(data.blockly);
  const hasBlocks = n > 0;
  const hasCustomMeta = name !== DEFAULT_PROJECT_NAME || desc.length > 0 || legacyBoard;
  return hasBlocks || hasCustomMeta;
}

/**
 * @returns {string | null}
 */
export function readSessionDraftRaw() {
  try {
    return localStorage.getItem(SESSION_DRAFT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * @param {object} payload
 */
export function writeSessionDraft(payload) {
  try {
    localStorage.setItem(SESSION_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  } catch (e) {
    if (e && e.name === 'QuotaExceededError') {
      try {
        localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }
}

export function clearSessionDraft() {
  try {
    localStorage.removeItem(SESSION_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} iso
 */
export function formatDraftAgeLabel(iso) {
  if (!iso || typeof iso !== 'string') return '';
  try {
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '';
    const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (sec < 60) return 'just now';
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`;
    return `${Math.floor(sec / 86400)} days ago`;
  } catch {
    return '';
  }
}
