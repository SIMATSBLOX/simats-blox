import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import TopToolbar from './TopToolbar.jsx';
import CategoryIconRail from './CategoryIconRail.jsx';
import ToolboxPanelTabs from './ToolboxPanelTabs.jsx';
import LeftWorkspaceStack from './LeftWorkspaceStack.jsx';
import WorkspacePanel from './WorkspacePanel.jsx';
import CodePreviewPanel from './CodePreviewPanel.jsx';
import ConsolePanel from './ConsolePanel.jsx';
import ResizeHandle from './ResizeHandle.jsx';
import SessionRecoveryModal from './SessionRecoveryModal.jsx';
import { buildSketch } from '../../blockly/generators/arduinoGenerator.js';
import { buildMicroPythonSketch } from '../../blockly/generators/micropythonGenerator.js';
import { useIdeStore } from '../../store/ideStore.js';
import { flushSessionAutosave, scheduleSessionAutosave } from '../../lib/sessionAutosave.js';
import {
  clearSessionDraft,
  isSessionDraftMeaningful,
  readSessionDraftRaw,
  validateSessionDraft,
} from '../../lib/sessionRecoveryStore.js';
import { toast } from '../../lib/toast.js';

const LS_CODE = 'hw-ide-code-w';
const LS_CONSOLE = 'hw-ide-console-h';
const LS_MOBILE_CAT = 'hw-ide-mobile-cat-h';
const LS_MOBILE_CODE = 'hw-ide-mobile-code-h';

const WORKSPACE_CHROME = {
  rootClassName: 'rounded-none border-0',
  hostClassName: 'blockly-studio-host',
};

function mobileToolboxMax() {
  if (typeof window === 'undefined') return 360;
  return Math.min(380, Math.round(window.innerHeight * 0.48));
}

function mobileCodeMax() {
  if (typeof window === 'undefined') return 320;
  return Math.min(360, Math.round(window.innerHeight * 0.42));
}

