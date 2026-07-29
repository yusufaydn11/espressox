import { memo } from 'react';
import { Eye } from 'lucide-react';
import { Badge } from '../../lib/ui';
import { formatTRY } from '../../lib/utils';
import type { StorePerformanceRow } from '../../hooks/useHqStorePerformance';

export const StorePerformanceTable = memo(function StorePerformanceTable({
  stores,
  onSelect,
}: {
  stores: StorePerformanceRow[];
  onSelect: (store: StorePerformanceRow) => void;
}) {
  if (stores.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
          <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
            <th className="px-4 py-3 font-semibold">Sıra</th>
            <th className="px-4 py-3 font-semibold">Şube</th>
            <th className="px-4 py-3 font-semibold">Durum</th>
            <th className="px-4 py-3 font-semibold">Ciro</th>
            <th className="px-4 py-3 font-semibold">Pay</th>
            <th className="px-4 py-3 font-semibold">Adres</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {stores.map((s, i) => (
            <tr key={s.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
              <td className="px-4 py-3 text-xs font-bold text-ink-400">{s.rank ?? i + 1}</td>
              <td className="px-4 py-3 font-semibold text-ink-900 dark:text-ink-100">{s.name}</td>
              <td className="px-4 py-3">
                <Badge tone={s.open ? 'green' : 'red'}>{s.open ? 'Açık' : 'Kapalı'}</Badge>
              </td>
              <td className="px-4 py-3 font-bold text-ex-red">{formatTRY(s.revenue)}</td>
              <td className="px-4 py-3 text-ink-500">%{s.revenueShare}</td>
              <td className="px-4 py-3 text-xs text-ink-400 max-w-[200px] truncate">{s.address}</td>
              <td className="px-4 py-3">
                <button type="button" onClick={() => onSelect(s)} className="text-ink-400 hover:text-ex-red" aria-label="Detay">
                  <Eye size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});
