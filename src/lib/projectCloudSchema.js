/**
 * Supabase `public.ide_projects` columns — single source of truth for cloud CRUD.
 * In-app project payloads still use `projectName` + `blockly`; map at the service layer:
 *   name ↔ projectName, workspace_json ↔ blockly
 */
export const SB_TABLES = {
  PROJECTS: 'ide_projects',
};

export const SB_PROJECT_COLUMNS = {
  ID: 'id',
  USER_ID: 'user_id',
  NAME: 'name',
  DESCRIPTION: 'description',
  BOARD_ID: 'board_id',
  WORKSPACE_JSON: 'workspace_json',
  CREATED_AT: 'created_at',
  UPDATED_AT: 'updated_at',
};
