import { Crown, ChevronRight, Phone } from 'lucide-react';
import { Badge, Card } from '../../lib/ui';
import { formatNum, formatDate } from '../../lib/utils';
import { tierColor } from '@shared/constants/loyalty';
import type { UserProfile } from '../../lib/supabase';

export function CustomerProfileCard({ customer, onClick }: { customer: UserProfile; onClick: () => void }) {
  const initial = customer.full_name?.charAt(0).toUpperCase() ?? '?';
  const tierAccent = tierColor(customer.tier);

  return (
    <Card className="p-4 min-w-0 cursor-pointer hover:shadow-soft transition-shadow" onClick={onClick}>
      <div className="flex items-start gap-3">
        <div
          className="h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ backgroundColor: tierAccent }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-ink-900 dark:text-ink-100 truncate">{customer.full_name || 'İsimsiz'}</p>
            {customer.is_blocked && <Badge tone="red">Engelli</Badge>}
          </div>
          {customer.phone && (
            <p className="text-xs text-ink-400 mt-0.5 flex items-center gap-1 truncate">
              <Phone size={11} /> {customer.phone}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <Badge tone="gold"><Crown size={10} /> {customer.tier}</Badge>
            <span className="text-xs font-semibold text-ink-600">{formatNum(customer.points)} puan</span>
          </div>
          <p className="text-[10px] text-ink-400 mt-1.5">Üyelik: {formatDate(customer.created_at)}</p>
        </div>
        <ChevronRight size={16} className="text-ink-300 shrink-0 mt-1" />
      </div>
    </Card>
  );
}
