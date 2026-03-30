import { useIdeStore } from '../../store/ideStore.js';

/**
 * Compact Blocks | Code switch for the left toolbox column (Code = in-IDE hint; full preview stays on the right).
 * @param {{ value: 'blocks' | 'code', onChange: (v: 'blocks' | 'code') => void }}
 */
export default function ToolboxPanelTabs({ value, onChange }) {
  const boardId = useIdeStore((s) => s.boardId);
  return (
    <div className="flex h-[28px] shrink-0 items-stretch border-b border-studio-border bg-[#1c1f24] px-1 py-0.5">
      <div
        className="inline-flex h-full w-full max-w-[200px] rounded-md border border-studio-border/80 bg-[#14171b] p-0.5"
        role="tablist"
        aria-label="Toolbox view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === 'blocks'}
          className={`flex-1 rounded px-2 text-[11px] font-medium transition-colors ${
            value === 'blocks'
              ? 'bg-[#2a3038] text-white shadow-sm'
              : 'text-studio-muted hover:text-slate-300'
          }`}
          onClick={() => onChange('blocks')}
        >
          Blocks
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={value === 'code'}
          className={`flex-1 rounded px-2 text-[11px] font-medium transition-colors ${
            value === 'code'
              ? 'bg-[#2a3038] text-white shadow-sm'
              : 'text-studio-muted hover:text-slate-300'
          }`}
          onClick={() => onChange('code')}
          title={
            boardId === 'esp32'
              ? 'Peek at MicroPython — full preview and Export .py on the right'
              : 'Peek at Arduino C++ — full preview and Export .ino on the right'
          }
        >
          Code
        </button>
      </div>
    </div>
  );
}
