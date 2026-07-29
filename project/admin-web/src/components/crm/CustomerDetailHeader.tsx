import { Phone, Calendar, Store, Crown } from 'lucide-react';
import { Badge, Card } from '../../lib/ui';
import { formatDate, formatNum } from '../../lib/utils';
import { tierColor } from '@shared/constants/loyalty';
import type { UserProfile } from '../../lib/supabase';

export function CustomerDetailHeader({ customer }: { customer: UserProfile }) {
  const initial = customer.full_name?.charAt(0).toUpperCase() ?? '?';

  return (
    <Card className="p-5 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div
          className="h-20 w-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-white shrink-0 shadow-soft"
          style={{ backgroundColor: tierColor(customer.tier) }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 font-display truncate">
              {customer.full_name || 'İsimsiz'}
            </h2>
            {customer.is_blocked && <Badge tone="red">Engelli</Badge>}
            <Badge tone="gold"><Crown size={10} /> {customer.tier}</Badge>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-ink-500">
            {customer.phone && (
              <span className="flex items-center gap-1"><Phone size={12} /> {customer.phone}</span>
            )}
            <span className="flex items-center gap-1"><Calendar size={12} /> Üyelik: {formatDate(customer.created_at)}</span>
            {customer.favorite_store_id && (
              <span className="flex items-center gap-1"><Store size={12} /> Favori şube kayıtlı</span>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-ex-red font-display">{formatNum(customer.points)}</p>
          <p className="text-xs text-ink-400">mevcut puan</p>
        </div>
      </div>
    </Card>
  );
}