function readNum(key, fallback) {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export default function IDEStudio() {
  const [workspace, setWorkspace] = useState(null);
  const [code, setCode] = useState('');
  const [leftToolboxTab, setLeftToolboxTab] = useState(/** @type {'blocks' | 'code'} */ ('blocks'));
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryDraftMeta, setRecoveryDraftMeta] = useState(/** @type {object | null} */ (null));
  const boardId = useIdeStore((s) => s.boardId);
  const timerRef = useRef(0);
  const workspaceRef = useRef(/** @type {import('blockly/core/workspace').WorkspaceSvg | null} */ (null));
  const recoveryHandledRef = useRef(false);
  const pendingRecoveryRef = useRef(/** @type {object | null} */ (null));

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  const [codeW, setCodeW] = useState(() => clamp(readNum(LS_CODE, 300), 200, 640));
  const [consoleH, setConsoleH] = useState(() => clamp(readNum(LS_CONSOLE, 168), 96, 480));
  const consoleHRef = useRef(consoleH);
  consoleHRef.current = consoleH;

  const consoleRowAbsoluteResize = useMemo(
    () => ({
      getHeight: () => consoleHRef.current,
      setHeight: setConsoleH,
      clamp: (h) => {
        const max =
          typeof window !== 'undefined' ? Math.min(640, Math.round(window.innerHeight * 0.58)) : 480;
        return clamp(h, 96, max);
      },
    }),
    [],
  );

  const [mobileCatH, setMobileCatH] = useState(() =>
    clamp(readNum(LS_MOBILE_CAT, 120), 88, mobileToolboxMax()),
  );
  const [mobileCodeH, setMobileCodeH] = useState(() =>
    clamp(readNum(LS_MOBILE_CODE, 168), 100, mobileCodeMax()),
  );

  useEffect(() => {
    const m = window.matchMedia('(min-width: 768px)');
    const fn = () => setIsDesktop(m.matches);
    fn();
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CODE, String(codeW));
    } catch {
      /* ignore */
    }
  }, [codeW]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_CONSOLE, String(consoleH));
    } catch {
      /* ignore */
    }
  }, [consoleH]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_MOBILE_CAT, String(mobileCatH));
    } catch {
      /* ignore */
    }
  }, [mobileCatH]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_MOBILE_CODE, String(mobileCodeH));
    } catch {
      /* ignore */
    }
  }, [mobileCodeH]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    if (!workspace || recoveryHandledRef.current) return;
    recoveryHandledRef.current = true;

    const raw = readSessionDraftRaw();
    if (!raw) return;

    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      clearSessionDraft();
      return;
    }
    if (!validateSessionDraft(data)) {
      clearSessionDraft();
      return;
    }
    if (!isSessionDraftMeaningful(data)) {
      clearSessionDraft();
      return;
    }
    pendingRecoveryRef.current = data;
    setRecoveryDraftMeta({
      projectName: data.projectName,
      savedAt: data.savedAt,
      description: data.description,
    });
    setRecoveryOpen(true);
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return undefined;
    let last = {
      projectName: useIdeStore.getState().projectName,
      description: useIdeStore.getState().description,
      boardId: useIdeStore.getState().boardId,
    };
    const unsub = useIdeStore.subscribe((s) => {
      const next = { projectName: s.projectName, description: s.description, boardId: s.boardId };
      if (
        next.projectName === last.projectName &&
        next.description === last.description &&
        next.boardId === last.boardId
      ) {
        return;
      }
      last = next;
      scheduleSessionAutosave(workspace);
    });
    return unsub;
  }, [workspace]);

  useEffect(() => {
    const flush = () => {
      flushSessionAutosave(workspaceRef.current);
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', flush);
    };
  }, []);

  useEffect(() => {
    if (leftToolboxTab !== 'blocks' || !workspace) return;
    const t = window.setTimeout(() => {
      try {
        Blockly.svgResize(workspace);
      } catch {
        /* ignore */
      }
    }, 80);
    return () => window.clearTimeout(t);
  }, [leftToolboxTab, workspace]);

  const onCodeDrag = useCallback((d) => {
    setCodeW((w) => clamp(w - d, 200, 640));
  }, []);

  const onConsoleDrag = useCallback((d) => {
    setConsoleH((h) => {
      const max =
        typeof window !== 'undefined' ? Math.min(640, Math.round(window.innerHeight * 0.58)) : 480;
      // Pointer Y increases downward: positive d → taller Log/Serial panel.
      return clamp(h + d, 96, max);
    });
  }, []);

  const onMobileCatDrag = useCallback((d) => {
    setMobileCatH((h) => clamp(h + d, 88, mobileToolboxMax()));
  }, []);

  const onMobileCodeDrag = useCallback((d) => {
    setMobileCodeH((h) => clamp(h + d, 100, mobileCodeMax()));
  }, []);

  const safeCodegen = useCallback((ws, board) => {
    if (!ws) {
      setCode('');
      return;
    }
    try {
      if (board === 'esp32') {
        setCode(buildMicroPythonSketch(ws));
      } else {
        setCode(buildSketch(ws, board));
      }
    } catch (err) {
      console.error(err);
      setCode(
        `// Code preview error (workspace may be reloading). Try refreshing.\n// ${String(err?.message || err)}`,
      );
    }
  }, []);

  const runCodegen = useCallback(
    (ws) => {
      if (!ws) return;
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        safeCodegen(ws, useIdeStore.getState().boardId);
      }, 120);
    },
    [safeCodegen],
  );

  useEffect(() => {
    if (workspace) {
      safeCodegen(workspace, boardId);
    } else {
      setCode('');
    }
  }, [boardId, workspace, safeCodegen]);

  const workspacePanelProps = {
    onWorkspaceReady: (ws) => {
      setWorkspace(ws);
      if (ws) runCodegen(ws);
      else setCode('');
    },
    onCodeDirty: (ws) => {
      runCodegen(ws);
      scheduleSessionAutosave(ws);
    },
    ...WORKSPACE_CHROME,
  };

  const handleAfterProjectImport = useCallback(() => {
    const ws = workspace;
    if (!ws) return;
    queueMicrotask(() => {
      try {
        Blockly.svgResize(ws);
      } catch {
        /* ignore */
      }
      const bid = useIdeStore.getState().boardId;
      safeCodegen(ws, bid);
      scheduleSessionAutosave(ws);
    });
  }, [workspace, safeCodegen]);

  const handleRecoveryRestore = useCallback(() => {
    const data = pendingRecoveryRef.current;
    const ws = workspaceRef.current;
    if (!data || !ws) {
      setRecoveryOpen(false);
      setRecoveryDraftMeta(null);
      return;
    }
    try {
      const st = useIdeStore.getState();
      st.setBrowserProjectId(null);
      st.setCloudProjectId(null);
      st.applyImportPayload(data);
      ws.clear();
      Blockly.serialization.workspaces.load(data.blockly, ws, { recordUndo: false });
      pendingRecoveryRef.current = null;
      setRecoveryOpen(false);
      setRecoveryDraftMeta(null);
      clearSessionDraft();
      const bid = useIdeStore.getState().boardId;
      safeCodegen(ws, bid);
      flushSessionAutosave(ws);
      queueMicrotask(() => {
        try {
          Blockly.svgResize(ws);
        } catch {
          /* ignore */
        }
      });
      st.appendLog('info', 'Recovered your last unsaved session from this browser.');
      toast('success', 'Recovered your last session.');
    } catch (e) {
      console.error(e);
      clearSessionDraft();
      pendingRecoveryRef.current = null;
      setRecoveryOpen(false);
      setRecoveryDraftMeta(null);
      useIdeStore.getState().appendLog('error', 'Could not restore session backup — it was removed.');
      toast('error', 'Recovery failed — backup discarded.');
    }
  }, [safeCodegen]);

  const handleRecoveryDiscard = useCallback(() => {
    clearSessionDraft();
    pendingRecoveryRef.current = null;
    setRecoveryOpen(false);
    setRecoveryDraftMeta(null);
    useIdeStore.getState().appendLog('info', 'Discarded automatic session backup — starting fresh.');
  }, []);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-studio-bg">
      <SessionRecoveryModal
        open={recoveryOpen}
        draft={recoveryDraftMeta}
        onRestore={handleRecoveryRestore}
        onDiscard={handleRecoveryDiscard}
      />
      <TopToolbar workspace={workspace} previewCode={code} onAfterProjectImport={handleAfterProjectImport} />
      <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden md:flex-row">
        {isDesktop ? (
          <>
            <div className="flex h-full min-h-0 min-w-0 flex-1">
              <CategoryIconRail layout="vertical" />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-studio-border bg-[#1a1d22]">
                <ToolboxPanelTabs value={leftToolboxTab} onChange={setLeftToolboxTab} />
                <LeftWorkspaceStack tab={leftToolboxTab} code={code}>
                  <WorkspacePanel {...workspacePanelProps} />
                </LeftWorkspaceStack>
              </div>
            </div>
            <ResizeHandle
              axis="col"
              onDrag={onCodeDrag}
              title={
                boardId === 'esp32'
                  ? 'Resize MicroPython code preview width'
                  : 'Resize Arduino sketch preview width'
              }
            />
            <div className="h-full shrink-0 overflow-hidden" style={{ width: codeW }}>
              <CodePreviewPanel code={code} />
            </div>
          </>
        ) : (
          <>
            <div
              className="flex shrink-0 flex-col overflow-hidden border-b border-studio-border bg-[#1a1d22]"
              style={{ height: mobileCatH }}
            >
              <ToolboxPanelTabs value={leftToolboxTab} onChange={setLeftToolboxTab} />
              <div className="min-h-[44px] min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
                <CategoryIconRail layout="horizontal" />
              </div>
            </div>
            <ResizeHandle axis="row" onDrag={onMobileCatDrag} title="Resize toolbox strip height" />
            <div className="flex min-h-[120px] min-w-0 flex-1 flex-col">
              <LeftWorkspaceStack tab={leftToolboxTab} code={code}>
                <WorkspacePanel {...workspacePanelProps} />
              </LeftWorkspaceStack>
            </div>
            <ResizeHandle
              axis="row"
              onDrag={onMobileCodeDrag}
              title={
                boardId === 'esp32'
                  ? 'Resize MicroPython code preview height'
                  : 'Resize Arduino sketch preview height'
              }
            />
            <div className="shrink-0 overflow-hidden border-t border-studio-border" style={{ height: mobileCodeH }}>
              <CodePreviewPanel code={code} />
            </div>
          </>
        )}
      </div>
      <ResizeHandle
        axis="row"
        onDrag={onConsoleDrag}
        rowAbsoluteResize={consoleRowAbsoluteResize}
        invertDelta
        title="Resize Log / Serial Monitor — drag or use ↑↓ keys when focused"
        emphasize
      />
      <div className="flex shrink-0 flex-col overflow-hidden" style={{ height: consoleH }}>
        <ConsolePanel />
      </div>
    </div>
  );
}
