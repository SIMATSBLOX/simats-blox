export default function Panel({ title, children, className = '', headerRight }) {
  return (
    <div
      className={`flex min-h-0 flex-col rounded-md border border-studio-border bg-studio-panel ${className}`}
    >
      {(title || headerRight) && (
        <div className="flex shrink-0 items-center justify-between border-b border-studio-border px-2 py-1">
          {title && <span className="text-xs font-semibold uppercase tracking-wide text-studio-muted">{title}</span>}
          {headerRight}
        </div>
      )}
      <div className="relative min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
