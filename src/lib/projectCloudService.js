import { getSupabaseClient, isSupabaseConfigured } from './supabaseClient.js';
import { SB_PROJECT_COLUMNS, SB_TABLES } from './projectCloudSchema.js';
import { computePersistTarget } from './cloudRouting.js';
import { useIdeStore } from '../store/ideStore.js';
import { useCloudAuthStore } from '../store/cloudAuthStore.js';
import { formatUserSafeError } from './projectIo.js';

/**
 * @typedef {object} HardwareProjectPayload
 * @property {string} [id] — row UUID when updating
 * @property {string} projectName
 * @property {string} [description]
 * @property {string} boardId
 * @property {number} [version]
 * @property {object} blockly
 */

function requireConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase client unavailable.');
  return supabase;
}

/**
 * PostgREST uses the access token from the client session. Prefer getSession() over getUser() here so the
 * JWT attached to .from().insert() matches the user_id we write (avoids “signed in” UI but RLS blocks writes).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function requireSessionUserId(supabase) {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  const uid = session?.user?.id;
  if (!uid) {
    throw new Error('Sign in with Supabase to use cloud projects.');
  }
  return { uid, session };
}

/** @param {string} detail */
function diagCloudSave(detail) {
  if (!import.meta.env.DEV) return;
  try {
    const pt = computePersistTarget();
    useIdeStore.getState().appendLog('info', `[diag cloud save] persistTarget=${pt} ${detail}`);
  } catch {
    /* ignore */
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {'insert' | 'update'} op
 * @param {unknown} err
 */
async function logDevSupabaseSaveFailure(supabase, op, err) {
  if (!import.meta.env.DEV) return;
  try {
    const pt = computePersistTarget();
    const { data: { session } } = await supabase.auth.getSession();
    const cloudUser = !!useCloudAuthStore.getState().user;
    const code =
      err && typeof err === 'object' && err !== null && 'code' in err && err.code != null
        ? String(err.code)
        : '';
    const msg = formatUserSafeError(err);
    const details =
      err && typeof err === 'object' && err !== null && 'details' in err && err.details != null
        ? String(err.details).slice(0, 280)
        : '';
    const hint =
      err && typeof err === 'object' && err !== null && 'hint' in err && err.hint != null
        ? String(err.hint).slice(0, 160)
        : '';
    useIdeStore.getState().appendLog(
      'info',
      `[diag supabase save fail] persistTarget=${pt} supabaseUser=${cloudUser} session=${!!session} op=${op} code=${code || '(none)'} msg=${msg}${details ? ` details=${details}` : ''}${hint ? ` hint=${hint}` : ''}`,
    );
  } catch {
    /* ignore */
  }
}

/**
 * Insert or update a row for the signed-in user. Requires `ide_projects` table (see README).
 * @param {HardwareProjectPayload} project
 * @returns {Promise<{ id: string, updatedAt: string }>}
 */
export async function saveProjectToCloud(project) {
  const supabase = requireConfigured();
  const { uid } = await requireSessionUserId(supabase);

  if (project.blockly == null || typeof project.blockly !== 'object') {
    throw new Error('Cloud save failed: workspace has no block data to store.');
  }

  const now = new Date().toISOString();
  const payload = {
    [SB_PROJECT_COLUMNS.NAME]: String(project.projectName ?? 'Untitled project').slice(0, 200),
    [SB_PROJECT_COLUMNS.DESCRIPTION]: typeof project.description === 'string' ? project.description.slice(0, 2000) : '',
    [SB_PROJECT_COLUMNS.BOARD_ID]: 'esp32',
    [SB_PROJECT_COLUMNS.WORKSPACE_JSON]: project.blockly,
    [SB_PROJECT_COLUMNS.UPDATED_AT]: now,
  };

  const sel = `${SB_PROJECT_COLUMNS.ID}, ${SB_PROJECT_COLUMNS.UPDATED_AT}`;

  const insertNew = async () => {
    diagCloudSave(`op=insert uidPrefix=${String(uid).slice(0, 8)}…`);
    const insertRow = {
      ...payload,
      [SB_PROJECT_COLUMNS.USER_ID]: uid,
    };
    const { data, error } = await supabase.from(SB_TABLES.PROJECTS).insert(insertRow).select(sel).single();
    if (error) {
      await logDevSupabaseSaveFailure(supabase, 'insert', error);
      throw error;
    }
    if (!data) throw new Error('Save returned no data.');
    return { id: data[SB_PROJECT_COLUMNS.ID], updatedAt: data[SB_PROJECT_COLUMNS.UPDATED_AT] };
  };

  if (project.id && typeof project.id === 'string') {
    diagCloudSave(`op=update rowIdPrefix=${String(project.id).slice(0, 8)}… uidPrefix=${String(uid).slice(0, 8)}…`);
    const { data, error } = await supabase
      .from(SB_TABLES.PROJECTS)
      .update(payload)
      .eq(SB_PROJECT_COLUMNS.ID, project.id)
      .eq(SB_PROJECT_COLUMNS.USER_ID, uid)
      .select(sel)
      .single();

    if (!error && data) {
      return { id: data[SB_PROJECT_COLUMNS.ID], updatedAt: data[SB_PROJECT_COLUMNS.UPDATED_AT] };
    }

    const isNoRow =
      error &&
      (error.code === 'PGRST116' ||
        String(error.message).toLowerCase().includes('0 rows') ||
        String(error.details ?? '').toLowerCase().includes('0 rows'));

    if (isNoRow) {
      diagCloudSave('update returned 0 rows → retry insert (stale cloud slot)');
      return insertNew();
    }

    if (error) {
      await logDevSupabaseSaveFailure(supabase, 'update', error);
      throw error;
    }
    throw new Error('Save returned no data.');
  }

  return insertNew();
}

/**
 * @returns {Promise<Array<{ id: string, projectName: string, description: string, boardId: string, updatedAt: string }>>}
 */
export async function listCloudProjects() {
  if (!isSupabaseConfigured()) return [];
  const supabase = requireConfigured();
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from(SB_TABLES.PROJECTS)
    .select(
      `${SB_PROJECT_COLUMNS.ID}, ${SB_PROJECT_COLUMNS.NAME}, ${SB_PROJECT_COLUMNS.DESCRIPTION}, ${SB_PROJECT_COLUMNS.BOARD_ID}, ${SB_PROJECT_COLUMNS.UPDATED_AT}`,
    )
    .eq(SB_PROJECT_COLUMNS.USER_ID, uid)
    .order(SB_PROJECT_COLUMNS.UPDATED_AT, { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r[SB_PROJECT_COLUMNS.ID],
    projectName: r[SB_PROJECT_COLUMNS.NAME],
    description: typeof r[SB_PROJECT_COLUMNS.DESCRIPTION] === 'string' ? r[SB_PROJECT_COLUMNS.DESCRIPTION] : '',
    boardId: r[SB_PROJECT_COLUMNS.BOARD_ID],
    updatedAt: r[SB_PROJECT_COLUMNS.UPDATED_AT],
  }));
}

/**
 * @param {string} id
 * @returns {Promise<{ projectName: string, description: string, boardId: string, blockly: object }>}
 */
export async function loadCloudProject(id) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured.');
  }
  const supabase = requireConfigured();
  const { uid } = await requireSessionUserId(supabase);

  const { data, error } = await supabase
    .from(SB_TABLES.PROJECTS)
    .select('*')
    .eq(SB_PROJECT_COLUMNS.ID, id)
    .eq(SB_PROJECT_COLUMNS.USER_ID, uid)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Project not found.');

  const workspace = data[SB_PROJECT_COLUMNS.WORKSPACE_JSON];
  if (workspace == null || typeof workspace !== 'object') {
    throw new Error('Cloud project has no workspace data.');
  }

  return {
    projectName: data[SB_PROJECT_COLUMNS.NAME] ?? 'Untitled project',
    description: data[SB_PROJECT_COLUMNS.DESCRIPTION] ?? '',
    boardId: data[SB_PROJECT_COLUMNS.BOARD_ID],
    blockly: workspace,
  };
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteSupabaseProject(id) {
  const supabase = requireConfigured();
  const { uid } = await requireSessionUserId(supabase);

  const { error } = await supabase
    .from(SB_TABLES.PROJECTS)
    .delete()
    .eq(SB_PROJECT_COLUMNS.ID, id)
    .eq(SB_PROJECT_COLUMNS.USER_ID, uid);

  if (error) throw error;
}
