import * as Blockly from 'blockly';

/**
 * Slightly denser Zelos metrics (flyout + main workspace) — small deltas to preserve hit targets.
 * @param {import('blockly/core/workspace_svg').WorkspaceSvg} workspace
 */
export function applyCompactZelosMetrics(workspace) {
  try {
    const constants = workspace.getRenderer().getConstants();
    if (!constants) return;

    if (typeof constants.MIN_BLOCK_HEIGHT === 'number') {
      constants.MIN_BLOCK_HEIGHT = Math.max(36, Math.round(constants.MIN_BLOCK_HEIGHT * 0.94));
    }
    if (typeof constants.EMPTY_BLOCK_SPACER_HEIGHT === 'number') {
      constants.EMPTY_BLOCK_SPACER_HEIGHT = Math.max(12, Math.round(constants.EMPTY_BLOCK_SPACER_HEIGHT * 0.9));
    }
    if (typeof constants.DUMMY_INPUT_MIN_HEIGHT === 'number') {
      constants.DUMMY_INPUT_MIN_HEIGHT = Math.max(20, Math.round(constants.DUMMY_INPUT_MIN_HEIGHT * 0.94));
    }
    if (typeof constants.EMPTY_INLINE_INPUT_PADDING === 'number') {
      constants.EMPTY_INLINE_INPUT_PADDING = Math.max(10, Math.round(constants.EMPTY_INLINE_INPUT_PADDING * 0.92));
    }
    if (typeof constants.FIELD_BORDER_RECT_X_PADDING === 'number') {
      constants.FIELD_BORDER_RECT_X_PADDING = Math.max(4, constants.FIELD_BORDER_RECT_X_PADDING - 1);
    }
    if (typeof constants.FIELD_BORDER_RECT_Y_PADDING === 'number') {
      constants.FIELD_BORDER_RECT_Y_PADDING = Math.max(2, constants.FIELD_BORDER_RECT_Y_PADDING - 0.5);
    }
  } catch {
    /* ignore */
  }

  try {
    const flyout = workspace.getFlyout();
    if (flyout && typeof flyout.GAP_Y === 'number') {
      flyout.GAP_Y = Math.max(6, Math.round(flyout.GAP_Y * 0.88));
    }
    if (flyout && typeof flyout.reflow === 'function') {
      flyout.reflow();
    }
  } catch {
    /* ignore */
  }

  try {
    Blockly.svgResize(workspace);
  } catch {
    /* ignore */
  }
}
