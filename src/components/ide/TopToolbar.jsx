import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, LayoutDashboard, Redo2, Save, Settings, Terminal, Undo2, UploadCloud, Usb } from 'lucide-react';
import Button from '../ui/Button.jsx';
import { BOARD_LABEL, useIdeStore } from '../../store/ideStore.js';
import * as Blockly from 'blockly';
import {
  downloadTextFile,
  formatSupabaseUserMessage,
  formatUserSafeError,
  parseHardwareProjectJson,
  slugifyProjectBasename,
} from '../../lib/projectIo.js';
import {
  createCloudProject as createExpressCloudProject,
  deleteCloudProject as deleteExpressCloudProject,
  getCloudProject as getExpressCloudProject,
  listCloudProjects as listExpressCloudProjects,
  updateCloudProject as updateExpressCloudProject,
} from '../../lib/cloudProjectsApi.js';
import {
  deleteSupabaseProject,
  listCloudProjects as listSupabaseCloudProjects,
  loadCloudProject as loadSupabaseCloudProject,
  saveProjectToCloud as saveSupabaseProject,
} from '../../lib/projectCloudService.js';
import {
  getBrowserProject,
  listBrowserProjectsSorted,
  putBrowserProject,
  removeBrowserProject,
} from '../../lib/browserProjectStore.js';
import SettingsModal from './SettingsModal.jsx';
import Esp32MpyProgressModal from './Esp32MpyProgressModal.jsx';
import { mapMpyStepToProgress } from '../../lib/mpyProgressPhases.js';
import { computePersistTarget } from '../../lib/cloudRouting.js';
import { useCloudAuthStore } from '../../store/cloudAuthStore.js';
import { useAuthStore } from '../../store/authStore.js';
import { isSupabaseConfigured } from '../../lib/supabaseClient.js';
import { isDemoSupabaseOnly } from '../../lib/demoSupabaseOnly.js';
import { toast } from '../../lib/toast.js';
import {
  connectWebSerial,
  disconnectWebSerial,
  formatWebSerialError,
  getWebSerialAvailability,
} from '../../lib/webSerialService.js';
import { uploadMicroPythonMainPy } from '../../lib/micropythonSerialUpload.js';
import { clearSessionDraft } from '../../lib/sessionRecoveryStore.js';
import { SERIAL_MSG } from '../../lib/serialUserMessages.js';
import {
  examplesMenuBoardBlurb,
  exportCodeMenuItemTitle,
  exportCodeSuccessToast,
  exportToolbarMenuTitle,
  openSerialMonitorTitle,
  serialConnectButtonTitle,
  serialConnectedLogLine,
  unoUploadGuidanceLog,
  unoUploadGuidanceToast,
  uploadButtonTitle,
} from '../../lib/boardUiCopy.js';

/** @typedef {{ file: string, label: string, boardId: string }} ExampleManifestEntry */
/** @typedef {{ id: string, projectName: string, boardId: string, updatedAt: string, description?: string }} RemoteProjectRow */

function formatUpdatedLabel(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const diff = Date.now() - d.getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} hr ago`;
    if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} days ago`;
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '—';
  }
}

