export default function Button({
  children,
  className = '',
  variant = 'default',
  disabled,
  title,
  onClick,
  type = 'button',
  ...rest
}) {
  const base =
    'inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1 text-sm font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none';
  const variants = {
    default: 'bg-studio-panel text-slate-200 border border-studio-border hover:bg-[#2c323a]',
    primary: 'bg-studio-accent text-white border border-transparent hover:bg-studio-accentHover',
    ghost: 'bg-transparent text-slate-300 hover:bg-white/5',
  };
  return (
    <button
      type={type}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${variants[variant] ?? variants.default} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
