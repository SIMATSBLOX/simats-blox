/**
 * Single live metric card (sensor-type-specific usage only).
 */
export default function LiveStatCard({ label, value, sub }) {
  return (
    <div className="rounded-lg border border-studio-border bg-studio-panel px-4 py-3 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-studio-muted">{label}</div>
      <div className="mt-1 font-mono text-lg text-slate-100">{value}</div>
      {sub ? <div className="mt-1 text-[10px] text-studio-muted">{sub}</div> : null}
    </div>
  );
}
