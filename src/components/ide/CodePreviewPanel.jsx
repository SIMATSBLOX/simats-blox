import Panel from '../ui/Panel.jsx';
import { codePreviewHeaderHint, codePreviewPlaceholderComment } from '../../lib/boardUiCopy.js';

export default function CodePreviewPanel({ code }) {
  const label = 'Code · MicroPython (ESP32)';

  return (
    <Panel
      title={label}
      className="h-full min-h-0 w-full min-w-0 shrink-0"
      headerRight={
        <span
          className="hidden max-w-[11rem] text-[9px] font-normal normal-case leading-snug tracking-normal text-studio-muted sm:line-clamp-2 sm:inline sm:max-w-[15rem] md:max-w-[18rem]"
          title={codePreviewHeaderHint()}
        >
          {codePreviewHeaderHint()}
        </span>
      }
    >
      <pre className="m-0 h-full overflow-auto bg-[#161a1f] p-3 font-mono text-[11px] leading-relaxed text-emerald-100/90">
        {code || codePreviewPlaceholderComment()}
      </pre>
    </Panel>
  );
}
