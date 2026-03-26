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
          ? 'flex shrink-0 flex-row items-stretch gap-0.5 overflow-x-auto border-b border-studio-border bg-[#14171b] px-1 py-0.5'
          : 'flex w-[52px] shrink-0 flex-col gap-0.5 overflow-y-auto overflow-x-hidden border-r border-studio-border bg-[#14171b] py-1'
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
                ? `flex shrink-0 flex-col items-center justify-center rounded px-2 py-1 transition-colors ${
                    on
                      ? 'bg-studio-accent/30 text-white ring-1 ring-studio-accent/45'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
                : `flex w-full flex-col items-center justify-center rounded px-0.5 py-1.5 transition-colors ${
                    on
                      ? 'bg-studio-accent/30 text-white ring-1 ring-inset ring-studio-accent/45'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
            <span
              className={
                isH
                  ? 'mt-0.5 max-w-[3.25rem] truncate text-center text-[8px] font-medium leading-tight text-slate-400'
                  : 'mt-0.5 w-full truncate px-px text-center text-[7px] font-medium leading-[1.05] text-slate-500'
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
