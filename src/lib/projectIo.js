/**
 * Client-side project file helpers (JSON validation, safe download names).
 */

/** @param {unknown} v */
function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {string} text
 * @returns {{ ok: true, data: object } | { ok: false, error: string }}
 */
export function parseHardwareProjectJson(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON. Choose a .hwblocks.json project export.' };
  }
  if (!isPlainObject(data)) {
    return { ok: false, error: 'Project file must be a JSON object (not an array or primitive).' };
  }
  if (!isPlainObject(data.blockly)) {
    return { ok: false, error: 'Missing Blockly data: expected a top-level "blockly" object.' };
  }
  if (data.version != null) {
    const v = Number(data.version);
    if (!Number.isFinite(v) || v < 1) {
      return { ok: false, error: 'Invalid project "version" (expected a positive number, or omit the field).' };
    }
  }
  return { ok: true, data };
}

/**
 * Safe basename for downloads (no path segments, OS-friendly).
 * @param {string} name
 * @param {string} [fallback]
 */
export function slugifyProjectBasename(name, fallback = 'project') {
  const raw = String(name || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const base = raw.slice(0, 80) || fallback;
  return base;
}

/**
 * @param {string} content
 * @param {string} filename
 * @param {string} [mimeType]
 */
export function downloadTextFile(content, filename, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** @param {unknown} e */
export function formatUserSafeError(e) {
  const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e);
  const line = msg.split('\n')[0] || 'Unknown error';
  return line.length > 200 ? `${line.slice(0, 197)}…` : line;
}

/**
 * True when the error indicates the relation/table is missing from the DB schema — not RLS or other ide_projects mentions.
 * @param {string} code
 * @param {string} lower
 * @param {string} raw
 */
function isTableMissingError(code, lower, raw) {
  if (code === 'PGRST205' || code === '42P01') return true;
  if (lower.includes('could not find the table')) return true;
  if (lower.includes('undefined_table')) return true;
  if (lower.includes('relation') && lower.includes('does not exist')) return true;
  // "… in the schema cache" only when PostgREST can’t resolve the table (not generic cache text)
  if (lower.includes('schema cache') && (lower.includes('could not find') || lower.includes('not find'))) return true;
  return /\b42P01\b/.test(raw);
}

/**
 * Short, user-facing messages for Supabase / PostgREST errors (avoid raw DB jargon in the console UI).
 * Order matters: do not treat every mention of `ide_projects` as “table missing” — RLS errors name the table too.
 * @param {unknown} e
 */
export function formatSupabaseUserMessage(e) {
  const code = e && typeof e === 'object' && e !== null && 'code' in e ? String(e.code) : '';
  const raw = formatUserSafeError(e);
  const lower = raw.toLowerCase();

  if (
    lower.includes('sign in with supabase to use cloud') ||
    lower.includes('sign in with supabase to save') ||
    lower.includes('sign in with supabase to load') ||
    lower.includes('sign in with supabase to manage')
  ) {
    return 'not signed in';
  }
  if (lower.includes('workspace has no block data')) {
    return 'invalid project data';
  }
  if (code === 'PGRST116' || /contains 0 rows|\b0 rows\b/.test(lower)) {
    return 'no matching cloud project';
  }
  if (code === 'PGRST204' || lower.includes("could not find the") && lower.includes('column')) {
    return 'Cloud schema mismatch — check ide_projects columns vs projectCloudSchema.js';
  }
  if (
    code === '42501' ||
    lower.includes('permission denied for') ||
    lower.includes('row-level security') ||
    lower.includes('violates row-level security') ||
    lower.includes('policy') ||
    lower.includes('rls') ||
    (lower.includes('permission') && lower.includes('denied'))
  ) {
    return 'permission denied';
  }
  // Wrong password / unknown user — Supabase says "Invalid login credentials" (contains "invalid login").
  // Must run before the JWT/session branch so we do not mislabel sign-in failures as "session expired".
  if (
    code === 'invalid_credentials' ||
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('email not confirmed') ||
    lower.includes('user not found')
  ) {
    return 'Wrong email or password (or confirm your email if you just signed up).';
  }
  if (
    lower.includes('refresh token') ||
    lower.includes('session expired') ||
    lower.includes('jwt expired') ||
    lower.includes('token has expired') ||
    lower.includes('invalid_grant') ||
    (lower.includes('jwt') && (lower.includes('expired') || lower.includes('malformed')))
  ) {
    return 'session expired — sign in again';
  }
  if (
    code === '23502' ||
    code === '23514' ||
    code === '22P02' ||
    lower.includes('not null violation') ||
    lower.includes('check constraint') ||
    lower.includes('invalid input syntax')
  ) {
    return 'invalid project data';
  }
  if (isTableMissingError(code, lower, raw)) {
    return 'table missing';
  }
  if (lower.includes('network') || lower.includes('failed to fetch')) {
    return 'Could not reach the cloud. Check your connection and Supabase project status.';
  }
  return raw;
}
