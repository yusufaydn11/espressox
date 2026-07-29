import { Crown, Eye } from 'lucide-react';
import { Badge } from '../../lib/ui';
import { formatNum, formatDate } from '../../lib/utils';
import type { UserProfile } from '../../lib/supabase';

export function CustomerListTable({ customers, onSelect }: { customers: UserProfile[]; onSelect: (c: UserProfile) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[640px]">
        <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
          <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
            <th className="px-4 py-3 font-semibold">Müşteri</th>
            <th className="px-4 py-3 font-semibold">İletişim</th>
            <th className="px-4 py-3 font-semibold">Seviye</th>
            <th className="px-4 py-3 font-semibold">Puan</th>
            <th className="px-4 py-3 font-semibold">Üyelik</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {customers.map(c => (
            <tr key={c.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-cream-200 dark:bg-ink-800 flex items-center justify-center text-xs font-bold text-ink-600 shrink-0">
                    {c.full_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-ink-900 dark:text-ink-100 truncate">{c.full_name || 'İsimsiz'}</p>
                    {c.is_blocked && <Badge tone="red">Engelli</Badge>}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-ink-600 dark:text-ink-300 text-xs">{c.phone || '—'}</td>
              <td className="px-4 py-3">
                <Badge tone={c.tier === 'Altın' || c.tier === 'Siyah' || c.tier === 'VIP' ? 'gold' : 'neutral'}>
                  <Crown size={10} /> {c.tier}
                </Badge>
              </td>
              <td className="px-4 py-3 font-bold text-ink-900 dark:text-ink-100">{formatNum(c.points)}</td>
              <td className="px-4 py-3 text-ink-400 text-xs whitespace-nowrap">{formatDate(c.created_at)}</td>
              <td className="px-4 py-3">
                <button type="button" onClick={() => onSelect(c)} className="text-ink-400 hover:text-ex-red" aria-label="Detay">
                  <Eye size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
