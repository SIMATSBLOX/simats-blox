/**
 * Browser-local project list (localStorage). Not cloud sync — same browser/profile only.
 */

const KEY = 'hardware-block-ide:browser-projects:v1';

/** @returns {{ v: number, items: object[] }} */
function readStore() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { v: 1, items: [] };
    const j = JSON.parse(raw);
    if (!j || j.v !== 1 || !Array.isArray(j.items)) return { v: 1, items: [] };
    return j;
  } catch {
    return { v: 1, items: [] };
  }
}

/** @param {object[]} items */
function writeStore(items) {
  localStorage.setItem(KEY, JSON.stringify({ v: 1, items }));
}

/**
 * @returns {Array<{ id: string, version?: number, projectName: string, description?: string, boardId: string, blockly: object, updatedAt: string }>}
 */
export function listBrowserProjectsSorted() {
  const { items } = readStore();
  return items
    .filter((x) => x && typeof x.id === 'string' && x.blockly && typeof x.blockly === 'object')
    .slice()
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
}

/**
 * @param {string} id
 * @returns {object | null}
 */
export function getBrowserProject(id) {
  const { items } = readStore();
  return items.find((x) => x.id === id) ?? null;
}

/**
 * Insert or update. Pass id to update; omit id to create a new project row.
 * @param {object} payload — shape like exported JSON + optional id
 * @returns {string} id
 */
export function putBrowserProject(payload) {
  const { items } = readStore();
  const id = payload.id && typeof payload.id === 'string' ? payload.id : crypto.randomUUID();
  const row = {
    id,
    version: typeof payload.version === 'number' ? payload.version : 1,
    projectName: (() => {
      const t = String(payload.projectName ?? 'Untitled project').trim();
      return t || 'Untitled project';
    })(),
    description: typeof payload.description === 'string' ? payload.description : '',
    boardId: 'esp32',
    blockly: payload.blockly,
    updatedAt: new Date().toISOString(),
  };
  const idx = items.findIndex((x) => x.id === id);
  if (idx >= 0) items[idx] = row;
  else items.push(row);
  try {
    writeStore(items);
  } catch (e) {
    throw new Error(
      e && e.name === 'QuotaExceededError'
        ? 'Browser storage is full. Export a project to a file or delete an old saved project.'
        : String(e?.message || e),
    );
  }
  return id;
}

/**
 * @param {string} id
 */
export function removeBrowserProject(id) {
  const { items } = readStore();
  writeStore(items.filter((x) => x.id !== id));
}
