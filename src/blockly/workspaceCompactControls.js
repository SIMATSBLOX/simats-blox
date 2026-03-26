const SVG_NS = 'http://www.w3.org/2000/svg';

function wrapCluster(svgGroup, kind) {
  if (!svgGroup?.parentNode) return;
  const parent = svgGroup.parentElement;
  if (parent?.getAttribute('data-studio-control-wrap') === kind) return;
  const wrap = document.createElementNS(SVG_NS, 'g');
  wrap.setAttribute('class', `blockly-studio-control-wrap blockly-studio-control-wrap--${kind}`);
  wrap.setAttribute('data-studio-control-wrap', kind);
  svgGroup.parentNode.insertBefore(wrap, svgGroup);
  wrap.appendChild(svgGroup);
}

/**
 * Wrap trash + zoom root groups so CSS can scale them without replacing Blockly's
 * translate() on the inner nodes.
 */
export function applyCompactWorkspaceControls(workspace) {
  try {
    wrapCluster(workspace.trashcan?.svgGroup, 'trash');
    wrapCluster(workspace.zoomControls_?.svgGroup, 'zoom');
  } catch (e) {
    console.warn('[workspace] compact workspace controls', e);
  }
}
