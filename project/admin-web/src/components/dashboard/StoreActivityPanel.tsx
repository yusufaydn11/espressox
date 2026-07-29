import { Store, Activity } from 'lucide-react';
import { Card } from '../../lib/ui';
import type { DashboardRecentOrderRow } from '../../services/orders/orderService';

function buildStoreActivity(orders: DashboardRecentOrderRow[]) {
  const map = new Map<string, { count: number; revenue: number; lastAt: string }>();
  for (const o of orders) {
    const prev = map.get(o.store_name) ?? { count: 0, revenue: 0, lastAt: o.created_at };
    map.set(o.store_name, {
      count: prev.count + 1,
      revenue: prev.revenue + Number(o.total),
      lastAt: o.created_at > prev.lastAt ? o.created_at : prev.lastAt,
    });
  }
  return [...map.entries()]
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
}

export function StoreActivityPanel({ orders }: { orders: DashboardRecentOrderRow[] }) {
  const activity = buildStoreActivity(orders);

  return (
    <Card className="p-5 h-full min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-ex-red" />
        <div>
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Şube Aktiviteleri</h3>
          <p className="text-xs text-ink-400">Son siparişlerden türetilmiş</p>
        </div>
      </div>
      <div className="space-y-2">
        {activity.length === 0 && <p className="text-sm text-ink-400 py-8 text-center">Aktivite yok</p>}
        {activity.map(a => (
          <div key={a.name} className="flex items-center gap-3 py-2 border-b border-ink-50 last:border-0">
            <div className="h-9 w-9 rounded-xl bg-cream-100 dark:bg-ink-800 flex items-center justify-center shrink-0">
              <Store size={15} className="text-ink-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink-900 dark:text-ink-100 truncate">{a.name}</p>
              <p className="text-xs text-ink-400">{a.count} sipariş</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-ink-700">₺{Math.round(a.revenue).toLocaleString('tr-TR')}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
