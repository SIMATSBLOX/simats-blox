export default function Tabs({ tabs, activeId, onChange }) {
  return (
    <div className="flex border-b border-studio-border bg-[#1f2328]">
      {tabs.map((t) => {
        const on = t.id === activeId;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              on
                ? 'border-b-2 border-studio-accent text-slate-100'
                : 'text-studio-muted hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
