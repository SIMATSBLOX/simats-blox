import Panel from '../ui/Panel.jsx';
import { codePreviewPlaceholderComment } from '../../lib/boardUiCopy.js';

export default function CodePreviewPanel({ code }) {
  const label = 'Code · MicroPython (ESP32)';

  return (
    <Panel title={label} className="h-full min-h-0 w-full min-w-0 shrink-0">
      <pre className="m-0 h-full min-w-0 w-full max-w-full overflow-auto whitespace-pre bg-[#161a1f] p-3 font-mono text-[11px] leading-relaxed text-emerald-100/90 [overflow-wrap:normal]">
        {code || codePreviewPlaceholderComment()}
      </pre>
    </Panel>
  );
}
