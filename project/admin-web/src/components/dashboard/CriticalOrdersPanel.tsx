import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { Card, Badge } from '../../lib/ui';
import { formatTRY, timeAgo } from '../../lib/utils';
import type { DashboardRecentOrderRow } from '../../services/orders/orderService';
import { OrderStatusBadge } from './OrderStatusBadge';

const CRITICAL_STATUSES = new Set(['pending', 'cancelled']);

/** Kritik operasyon uyarıları — yalnızca get_admin_recent_orders verisinden türetilir */
export function CriticalOrdersPanel({ orders }: { orders: DashboardRecentOrderRow[] }) {
  const critical = orders.filter(o => CRITICAL_STATUSES.has(o.status)).slice(0, 6);

  return (
    <Card className="p-5 h-full min-w-0">
      <div className="flex items-center justify-between mb-4 gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Kritik Operasyon</h3>
          <p className="text-xs text-ink-400">Bekleyen ve iptal siparişler</p>
        </div>
        {critical.length > 0 && <Badge tone="red">{critical.length}</Badge>}
      </div>
      <div className="space-y-2">
        {critical.length === 0 && (
          <div className="flex flex-col items-center py-8 text-ink-400">
            <AlertTriangle size={28} className="mb-2 opacity-40" />
            <p className="text-sm text-center">Kritik sipariş yok</p>
          </div>
        )}
        {critical.map(o => (
          <div
            key={o.id}
            className="flex items-start gap-3 p-3 rounded-xl border bg-ex-red/5 border-ex-red/15"
          >
            <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-ex-red/10">
              <AlertTriangle size={14} className="text-ex-red" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink-900 dark:text-ink-100 truncate">#{o.order_number}</p>
              <p className="text-xs text-ink-500 mt-0.5 truncate">{o.store_name} · {formatTRY(Number(o.total))}</p>
              <div className="flex items-center gap-2 mt-1">
                <OrderStatusBadge status={o.status} />
                <span className="text-[10px] text-ink-400">{timeAgo(o.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link to="/orders" className="block text-center text-xs font-semibold text-ex-red hover:underline mt-4">
        Sipariş yönetimi
      </Link>
    </Card>
  );
}
