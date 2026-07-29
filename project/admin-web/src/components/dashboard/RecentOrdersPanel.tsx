import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { Card } from '../../lib/ui';
import { formatTRY, timeAgo } from '../../lib/utils';
import type { DashboardRecentOrderRow } from '../../services/orders/orderService';
import { OrderStatusBadge } from './OrderStatusBadge';

export function RecentOrdersPanel({ orders }: { orders: DashboardRecentOrderRow[] }) {
  return (
    <Card className="p-5 h-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Son Siparişler</h3>
          <p className="text-xs text-ink-400">Gerçek zamanlı operasyon</p>
        </div>
        <Link to="/orders" className="text-xs font-semibold text-ex-red hover:underline">Tümü</Link>
      </div>
      <div className="space-y-1">
        {orders.length === 0 && <p className="text-sm text-ink-400 py-8 text-center">Henüz sipariş yok</p>}
        {orders.map(o => (
          <div key={o.id} className="flex items-center gap-3 py-2.5 border-b border-ink-50 last:border-0">
            <div className="h-9 w-9 rounded-xl bg-ex-red/10 flex items-center justify-center shrink-0">
              <ShoppingBag size={15} className="text-ex-red" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">#{o.order_number}</p>
              <p className="text-xs text-ink-400 truncate">{o.store_name} · {timeAgo(o.created_at)}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(o.total))}</p>
              <OrderStatusBadge status={o.status} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
