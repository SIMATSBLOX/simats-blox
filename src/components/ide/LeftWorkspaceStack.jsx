import LeftCodeTabPanel from './LeftCodeTabPanel.jsx';

/**
 * Keeps Blockly mounted while toggling Blocks / Code tab (visibility only).
 */
export default function LeftWorkspaceStack({ tab, code, children }) {
  const showBlocks = tab === 'blocks';
  return (
    <div className="relative min-h-0 flex-1">
      <div
        className={
          showBlocks
            ? 'absolute inset-0 z-0 flex min-h-0 flex-col'
            : 'pointer-events-none absolute inset-0 z-0 flex min-h-0 flex-col invisible'
        }
        aria-hidden={!showBlocks}
      >
        {children}
      </div>
      {tab === 'code' ? (
        <div className="absolute inset-0 z-[6] flex min-h-0 flex-col">
          <LeftCodeTabPanel code={code} />
        </div>
      ) : null}
    </div>
  );
}
