import { cn } from '../../lib/utils';
import type { CrmSegment } from '../../hooks/useCrmCustomers';

const SEGMENTS: { id: CrmSegment; label: string }[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'vip', label: 'VIP' },
  { id: 'new', label: 'Yeni' },
  { id: 'inactive', label: 'Pasif' },
];

export function CrmSegmentChips({ value, onChange }: { value: CrmSegment; onChange: (s: CrmSegment) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SEGMENTS.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.id)}
          className={cn(
            'px-3.5 py-2 rounded-full text-xs font-semibold border transition-all',
            value === s.id
              ? 'bg-ex-red border-ex-red text-white shadow-red'
              : 'bg-white border-ink-200 text-ink-500 hover:bg-cream-50 dark:bg-ink-900 dark:border-ink-700 dark:text-ink-400',
          )}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

export { SEGMENTS as CRM_SEGMENTS };
