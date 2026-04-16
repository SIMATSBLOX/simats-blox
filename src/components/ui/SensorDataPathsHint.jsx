/**
 * Two ways data reaches the dashboard — compact copy for checklist / IDE banner.
 * @param {{ variant?: 'checklist' | 'banner'; className?: string }} props
 */
export default function SensorDataPathsHint({ variant = 'checklist', className = '' }) {
  const banner = variant === 'banner';
  if (banner) {
    return (
      <p className={`text-[10px] leading-snug text-slate-400 ${className}`}>
        <span className="text-slate-300">Wi‑Fi sample</span> (quickest live view) or{' '}
        <span className="text-slate-300">IDE + USB serial</span> → optional forward to the same sensor on Devices.
      </p>
    );
  }
  return (
    <div className={`rounded-lg border border-slate-600/35 bg-[#14171b]/60 px-3 py-2.5 ${className}`}>
      <h3 className="text-[11px] font-semibold text-slate-200">How this sensor sends data</h3>
      <div className="mt-2 space-y-2">
        <div className="rounded-md border border-emerald-700/45 bg-emerald-950/30 px-2 py-1.5 shadow-sm shadow-emerald-950/20">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-emerald-400/95">Recommended first</div>
          <p className="mt-1 text-[11px] leading-snug text-slate-100">
            Use cloud-ready code — easiest for live dashboard everywhere
          </p>
        </div>
        <div className="rounded-md border border-studio-border/55 bg-[#22262c]/70 px-2 py-1.5">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Secondary / demo</div>
          <p className="mt-1 text-[11px] leading-snug text-slate-400">
            Use Blockly + Serial Bridge — useful for local lab and classroom demos
          </p>
        </div>
      </div>
    </div>
  );
}