export default function TopToolbar({ workspace, previewCode = '', onAfterProjectImport }) {
  const fileRef = useRef(null);
  const xmlRef = useRef(null);
  const [exampleEntries, setExampleEntries] = useState(/** @type {ExampleManifestEntry[]} */ ([]));
  const [openPickerOpen, setOpenPickerOpen] = useState(false);
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** Upload button label only — serial lock is serialPipelineBusy (shared with Console). */
  const [uploadUiActive, setUploadUiActive] = useState(false);
  /** ESP32 upload progress dialog (not written to Serial Monitor). */
  const [uploadProgressModal, setUploadProgressModal] = useState(
    /** @type {null | { runState: 'running' | 'success' | 'error', phase: string, percent: number, error: string }} */ (null),
  );
  const [pickSupabaseProjects, setPickSupabaseProjects] = useState(/** @type {RemoteProjectRow[]} */ ([]));
  const [pickExpressProjects, setPickExpressProjects] = useState(/** @type {RemoteProjectRow[]} */ ([]));
  const [pickSbLoading, setPickSbLoading] = useState(false);
  const [pickExLoading, setPickExLoading] = useState(false);
  const [pickSbError, setPickSbError] = useState(/** @type {string | null} */ (null));
  const [pickExError, setPickExError] = useState(/** @type {string | null} */ (null));

  const projectName = useIdeStore((s) => s.projectName);
  const setProjectName = useIdeStore((s) => s.setProjectName);
  const description = useIdeStore((s) => s.description);
  const setDescription = useIdeStore((s) => s.setDescription);
  const resetForNewSketch = useIdeStore((s) => s.resetForNewSketch);
  const boardId = useIdeStore((s) => s.boardId);
  const setBoardId = useIdeStore((s) => s.setBoardId);
  const browserProjectId = useIdeStore((s) => s.browserProjectId);
  const setBrowserProjectId = useIdeStore((s) => s.setBrowserProjectId);
  const cloudProjectId = useIdeStore((s) => s.cloudProjectId);
  const setCloudProjectId = useIdeStore((s) => s.setCloudProjectId);
  const persistTarget = useIdeStore((s) => s.persistTarget);
  /** Re-subscribe when Supabase session changes so persistTarget / menus stay in sync after Settings sign-in. */
  const sbUserId = useCloudAuthStore((s) => s.user?.id ?? null);
  const expressSignedIn = useAuthStore((s) => s.isAuthenticated);
  /** In demo mode, hide Express remote project UI and skip loading API project lists. */
  const showExpressRemote = expressSignedIn && !isDemoSupabaseOnly();
  const hasRemoteAccount = persistTarget === 'supabase' || persistTarget === 'express_api';
  const connectState = useIdeStore((s) => s.connectState);
  const setConnectState = useIdeStore((s) => s.setConnectState);
  const appendLog = useIdeStore((s) => s.appendLog);
  const appendSerial = useIdeStore((s) => s.appendSerial);
  const focusSerialMonitorTab = useIdeStore((s) => s.focusSerialMonitorTab);
  const serialBaudRate = useIdeStore((s) => s.serialBaudRate);
  const serialPipelineBusy = useIdeStore((s) => s.serialPipelineBusy);
  const setSerialPipelineBusy = useIdeStore((s) => s.setSerialPipelineBusy);

  async function executeEsp32MicroPythonUpload(code) {
    const st = useIdeStore.getState();
    setUploadProgressModal({ runState: 'running', phase: 'Preparing upload', percent: 0, error: '' });
    focusSerialMonitorTab();
    appendLog('info', SERIAL_MSG.uploadStarted);
    st.setSerialPipelineBusy(true);
    setUploadUiActive(true);
    try {
      await uploadMicroPythonMainPy(code, {
        onStep: (label) => {
          const mapped = mapMpyStepToProgress(label, 'upload');
          setUploadProgressModal((m) => {
            if (!m || m.runState !== 'running') return m;
            return {
              ...m,
              phase: mapped.phase,
              percent: Math.max(m.percent, mapped.percent),
            };
          });
        },
      });
      appendLog(
        'info',
        'Upload: main.py written and exec started — check Serial Monitor for board output; RESET if the port drops.',
      );
      setUploadProgressModal((m) =>
        m ? { ...m, runState: 'success', phase: '', percent: 100, error: '' } : m,
      );
    } catch (e) {
      const msg = formatWebSerialError(e);
      appendLog('warn', `Upload failed: ${msg}`);
      setUploadProgressModal((m) =>
        m
          ? { ...m, runState: 'error', error: msg }
          : { runState: 'error', phase: '', percent: 0, error: msg },
      );
    } finally {
      st.setSerialPipelineBusy(false);
      setUploadUiActive(false);
    }
  }

  const baseUrl = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  const examplesRoot = `${baseUrl}examples/`;
  const brandLogoUrl = `${baseUrl}simats-blox-logo.png`;

  const examplesForBoard = useMemo(
    () => exampleEntries.filter((ex) => ex.boardId === boardId),
    [exampleEntries, boardId],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${examplesRoot}index.json`);
        if (!r.ok) return;
        const j = await r.json();
        if (!cancelled && Array.isArray(j)) setExampleEntries(j);
      } catch {
        /* ignore missing manifest */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examplesRoot]);

  useEffect(() => {
    if (!openPickerOpen && !saveAsOpen && !settingsOpen) return;
    const fn = (e) => {
      if (e.key === 'Escape') {
        setOpenPickerOpen(false);
        setSaveAsOpen(false);
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [openPickerOpen, saveAsOpen, settingsOpen]);

  useEffect(() => {
    if (!openPickerOpen) {
      setPickSupabaseProjects([]);
      setPickExpressProjects([]);
      setPickSbLoading(false);
      setPickExLoading(false);
      setPickSbError(null);
      setPickExError(null);
      return;
    }

    let cancelled = false;

    const loadSupabase = async () => {
      if (!isSupabaseConfigured() || !useCloudAuthStore.getState().user) {
        if (!cancelled) {
          setPickSupabaseProjects([]);
          setPickSbError(null);
          setPickSbLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setPickSbLoading(true);
        setPickSbError(null);
      }
      try {
        const list = await listSupabaseCloudProjects();
        if (!cancelled) setPickSupabaseProjects(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) {
          setPickSupabaseProjects([]);
          const msg = formatSupabaseUserMessage(e);
          setPickSbError(msg);
          appendLog('error', `Could not load Supabase projects: ${msg}`);
          toast('error', msg);
        }
      } finally {
        if (!cancelled) setPickSbLoading(false);
      }
    };

    const loadExpress = async () => {
      if (isDemoSupabaseOnly() || !useAuthStore.getState().isAuthenticated) {
        if (!cancelled) {
          setPickExpressProjects([]);
          setPickExError(null);
          setPickExLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setPickExLoading(true);
        setPickExError(null);
      }
      try {
        const list = await listExpressCloudProjects();
        if (!cancelled) setPickExpressProjects(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) {
          setPickExpressProjects([]);
          const msg = formatUserSafeError(e);
          setPickExError(msg);
          appendLog('error', `Could not load local API projects: ${msg}`);
          toast('error', msg);
        }
      } finally {
        if (!cancelled) setPickExLoading(false);
      }
    };

    void loadSupabase();
    void loadExpress();
    return () => {
      cancelled = true;
    };
  }, [openPickerOpen, sbUserId, showExpressRemote, appendLog]);

  useEffect(() => {
    if (saveAsOpen) setSaveAsName(projectName);
  }, [saveAsOpen, projectName]);

  const applyProjectPayload = (data) => {
    useIdeStore.getState().applyImportPayload(data);
    if (!workspace || !data.blockly) return;
    workspace.clear();
    Blockly.serialization.workspaces.load(data.blockly, workspace, { recordUndo: false });
  };

  /** @param {unknown} data */
  const validateExamplePayload = (data) => {
    const parsed =
      typeof data === 'object' && data !== null
        ? parseHardwareProjectJson(JSON.stringify(data))
        : { ok: false, error: 'Invalid example data.' };
    return parsed;
  };

  const unlinkFromBrowserSave = () => {
    setBrowserProjectId(null);
  };

  const unlinkFromCloudSave = () => {
    setCloudProjectId(null);
  };

  const loadExampleFile = async (file) => {
    if (!workspace) {
      appendLog('info', 'Workspace not ready — try again in a moment.');
      toast('warning', 'Workspace not ready. Try again in a moment.');
      return;
    }
    try {
      const r = await fetch(`${examplesRoot}${file}`);
      if (!r.ok) throw new Error(r.statusText || String(r.status));
      const data = await r.json();
      const check = validateExamplePayload(data);
      if (!check.ok) {
        appendLog('error', `Example file failed validation: ${check.error}`);
        toast('error', check.error || 'Example file is not valid.');
        return;
      }
      applyProjectPayload(check.data);
      unlinkFromBrowserSave();
      unlinkFromCloudSave();
      const exTitle = check.data.projectName ?? file;
      appendLog('info', `Loaded example: ${exTitle} — toolbar title and notes updated from the example.`);
      if (check.data.description) appendLog('info', String(check.data.description));
      appendLog(
        'info',
        'Tip: examples are not linked to Save — use Save or Save As to store your own copy (title and notes are saved with the project).',
      );
      toast('success', `Example loaded — “${exTitle}” (edit title or notes anytime; they save with the project).`);
      onAfterProjectImport?.();
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `Could not load example: ${err}`);
      toast('error', err);
    }
  };

  const downloadJson = (obj, filename) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const buildProjectPayload = () => {
    if (!workspace) return null;
    return {
      ...useIdeStore.getState().getExportPayload(),
      blockly: Blockly.serialization.workspaces.save(workspace),
    };
  };

  /** Save to this browser (localStorage). Clears account slot link so Save won’t overwrite cloud by mistake. */
  const handleSaveBrowser = () => {
    const payload = buildProjectPayload();
    if (!workspace) {
      appendLog('error', 'Save failed: workspace is not ready yet.');
      toast('warning', 'Workspace not ready. Save when the editor has loaded.');
      return;
    }
    if (!payload) return;
    let slotId = browserProjectId;
    if (slotId && !getBrowserProject(slotId)) {
      slotId = null;
      setBrowserProjectId(null);
    }
    try {
      setCloudProjectId(null);
      const id = putBrowserProject({
        ...payload,
        id: slotId || undefined,
      });
      setBrowserProjectId(id);
      appendLog(
        'info',
        `Saved to local browser — "${payload.projectName}" (${BOARD_LABEL[payload.boardId] ?? payload.boardId}). Same device only.`,
      );
      toast('success', 'Saved to this browser.');
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `Save failed: ${err}`);
      toast('error', err);
    }
  };

  /** Primary Save: Supabase → Express API → browser. Uses live session (computePersistTarget), not a stale hook snapshot. */
  const handleSavePrimary = async () => {
    const payload = buildProjectPayload();
    if (!workspace) {
      appendLog('error', 'Save failed: workspace is not ready yet.');
      toast('warning', 'Workspace not ready. Save when the editor has loaded.');
      return;
    }
    if (!payload) return;

    const target = computePersistTarget();
    if (import.meta.env.DEV) {
      appendLog(
        'info',
        `[diag save route] persistTarget=${target} supabaseUser=${!!useCloudAuthStore.getState().user} cloudProjectId=${cloudProjectId ? 'set' : 'none'}`,
      );
    }

    if (target === 'supabase') {
      try {
        const slotId = cloudProjectId;
        const saved = await saveSupabaseProject(slotId ? { ...payload, id: slotId } : payload);
        setCloudProjectId(saved.id);
        setBrowserProjectId(null);
        appendLog(
          'info',
          `Saved to Supabase cloud — "${payload.projectName}" (${BOARD_LABEL[payload.boardId] ?? payload.boardId}).`,
        );
        toast('success', 'Saved to cloud.');
      } catch (e) {
        const err = formatSupabaseUserMessage(e);
        appendLog('error', `Cloud save failed: ${err}`);
        toast('error', err);
      }
      return;
    }

    if (target !== 'express_api') {
      handleSaveBrowser();
      return;
    }

    try {
      const slotId = cloudProjectId;
      if (slotId) {
        await updateExpressCloudProject(slotId, payload);
        appendLog(
          'info',
          `Saved to local API — "${payload.projectName}" (${BOARD_LABEL[payload.boardId] ?? payload.boardId}).`,
        );
        toast('success', 'Saved to local API.');
      } else {
        const created = await createExpressCloudProject(payload);
        setCloudProjectId(created.id);
        setBrowserProjectId(null);
        appendLog(
          'info',
          `Saved to local API — "${payload.projectName}" (${BOARD_LABEL[payload.boardId] ?? payload.boardId}).`,
        );
        toast('success', 'Saved to local API.');
      }
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `Account save failed: ${err}`);
      toast('error', err);
    }
  };

  /** @param {object} merged — full project payload including projectName */
  const saveMergedToBrowser = (merged) => {
    try {
      setCloudProjectId(null);
      const id = putBrowserProject({ ...merged, id: undefined });
      setBrowserProjectId(id);
      setSaveAsOpen(false);
      appendLog(
        'info',
        `Saved to local browser (new project) — "${merged.projectName}". Other slots unchanged.`,
      );
    } catch (e) {
      appendLog('error', `Save As failed: ${formatUserSafeError(e)}`);
    }
  };

  const handleSaveAsSubmit = async () => {
    const payload = buildProjectPayload();
    if (!workspace) {
      appendLog('error', 'Save As failed: workspace is not ready yet.');
      toast('warning', 'Workspace not ready. Save when the editor has loaded.');
      return;
    }
    if (!payload) return;
    const name = saveAsName.trim() || 'Untitled project';
    setProjectName(name);
    const merged = { ...payload, projectName: name };

    const saveAsTarget = computePersistTarget();

    if (saveAsTarget === 'supabase') {
      try {
        const saved = await saveSupabaseProject(merged);
        setCloudProjectId(saved.id);
        setBrowserProjectId(null);
        setSaveAsOpen(false);
        appendLog(
          'info',
          `Saved to Supabase cloud (new project) — "${name}". Previous cloud project unchanged.`,
        );
        toast('success', 'Saved to cloud (new project).');
      } catch (e) {
        const err = formatSupabaseUserMessage(e);
        appendLog('error', `Save As failed: ${err}`);
        toast('error', err);
      }
      return;
    }

    if (saveAsTarget !== 'express_api') {
      saveMergedToBrowser(merged);
      return;
    }

    try {
      const created = await createExpressCloudProject(merged);
      setCloudProjectId(created.id);
      setBrowserProjectId(null);
      setSaveAsOpen(false);
      appendLog(
        'info',
        `Saved to local API (new project) — "${name}". Previous API project unchanged.`,
      );
      toast('success', 'Saved to local API (new project).');
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `Save As failed: ${err}`);
      toast('error', err);
    }
  };

  /** Download .hwblocks.json to the computer. */
  const handleExportProject = () => {
    const payload = buildProjectPayload();
    if (!workspace) {
      appendLog('error', 'Export failed: workspace is not ready yet.');
      toast('warning', 'Workspace not ready. Export when the editor has loaded.');
      return;
    }
    if (!payload) return;
    const base = slugifyProjectBasename(projectName);
    const fn = `${base}.hwblocks.json`;
    downloadJson(payload, fn);
    appendLog(
      'info',
      `Exported project file ${fn} to your device (board: ${BOARD_LABEL[payload.boardId] ?? payload.boardId}).`,
    );
    toast('success', 'Project file exported.');
  };

  const handleImportJson = async (file) => {
    if (!file) return;
    if (!workspace) {
      appendLog('error', 'Import failed: workspace is not ready yet.');
      toast('warning', 'Workspace not ready. Import when the editor has loaded.');
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `Import failed: could not read file (${err}).`);
      toast('error', 'Could not read that file.');
      return;
    }
    const parsed = parseHardwareProjectJson(text);
    if (!parsed.ok) {
      appendLog('error', `Import failed: ${parsed.error}`);
      toast('error', parsed.error || 'Import failed.');
      return;
    }
    const data = parsed.data;
    try {
      applyProjectPayload(data);
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `Import failed: ${err}`);
      toast('error', err);
      return;
    }
    unlinkFromBrowserSave();
    unlinkFromCloudSave();
    const label = data.projectName ?? 'Untitled';
    appendLog(
      'info',
      `Imported "${label}" from file — title, notes, and board updated from the file. Use Save or Save As to store a copy.`,
    );
    toast('success', `Imported “${label}” — toolbar title and notes match the file.`);
    onAfterProjectImport?.();
  };

  const handleExportCode = () => {
    const ext = boardId === 'esp32' ? '.py' : '.ino';
    const base = slugifyProjectBasename(projectName);
    const fn = `${base}${ext}`;
    const body = previewCode ?? '';
    const mime = boardId === 'esp32' ? 'text/x-python;charset=utf-8' : 'text/plain;charset=utf-8';
    downloadTextFile(body, fn, mime);
    appendLog(
      'info',
      `Exported ${boardId === 'esp32' ? 'MicroPython' : 'Arduino sketch'} ${fn} (${BOARD_LABEL[boardId] ?? boardId}).`,
    );
    toast('success', exportCodeSuccessToast(boardId));
  };

  const handleExportXml = () => {
    if (!workspace) return;
    const dom = Blockly.Xml.workspaceToDom(workspace);
    const text = Blockly.Xml.domToPrettyText(dom);
    const safeName = slugifyProjectBasename(projectName, 'workspace');
    const blob = new Blob([text], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.hwblocks.xml`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog('info', `Exported workspace XML as ${safeName}.hwblocks.xml.`);
    toast('info', 'Workspace XML exported.');
  };

  const handleImportXmlFile = async (file) => {
    if (!file || !workspace) return;
    let text;
    try {
      text = await file.text();
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `XML import failed: could not read file (${err}).`);
      toast('error', 'Could not read that file.');
      return;
    }
    let xmlText = text;
    try {
      const j = JSON.parse(text);
      if (j && typeof j === 'object' && typeof j.xml === 'string') xmlText = j.xml;
    } catch {
      /* raw XML */
    }
    try {
      const dom = Blockly.utils.xml.textToDom(xmlText);
      workspace.clear();
      Blockly.Xml.domToWorkspace(dom, workspace);
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `XML import failed: ${err}`);
      toast('error', err);
      return;
    }
    unlinkFromBrowserSave();
    unlinkFromCloudSave();
    appendLog(
      'info',
      'Workspace XML imported — blocks replaced only. Toolbar title, notes, and board were not changed (edit them if this canvas belongs to a different project).',
    );
    toast('success', 'XML imported — blocks updated; title and notes unchanged.');
    onAfterProjectImport?.();
  };

  const handleNew = () => {
    workspace?.clear();
    unlinkFromBrowserSave();
    unlinkFromCloudSave();
    appendLog(
      'info',
      'Clear canvas: blocks removed. Toolbar title, notes, and board are unchanged — use New project for a full reset.',
    );
    onAfterProjectImport?.();
  };

  const handleNewBlocksProject = () => {
    workspace?.clear();
    resetForNewSketch();
    unlinkFromBrowserSave();
    unlinkFromCloudSave();
    clearSessionDraft();
    appendLog(
      'info',
      'New project: blocks cleared; title and notes reset to defaults; board stays as selected (change it in the toolbar if needed).',
    );
    onAfterProjectImport?.();
  };

  const handleOpenBrowserProject = (id) => {
    const row = getBrowserProject(id);
    if (!row || !row.blockly) {
      appendLog('error', 'Could not open that saved project (missing data).');
      toast('error', 'That saved project is incomplete.');
      return;
    }
    try {
      applyProjectPayload(row);
      setBrowserProjectId(row.id);
      setCloudProjectId(null);
      setOpenPickerOpen(false);
      appendLog(
        'info',
        `Opened "${row.projectName}" from this browser — title, notes, and board restored. File → Save updates this slot.`,
      );
      onAfterProjectImport?.();
      toast('success', `Opened “${row.projectName}” from this browser.`);
    } catch (e) {
      const err = formatUserSafeError(e);
      appendLog('error', `Open failed: ${err}`);
      toast('error', err);
    }
  };

  /** @param {'supabase' | 'express_api'} backend */
  const handleOpenRemoteCloudProject = async (id, backend) => {
    if (!workspace) {
      appendLog('error', 'Workspace not ready — try again in a moment.');
      toast('warning', 'Workspace not ready. Try again in a moment.');
      return;
    }
    const isSb = backend === 'supabase';
    try {
      const data = isSb ? await loadSupabaseCloudProject(id) : await getExpressCloudProject(id);
      applyProjectPayload(data);
      setCloudProjectId(id);
      setBrowserProjectId(null);
      setOpenPickerOpen(false);
      const label = data.projectName ?? 'Project';
      if (isSb) {
        appendLog(
          'info',
          `Opened "${label}" from Supabase — toolbar title, notes, and board restored. Save updates this cloud project.`,
        );
      } else {
        appendLog(
          'info',
          `Opened "${label}" from local API — toolbar title, notes, and board restored. Save updates that server project.`,
        );
      }
      onAfterProjectImport?.();
      toast('success', `Opened “${label}”.`);
    } catch (e) {
      const msg = isSb ? formatSupabaseUserMessage(e) : formatUserSafeError(e);
      appendLog('error', `Open failed: ${msg}`);
      toast('error', msg);
    }
  };

  const handleDeleteBrowserProject = (id) => {
    removeBrowserProject(id);
    if (browserProjectId === id) unlinkFromBrowserSave();
    appendLog('info', 'Removed one project from this browser’s saved list.');
    toast('info', 'Removed from this browser’s list.');
  };

  /** @param {'supabase' | 'express_api'} backend */
  const handleDeleteRemoteCloudProject = async (id, backend) => {
    const isSb = backend === 'supabase';
    try {
      if (isSb) await deleteSupabaseProject(id);
      else await deleteExpressCloudProject(id);
      if (cloudProjectId === id) unlinkFromCloudSave();
      if (isSb) setPickSupabaseProjects((prev) => prev.filter((p) => p.id !== id));
      else setPickExpressProjects((prev) => prev.filter((p) => p.id !== id));
      appendLog(
        'info',
        isSb
          ? 'Removed one project from your cloud account (Supabase).'
          : 'Removed one project from your local API account.',
      );
      toast('info', isSb ? 'Removed from cloud.' : 'Removed from local API.');
    } catch (e) {
      const msg = isSb ? formatSupabaseUserMessage(e) : formatUserSafeError(e);
      appendLog('error', `Remove failed: ${msg}`);
      toast('error', msg);
    }
  };

  const browserList = openPickerOpen ? listBrowserProjectsSorted() : [];

  /** @param {RemoteProjectRow} p @param {'supabase' | 'express_api'} backend */
  const renderRemoteProjectCard = (p, backend) => {
    const desc = (p.description ?? '').trim();
    const cloudKind = backend === 'supabase' ? 'Supabase cloud' : 'Local API';
    const accent = backend === 'supabase' ? 'text-emerald-300/85' : 'text-sky-300/85';
    return (
      <li key={`${backend}-${p.id}`} className="list-none">
        <div className="rounded-lg border border-studio-border/70 bg-[#23272e] px-3 py-2.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-slate-100">{p.projectName || 'Untitled'}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                <span className={accent}>{cloudKind}</span>
                <span className="text-slate-600"> · </span>
                <span>{BOARD_LABEL[p.boardId] ?? p.boardId}</span>
                <span className="text-slate-600"> · </span>
                <span>Updated {formatUpdatedLabel(p.updatedAt)}</span>
              </p>
              {desc ? (
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{desc}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
              <Button
                variant="primary"
                className="!px-2.5 !py-1 !text-[11px]"
                type="button"
                onClick={() => void handleOpenRemoteCloudProject(p.id, backend)}
              >
                Open
              </Button>
              <Button
                variant="ghost"
                className="!px-2 !py-1 !text-[11px] text-red-300/90 hover:bg-red-950/35"
                type="button"
                title={backend === 'supabase' ? 'Remove from Supabase' : 'Remove from local API'}
                onClick={() => void handleDeleteRemoteCloudProject(p.id, backend)}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      <header className="flex min-h-11 shrink-0 items-center gap-0 border-b border-studio-border/90 bg-[#1e2228] px-2 py-0.5 sm:px-3">
        <div
          className="flex shrink-0 items-center gap-2 border-r border-studio-border/80 pr-2 sm:gap-2.5 sm:pr-3"
          title="SIMATS BLOX — hardware block workspace"
        >
          <div
            className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg ring-1 ring-white/[0.08]"
            aria-hidden
          >
            {/* No mix-blend-multiply — it multiplies the logo into #1e2228 and hides light/white marks */}
            <img
              src={brandLogoUrl}
              alt=""
              width={30}
              height={30}
              decoding="async"
              className="h-7 w-7 object-contain object-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
            />
          </div>
          <span className="min-w-0 truncate text-[11px] font-semibold leading-none tracking-tight text-slate-100 sm:text-sm">
            SIMATS BLOX
          </span>
        </div>

        <nav className="flex shrink-0 items-center gap-0 border-r border-studio-border/80 px-1.5 text-xs sm:px-2.5 sm:text-[11px]">
          <ToolbarMenu label="File">
            <button
              type="button"
              className="menu-item"
              onClick={handleNew}
              title="Remove all blocks only — keeps toolbar title, notes, and board; unlinks Save slot"
            >
              Clear canvas
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={handleNewBlocksProject}
              title="Reset title and notes to defaults, clear blocks, unlink Save — board stays on your current selection"
            >
              New project
            </button>
            <div className="my-1 h-px bg-studio-border/60" role="separator" />
            <button
              type="button"
              className="menu-item"
              onClick={() => setOpenPickerOpen(true)}
              title="Browse Supabase cloud, local API, and this browser’s saved projects"
            >
              Open…
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => void handleSavePrimary()}
              title={
                persistTarget === 'supabase'
                  ? 'Save blocks, title, and notes to your Supabase project. Use “Save to this browser only” for localStorage only.'
                  : persistTarget === 'express_api'
                    ? 'Save blocks, title, and notes to your local API (server running). Use “Save to this browser only” for localStorage only.'
                    : 'Save blocks, title, and notes in this browser only'
              }
            >
              Save
              {persistTarget === 'supabase' ? ' (cloud)' : persistTarget === 'express_api' ? ' (API)' : ''}
            </button>
            {hasRemoteAccount ? (
              <button
                type="button"
                className="menu-item"
                onClick={handleSaveBrowser}
                title="Save blocks, title, and notes in this browser only — unlinks the current cloud/API slot until you save to your account again."
              >
                Save to this browser only
              </button>
            ) : null}
            <button
              type="button"
              className="menu-item"
              onClick={() => setSaveAsOpen(true)}
              title={
                persistTarget === 'supabase'
                  ? 'New cloud project with current blocks, title, and notes (current cloud slot unchanged until you switch)'
                  : persistTarget === 'express_api'
                    ? 'New API project with current blocks, title, and notes (current API slot unchanged until you switch)'
                    : 'New browser slot with current blocks, title, and notes'
              }
            >
              Save As…
            </button>
            <div className="my-1 h-px bg-studio-border/60" role="separator" />
            <button
              type="button"
              className="menu-item"
              onClick={handleExportProject}
              title="Download .hwblocks.json (blocks, title, notes, board) to your computer"
            >
              Export Project…
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={handleExportCode}
              title={exportCodeMenuItemTitle(boardId)}
            >
              Export Code{boardId === 'esp32' ? ' (.py)' : ' (.ino)'}
            </button>
            <div className="my-1 h-px bg-studio-border/60" role="separator" />
            <button type="button" className="menu-item" onClick={() => fileRef.current?.click()}>
              Import Project… <span className="text-studio-muted">(.json)</span>
            </button>
            <button type="button" className="menu-item" onClick={() => xmlRef.current?.click()}>
              Import XML…
            </button>
            <div className="my-1 h-px bg-studio-border/60" role="separator" />
            <button type="button" className="menu-item" onClick={handleExportXml}>
              Export Workspace XML…
            </button>
          </ToolbarMenu>
          <ToolbarMenu label="Edit">
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                workspace?.undo(false);
              }}
            >
              Undo
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                workspace?.undo(true);
              }}
            >
              Redo
            </button>
          </ToolbarMenu>
          {exampleEntries.length > 0 ? (
            <ToolbarMenu
              label="Examples"
              buttonTitle={`Starter projects for ${BOARD_LABEL[boardId]} — change the board selector for the other target.`}
            >
              <div className="border-b border-studio-border/50 px-3 py-1.5">
                <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  {BOARD_LABEL[boardId]}
                </div>
                <p className="mt-0.5 text-[9px] leading-snug text-studio-muted">{examplesMenuBoardBlurb(boardId)}</p>
              </div>
              {examplesForBoard.length > 0 ? (
                examplesForBoard.map((ex) => (
                  <button
                    key={ex.file}
                    type="button"
                    className="menu-item"
                    title={`Load “${ex.label}” (${BOARD_LABEL[ex.boardId] ?? ex.boardId})`}
                    onClick={() => void loadExampleFile(ex.file)}
                  >
                    {ex.label}
                  </button>
                ))
              ) : (
                <div
                  className="cursor-default px-3 py-2 text-left text-[11px] leading-snug text-studio-muted"
                  role="note"
                >
                  No examples for this board yet.
                </div>
              )}
            </ToolbarMenu>
          ) : null}
        </nav>

        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handleImportJson(f);
          }}
        />
        <input
          ref={xmlRef}
          type="file"
          accept=".xml,.json,text/xml"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handleImportXmlFile(f);
          }}
        />

        <div
          className="flex shrink-0 items-center border-r border-studio-border/80 px-2 sm:px-3"
          title="Target board — Arduino Uno (C++ / Arduino IDE) or ESP32 (MicroPython)"
        >
          <div className="relative">
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="appearance-none rounded-md border border-studio-border/90 bg-[#181b20] py-1 pl-2 pr-7 text-[11px] text-slate-100 sm:text-xs"
              aria-label="Target board"
            >
              <option value="arduino_uno">{BOARD_LABEL.arduino_uno}</option>
              <option value="esp32">{BOARD_LABEL.esp32}</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 border-r border-studio-border/80 px-2 sm:gap-1.5 sm:px-3">
          <Button
            variant="default"
            className="!px-2 !py-1 !text-[11px]"
            title={serialConnectButtonTitle(boardId, {
              connectState,
              serialBaudRate,
              webSerialOk: getWebSerialAvailability().ok,
              webSerialMessage: getWebSerialAvailability().message,
            })}
            aria-label={
              connectState === 'connected' ? 'Disconnect serial' : connectState === 'connecting' ? 'Connecting' : 'Connect serial'
            }
            disabled={
              connectState === 'connecting' ||
              (connectState === 'disconnected' && serialPipelineBusy)
            }
            onClick={() => {
              void (async () => {
                const st = useIdeStore.getState();
                if (st.connectState === 'connecting') return;
                if (st.connectState === 'connected') {
                  st.setSerialPipelineBusy(true);
                  try {
                    await disconnectWebSerial();
                  } catch {
                    /* ignore */
                  } finally {
                    st.setSerialPipelineBusy(false);
                    st.setConnectState('disconnected');
                  }
                  st.appendLog('info', 'USB serial disconnected.');
                  st.appendSerial('[Serial] Disconnected — use Connect when ready.\n');
                  return;
                }
                const av = getWebSerialAvailability();
                if (!av.ok) {
                  toast('error', av.message);
                  appendLog('warn', av.message);
                  return;
                }
                st.setConnectState('connecting');
                st.setSerialPipelineBusy(true);
                const baud = st.serialBaudRate;
                try {
                  await connectWebSerial(
                    baud,
                    (line) => useIdeStore.getState().appendSerial(line),
                    () => {
                      const s = useIdeStore.getState();
                      s.setConnectState('disconnected');
                      s.setSerialPipelineBusy(false);
                      toast('info', SERIAL_MSG.deviceDisconnected);
                      s.appendLog('warn', SERIAL_MSG.deviceDisconnected);
                      s.appendSerial(`[Serial] ${SERIAL_MSG.deviceDisconnected}\n`);
                    },
                  );
                  st.setConnectState('connected');
                  appendLog('info', serialConnectedLogLine(boardId, baud));
                  toast('success', 'Connected — serial session open.');
                  focusSerialMonitorTab();
                } catch (e) {
                  st.setConnectState('disconnected');
                  const msg = formatWebSerialError(e);
                  toast('error', msg);
                  appendLog('warn', `Serial: ${msg}`);
                } finally {
                  st.setSerialPipelineBusy(false);
                }
              })();
            }}
          >
            <Usb className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {connectState === 'connected' ? 'Disconnect' : connectState === 'connecting' ? 'Connecting…' : 'Connect'}
            </span>
          </Button>
          <Button
            variant="primary"
            className="!px-2 !py-1 !text-[11px]"
            title={uploadButtonTitle(boardId, connectState, serialPipelineBusy, uploadProgressModal !== null)}
            aria-label={boardId === 'esp32' ? 'Upload MicroPython to main.py' : 'Upload (Arduino Uno — use Arduino IDE)'}
            disabled={
              serialPipelineBusy || connectState === 'connecting' || uploadProgressModal !== null
            }
            onClick={() => {
              void (async () => {
                const st = useIdeStore.getState();
                if (st.serialPipelineBusy || st.connectState === 'connecting') return;

                if (st.boardId !== 'esp32') {
                  appendLog('info', unoUploadGuidanceLog());
                  toast('info', unoUploadGuidanceToast());
                  return;
                }

                if (st.connectState !== 'connected') {
                  toast('error', SERIAL_MSG.notConnected);
                  appendLog('warn', `Upload: ${SERIAL_MSG.notConnected}`);
                  return;
                }

                const code = (previewCode ?? '').trim();
                if (!code) {
                  const msg = 'No MicroPython code in the preview — add blocks or check the board target.';
                  toast('error', msg);
                  appendLog('warn', msg);
                  return;
                }

                await executeEsp32MicroPythonUpload(code);
              })();
            }}
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {uploadProgressModal?.runState === 'running' || uploadUiActive ? 'Uploading…' : 'Upload'}
            </span>
          </Button>
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 px-2 sm:gap-2.5 sm:px-3">
          <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
            <input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="min-w-0 w-full flex-1 rounded-md border border-studio-border/90 bg-[#181b20] px-2 py-1 text-[11px] text-slate-100 placeholder:text-slate-600 focus:border-studio-accent/50 focus:outline-none focus:ring-1 focus:ring-studio-accent/25 sm:min-w-[8rem] sm:text-xs lg:min-w-[10rem]"
              placeholder="Project title"
              title="Project title — saved with Save, Save As, and Export Project (.json); leading/trailing spaces are trimmed when saving"
              aria-label="Project title"
            />
            <details className="min-w-0 w-full sm:w-auto sm:max-w-[20rem] lg:max-w-[22rem]">
              <summary className="cursor-pointer list-none text-[10px] text-studio-muted hover:text-slate-400 [&::-webkit-details-marker]:hidden">
                Notes (optional)
              </summary>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 min-w-0 w-full rounded-md border border-studio-border/60 bg-[#14171b]/90 px-2 py-1 text-[10px] text-slate-400 placeholder:text-slate-600/80 focus:border-studio-border/50 focus:outline-none focus:ring-1 focus:ring-studio-accent/15 sm:text-[11px]"
                placeholder="Short notes for this project…"
                title="Optional notes — stored with the title when you Save or Export Project"
                aria-label="Project notes"
              />
            </details>
          </div>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button
              variant="default"
              className="!px-2 !py-1 !text-[11px]"
              onClick={() => void handleSavePrimary()}
              title={
                persistTarget === 'supabase'
                  ? 'Save blocks, title, and notes to Supabase. File → Save to this browser only for local only.'
                  : persistTarget === 'express_api'
                    ? 'Save blocks, title, and notes to local API. File → Save to this browser only for local only.'
                    : 'Save blocks, title, and notes in this browser only'
              }
            >
              <Save className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Save</span>
            </Button>
            <ToolbarExportMenu
              boardId={boardId}
              onExportProject={handleExportProject}
              onExportCode={handleExportCode}
              onExportXml={handleExportXml}
            />
            <div
              className="ml-0.5 flex items-center rounded-md border border-studio-border/60 bg-[#14171b]/80 p-px"
              title="Edit → Undo / Redo"
            >
              <button
                type="button"
                className="rounded px-1.5 py-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200 disabled:opacity-30"
                title="Undo"
                aria-label="Undo"
                disabled={!workspace}
                onClick={() => workspace?.undo(false)}
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
              <span className="h-3 w-px bg-studio-border/70" aria-hidden />
              <button
                type="button"
                className="rounded px-1.5 py-1 text-slate-500 transition-colors hover:bg-white/10 hover:text-slate-200 disabled:opacity-30"
                title="Redo"
                aria-label="Redo"
                disabled={!workspace}
                onClick={() => workspace?.undo(true)}
              >
                <Redo2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 border-l border-studio-border/80 pl-2 sm:gap-1 sm:pl-3">
          <Link
            to="/devices"
            className="inline-flex items-center gap-1.5 rounded-md border border-studio-border/70 bg-[#1a1d22]/95 px-2 py-1 text-[11px] font-medium text-slate-200 shadow-sm hover:border-studio-border hover:bg-[#232830] hover:text-white"
            title={
              isDemoSupabaseOnly()
                ? sbUserId
                  ? 'Live sensors & device list (Supabase account)'
                  : 'Devices — sign in under Settings (Supabase) first'
                : expressSignedIn || sbUserId
                  ? 'Live sensors & device list (same account on other browsers)'
                  : 'Devices — sign in under Settings first'
            }
          >
            <LayoutDashboard className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
            <span className="hidden min-[420px]:inline">Devices</span>
          </Link>
          <button
            type="button"
            className="rounded p-1.5 text-slate-600 hover:bg-white/5 hover:text-slate-400"
            title={openSerialMonitorTitle(boardId)}
            aria-label="Open Serial Monitor"
            onClick={() => focusSerialMonitorTab()}
          >
            <Terminal className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="rounded p-1.5 text-studio-muted hover:bg-white/5 hover:text-slate-200"
            title="Settings — account and IDE options"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </button>
        </div>
      </header>

      {openPickerOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="open-project-title"
          onClick={() => setOpenPickerOpen(false)}
        >
          <div
            className="max-h-[min(32rem,85vh)] w-full max-w-lg overflow-hidden rounded-lg border border-studio-border bg-[#2a2f36] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-studio-border px-3 py-2.5">
              <h2 id="open-project-title" className="text-sm font-semibold text-slate-100">
                Open project
              </h2>
              <p className="mt-1 text-[11px] leading-relaxed text-studio-muted">
                {isDemoSupabaseOnly()
                  ? 'Demo mode: Supabase cloud and this browser only.'
                  : 'Supabase cloud, local API (when signed in), and this browser are separate places.'}{' '}
                <span className="text-slate-500">
                  Active Save target:{' '}
                  <span className="font-medium text-slate-400">
                    {persistTarget === 'supabase'
                      ? 'Supabase'
                      : persistTarget === 'express_api'
                        ? 'Local API'
                        : 'This browser only'}
                  </span>
                  . File → Export Project always downloads a file.
                </span>
              </p>
            </div>
            <div className="max-h-[min(26rem,65vh)] overflow-y-auto p-3">
              {isSupabaseConfigured() ? (
                <section className="mb-5">
                  <div className="mb-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Supabase cloud
                    </h3>
                    <p className="mt-0.5 text-[10px] text-studio-muted">
                      {sbUserId
                        ? 'Projects stored in your Supabase database for this account.'
                        : 'Sign in under Settings → Account (Supabase) to load cloud saves here.'}
                    </p>
                  </div>
                  {!sbUserId ? (
                    <div className="rounded-lg border border-dashed border-studio-border/55 bg-[#1e2228]/90 px-3 py-3.5 text-center text-[11px] text-slate-500">
                      No Supabase session — sign in to see cloud projects.
                    </div>
                  ) : pickSbLoading ? (
                    <p className="py-3 text-center text-[11px] text-studio-muted">Loading cloud projects…</p>
                  ) : pickSbError ? (
                    <div className="rounded-lg border border-red-900/40 bg-red-950/25 px-3 py-2.5 text-[11px] text-red-200/90">
                      {pickSbError}
                    </div>
                  ) : pickSupabaseProjects.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-studio-border/55 bg-[#1e2228]/90 px-3 py-3.5 text-center text-[11px] text-slate-500">
                      No cloud projects yet. Use <span className="text-slate-400">File → Save</span> while signed in to
                      create one.
                    </div>
                  ) : (
                    <ul className="space-y-2">{pickSupabaseProjects.map((p) => renderRemoteProjectCard(p, 'supabase'))}</ul>
                  )}
                </section>
              ) : null}

              {!isDemoSupabaseOnly() ? (
                <section className="mb-5">
                  <div className="mb-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Local API</h3>
                    <p className="mt-0.5 text-[10px] text-studio-muted">
                      SQLite projects via <span className="font-mono text-slate-500">npm run server</span> or{' '}
                      <span className="font-mono text-slate-500">npm run dev:full</span>. Sign in under Settings.
                    </p>
                  </div>
                  {!showExpressRemote ? (
                    <div className="rounded-lg border border-dashed border-studio-border/55 bg-[#1e2228]/90 px-3 py-3.5 text-center text-[11px] text-slate-500">
                      Not signed in to the local API — use Settings → Local API account when the server is running.
                    </div>
                  ) : pickExLoading ? (
                    <p className="py-3 text-center text-[11px] text-studio-muted">Loading API projects…</p>
                  ) : pickExError ? (
                    <div className="rounded-lg border border-red-900/40 bg-red-950/25 px-3 py-2.5 text-[11px] text-red-200/90">
                      {pickExError}
                    </div>
                  ) : pickExpressProjects.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-studio-border/55 bg-[#1e2228]/90 px-3 py-3.5 text-center text-[11px] text-slate-500">
                      No API projects yet. Save while signed in to the local API to create one.
                    </div>
                  ) : (
                    <ul className="space-y-2">{pickExpressProjects.map((p) => renderRemoteProjectCard(p, 'express_api'))}</ul>
                  )}
                </section>
              ) : null}

              <section>
                <div className="mb-2">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">This browser</h3>
                  <p className="mt-0.5 text-[10px] text-studio-muted">
                    Saved in localStorage on this device only — not synced to cloud or API.
                  </p>
                </div>
                {browserList.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-studio-border/55 bg-[#1e2228]/90 px-3 py-3.5 text-center text-[11px] text-slate-500">
                    No browser saves yet. Use <span className="text-slate-400">File → Save to this browser only</span> or{' '}
                    <span className="text-slate-400">Save As…</span>.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {browserList.map((p) => {
                      const desc = (p.description ?? '').trim();
                      return (
                        <li key={p.id} className="list-none">
                          <div className="rounded-lg border border-studio-border/70 bg-[#23272e] px-3 py-2.5">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-medium text-slate-100">
                                  {p.projectName || 'Untitled'}
                                </p>
                                <p className="mt-0.5 text-[10px] text-slate-500">
                                  <span className="text-amber-200/75">This device</span>
                                  <span className="text-slate-600"> · </span>
                                  <span>{BOARD_LABEL[p.boardId] ?? p.boardId}</span>
                                  <span className="text-slate-600"> · </span>
                                  <span>Updated {formatUpdatedLabel(p.updatedAt)}</span>
                                </p>
                                {desc ? (
                                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-400">{desc}</p>
                                ) : null}
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5 self-end sm:self-start">
                                <Button
                                  variant="primary"
                                  className="!px-2.5 !py-1 !text-[11px]"
                                  type="button"
                                  onClick={() => handleOpenBrowserProject(p.id)}
                                >
                                  Open
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="!px-2 !py-1 !text-[11px] text-red-300/90 hover:bg-red-950/35"
                                  type="button"
                                  title="Remove from this browser"
                                  onClick={() => handleDeleteBrowserProject(p.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
            <div className="flex justify-end border-t border-studio-border px-3 py-2">
              <Button variant="ghost" className="!text-xs" onClick={() => setOpenPickerOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {saveAsOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-as-title"
          onClick={() => setSaveAsOpen(false)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-lg border border-studio-border bg-[#2a2f36] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-studio-border px-3 py-2">
              <h2 id="save-as-title" className="text-sm font-semibold text-slate-100">
                Save As
                {persistTarget === 'supabase'
                  ? ' — cloud (Supabase)'
                  : persistTarget === 'express_api'
                    ? ' — local API'
                    : ' — this browser'}
              </h2>
              <p className="mt-0.5 text-[11px] text-studio-muted">
                {persistTarget === 'supabase'
                  ? 'Creates a new row in Supabase. Your previous cloud project stays unchanged.'
                  : persistTarget === 'express_api'
                    ? 'Creates a new project on the local API server. The previous API project stays unchanged.'
                    : 'Creates a new slot in local storage. Does not replace your other saved projects.'}
              </p>
            </div>
            <div className="p-3">
              <label className="mb-1 block text-[11px] text-studio-muted" htmlFor="save-as-name">
                Project name
              </label>
              <input
                id="save-as-name"
                value={saveAsName}
                onChange={(e) => setSaveAsName(e.target.value)}
                className="w-full rounded border border-studio-border bg-[#1b1f24] px-2 py-1.5 text-xs text-slate-100 focus:border-studio-accent/60 focus:outline-none focus:ring-1 focus:ring-studio-accent/30"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-studio-border px-3 py-2">
              <Button variant="ghost" className="!text-xs" onClick={() => setSaveAsOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" className="!text-xs" onClick={() => void handleSaveAsSubmit()}>
                Save As
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Esp32MpyProgressModal
        open={uploadProgressModal !== null}
        title="Upload to ESP32"
        phase={uploadProgressModal?.phase ?? ''}
        percent={uploadProgressModal?.percent ?? 0}
        runState={uploadProgressModal?.runState ?? 'running'}
        errorMessage={uploadProgressModal?.error ?? ''}
        successMessage="Uploaded successfully"
        autoCloseSuccessMs={1800}
        onClose={() => setUploadProgressModal(null)}
        onRetry={() => {
          const code = (previewCode ?? '').trim();
          if (code) void executeEsp32MicroPythonUpload(code);
        }}
      />

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}

function ToolbarMenu({ label, children, buttonTitle }) {
  return (
    <div className="group relative inline-block">
      <button
        type="button"
        title={buttonTitle}
        className="flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 sm:text-xs"
      >
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <div className="invisible absolute left-0 top-full z-[120] min-w-[14rem] pt-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="rounded border border-studio-border bg-[#2a2f36] py-1 shadow-lg">{children}</div>
      </div>
    </div>
  );
}

function ToolbarExportMenu({ boardId, onExportProject, onExportCode, onExportXml }) {
  const codeLabel = boardId === 'esp32' ? 'MicroPython (.py)' : 'Arduino sketch (.ino)';
  return (
    <div className="group relative inline-block">
      <button
        type="button"
        className="flex items-center gap-0.5 rounded-md px-2 py-1 text-[11px] font-medium text-slate-400 hover:bg-white/[0.06] hover:text-slate-100 sm:text-xs"
        title={exportToolbarMenuTitle(boardId)}
      >
        Export
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      <div className="invisible absolute right-0 top-full z-[120] min-w-[12rem] pt-1 opacity-0 transition-all group-hover:visible group-hover:opacity-100">
        <div className="rounded border border-studio-border bg-[#2a2f36] py-1 shadow-lg">
          <button type="button" className="menu-item w-full text-left" onClick={onExportProject}>
            Project (.json)
          </button>
          <button
            type="button"
            className="menu-item w-full text-left"
            onClick={onExportCode}
            title={exportCodeMenuItemTitle(boardId)}
          >
            {codeLabel}
          </button>
          <button type="button" className="menu-item w-full text-left" onClick={onExportXml}>
            Workspace XML
          </button>
        </div>
      </div>
    </div>
  );
}
