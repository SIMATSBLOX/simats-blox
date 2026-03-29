/**
 * Two ways data reaches the dashboard — compact copy for checklist / IDE banner.
 * @param {{ variant?: 'checklist' | 'banner'; className?: string }} props
 */
export default function SensorDataPathsHint({ variant = 'checklist', className = '' }) {
  const banner = variant === 'banner';
  return (
    <div
      className={`rounded-lg border border-slate-600/35 bg-[#14171b]/60 ${banner ? 'px-2.5 py-2' : 'px-3 py-2.5'} ${className}`}
    >
      <h3 className={`font-semibold text-slate-200 ${banner ? 'text-[10px]' : 'text-[11px]'}`}>How this sensor sends data</h3>
      <div className={banner ? 'mt-1.5 space-y-1.5' : 'mt-2 space-y-2'}>
        <div className="rounded-md border border-emerald-700/45 bg-emerald-950/30 px-2 py-1.5 shadow-sm shadow-emerald-950/20">
          <div className={`font-semibold uppercase tracking-wide text-emerald-400/95 ${banner ? 'text-[8px]' : 'text-[9px]'}`}>
            Recommended first
          </div>
          <p className={`mt-1 leading-snug text-slate-100 ${banner ? 'text-[10px]' : 'text-[11px]'}`}>
            Use cloud-ready code — easiest for live dashboard everywhere
          </p>
        </div>
        <div className="rounded-md border border-studio-border/55 bg-[#22262c]/70 px-2 py-1.5">
          <div className={`font-semibold uppercase tracking-wide text-slate-500 ${banner ? 'text-[8px]' : 'text-[9px]'}`}>
            Secondary / demo
          </div>
          <p className={`mt-1 leading-snug text-slate-400 ${banner ? 'text-[10px]' : 'text-[11px]'}`}>
            Use Blockly + Serial Bridge — useful for local lab and classroom demos
          </p>
        </div>
      </div>
    </div>
  );
}
