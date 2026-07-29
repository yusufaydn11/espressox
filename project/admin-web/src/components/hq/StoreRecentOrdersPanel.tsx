import { ShoppingBag } from 'lucide-react';
import { Card, EmptyState } from '../../lib/ui';
import { formatTRY, formatDate } from '../../lib/utils';
import type { DashboardRecentOrderRow } from '../../services/orders/orderService';
import { OrderStatusBadge } from '../dashboard/OrderStatusBadge';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Yeni',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  'picked-up': 'Teslim Alındı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};

export function StoreRecentOrdersPanel({ orders }: { orders: DashboardRecentOrderRow[] }) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-ex-red" />
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Son Siparişler</h3>
        </div>
        <span className="text-xs text-ink-400">{orders.length} kayıt</span>
      </div>
      {orders.length === 0 ? (
        <EmptyState title="Sipariş yok" subtitle="Bu şubede son dönemde sipariş bulunamadı" />
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {orders.map(o => (
            <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-cream-50 dark:bg-ink-800 border border-ink-50 dark:border-ink-700">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">#{o.order_number}</p>
                <p className="text-xs text-ink-400">{formatDate(o.created_at)} · {STATUS_LABELS[o.status] ?? o.status}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(o.total))}</p>
                <OrderStatusBadge status={o.status} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
