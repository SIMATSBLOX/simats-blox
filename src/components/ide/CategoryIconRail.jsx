import {
  Braces,
  Calculator,
  Cpu,
  Gauge,
  ListTree,
  MessageSquare,
  Puzzle,
  TabletSmartphone,
  Activity,
} from 'lucide-react';
import { useIdeStore, BOARD_LABEL } from '../../store/ideStore.js';
import { getCategoryListForBoard } from '../../blockly/toolbox.js';

/** @type {Record<string, import('lucide-react').LucideIcon>} */
const ICONS = {
  control: ListTree,
  operators: Calculator,
  variables: Braces,
  myblocks: Puzzle,
  esp32: Cpu,
  actuators: Gauge,
  sensors: Activity,
  dabble: TabletSmartphone,
  communication: MessageSquare,
};

/**
 * @param {{ layout?: 'vertical' | 'horizontal' }} props
 */
export default function CategoryIconRail({ layout = 'vertical' }) {
  const boardId = useIdeStore((s) => s.boardId);
  const activeCategoryId = useIdeStore((s) => s.activeCategoryId);
  const setActiveCategoryId = useIdeStore((s) => s.setActiveCategoryId);
  const categories = getCategoryListForBoard(boardId);

  const isH = layout === 'horizontal';

  return (
    <nav
      className={
        isH
          ? 'flex shrink-0 flex-row items-stretch gap-1 overflow-x-auto border-b border-studio-border bg-[#14171b] px-1.5 py-1'
          : 'flex w-[92px] shrink-0 flex-col gap-1 overflow-y-auto overflow-x-hidden border-r border-studio-border bg-[#14171b] px-1 py-1.5'
      }
      aria-label={`Block categories — ${BOARD_LABEL[boardId] ?? boardId}`}
    >
      {categories.map((cat) => {
        const Icon = ICONS[cat.id] || ListTree;
        const on = cat.id === activeCategoryId;
        return (
          <button
            key={cat.id}
            type="button"
            title={`${cat.label} — ${cat.hint}`}
            onClick={() => setActiveCategoryId(cat.id)}
            className={
              isH
                ? `flex shrink-0 flex-col items-center justify-center rounded px-2.5 py-1.5 transition-colors ${
                    on
                      ? 'bg-studio-accent/30 text-white ring-1 ring-studio-accent/45'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
                : `flex w-full flex-col items-center justify-center rounded px-1 py-2 transition-colors ${
                    on
                      ? 'bg-studio-accent/30 text-white ring-1 ring-inset ring-studio-accent/45'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
            }
          >
            <Icon className={isH ? 'h-5 w-5 shrink-0' : 'h-6 w-6 shrink-0'} strokeWidth={1.65} aria-hidden />
            <span
              className={
                isH
                  ? `mt-1 max-w-[4rem] truncate text-center text-[10px] font-medium leading-tight ${
                      on ? 'text-white/95' : 'text-slate-400'
                    }`
                  : `mt-1 w-full truncate px-0.5 text-center text-[10px] font-medium leading-snug ${
                      on ? 'text-white/95' : 'text-slate-500'
                    }`
              }
            >
              {cat.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
