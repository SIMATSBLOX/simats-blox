/**
 * Lightweight code peek for the left "Code" tab (full editor remains on the right).
 */

export default function LeftCodeTabPanel({ code }) {
  const text =
    code && String(code).trim()
      ? code
      : '// MicroPython preview builds from blocks.\n// Full panel on the right → Export .py or Upload (ESP32).';
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#161a20]">
      <p className="shrink-0 border-b border-studio-border/60 px-2 py-1.5 text-[10px] leading-snug text-studio-muted">
        Quick peek (MicroPython). Edit blocks on the canvas; use the <span className="text-slate-400">right Code</span>{' '}
        panel to read, export <span className="font-mono text-slate-500">.py</span>, or Upload when connected.
      </p>
      <pre className="min-h-0 flex-1 overflow-auto p-2 font-mono text-[10px] leading-relaxed text-slate-300">
        {text}
      </pre>
    </div>
  );
}
