import { cn } from '../../lib/utils';

export function RangeSelector({
  value,
  options,
  onChange,
}: {
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex bg-cream-100 dark:bg-ink-800 rounded-xl p-1">
      {options.map(r => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            value === r.value
              ? 'bg-white dark:bg-ink-900 shadow-card text-ink-900 dark:text-ink-100'
              : 'text-ink-400',
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
