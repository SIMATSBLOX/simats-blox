import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import { registerAllBlocks } from '../../blockly/registerBlocks.js';
import { getFlyoutContents } from '../../blockly/toolbox.js';
import { mblockHardwareTheme } from '../../blockly/mblockTheme.js';
import { applyCompactZelosMetrics } from '../../blockly/compactZelosMetrics.js';
import { applyCompactWorkspaceControls } from '../../blockly/workspaceCompactControls.js';
import { useIdeStore } from '../../store/ideStore.js';

let blocksRegistered = false;

export default function WorkspacePanel({ onWorkspaceReady, onCodeDirty, rootClassName = '', hostClassName = '' }) {
  const areaRef = useRef(null);
  const divRef = useRef(null);
  const wsRef = useRef(null);
  const activeCategoryId = useIdeStore((s) => s.activeCategoryId);
  const boardId = useIdeStore((s) => s.boardId);

  useEffect(() => {
    if (!blocksRegistered) {
      registerAllBlocks();
      blocksRegistered = true;
    }
  }, []);

  useEffect(() => {
    if (!divRef.current) return undefined;

    const workspace = Blockly.inject(divRef.current, {
      toolbox: {
        kind: 'flyoutToolbox',
        contents: getFlyoutContents(activeCategoryId, boardId),
      },
      grid: {
        spacing: 22,
        length: 2.5,
        colour: '#2f3540',
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1,
        maxScale: 2.5,
        minScale: 0.5,
        scaleSpeed: 1.08,
      },
      trashcan: true,
      renderer: 'zelos',
      theme: mblockHardwareTheme,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true,
      },
    });

    wsRef.current = workspace;
    applyCompactZelosMetrics(workspace);
    applyCompactWorkspaceControls(workspace);

    try {
      if (workspace.getVariableMap().getAllVariables().length === 0) {
        workspace.createVariable('item');
      }
    } catch (e) {
      console.warn('[workspace] createVariable', e);
    }

    try {
      workspace.registerButtonCallback('CREATE_VARIABLE', (btn) => {
        try {
          Blockly.Variables.createVariableButtonHandler(btn.getTargetWorkspace());
        } catch (err) {
          console.warn('[workspace] create variable button', err);
        }
      });
      workspace.registerButtonCallback('CREATE_LIST_PLACEHOLDER', () => {
        useIdeStore
          .getState()
          .appendLog('info', 'Make a List: use standard list blocks when codegen support is enabled.');
      });
      workspace.registerButtonCallback('CREATE_TABLE_PLACEHOLDER', () => {
        useIdeStore.getState().appendLog('info', 'Make a Table: not available in this hardware preview.');
      });
      workspace.registerButtonCallback('CREATE_PROCEDURE', (btn) => {
        try {
          const ws = btn.getTargetWorkspace();
          if (!ws || typeof ws.newBlock !== 'function') return;
          const b = ws.newBlock('procedures_defnoreturn');
          if (typeof b.initSvg === 'function') b.initSvg();
          if (typeof b.render === 'function') b.render();
          try {
            b.setFieldValue('my block', 'NAME');
          } catch {
            /* ignore */
          }
          const m = ws.getMetrics();
          if (m && typeof b.moveBy === 'function') b.moveBy(m.viewWidth / 2, m.viewHeight / 2);
        } catch (err) {
          console.warn('[workspace] create procedure', err);
        }
      });
    } catch (e) {
      console.warn('[workspace] registerButtonCallback', e);
    }

    onWorkspaceReady?.(workspace);

    const bumpResize = () => {
      try {
        Blockly.svgResize(workspace);
      } catch {
        /* disposed */
      }
    };
    queueMicrotask(bumpResize);
    requestAnimationFrame(bumpResize);

    const listener = (e) => {
      if (e.isUiEvent) return;
      onCodeDirty?.(workspace);
    };
    workspace.addChangeListener(listener);

    const ro = new ResizeObserver(() => {
      try {
        if (wsRef.current === workspace) {
          Blockly.svgResize(workspace);
        }
      } catch {
        /* workspace may be disposing */
      }
    });
    if (areaRef.current) ro.observe(areaRef.current);

    return () => {
      ro.disconnect();
      workspace.removeChangeListener(listener);
      onWorkspaceReady?.(null);
      workspace.dispose();
      wsRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;
    ws.updateToolbox({
      kind: 'flyoutToolbox',
      contents: getFlyoutContents(activeCategoryId, boardId),
    });
    applyCompactZelosMetrics(ws);
  }, [activeCategoryId, boardId]);

  return (
    <div
      ref={areaRef}
      className={`relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md border border-studio-border bg-[#1e2228] ${rootClassName}`}
    >
      <div ref={divRef} className={`blockly-host min-h-[200px] w-full min-w-0 flex-1 ${hostClassName}`} />
    </div>
  );
}
