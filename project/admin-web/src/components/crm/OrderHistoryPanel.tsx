import { ShoppingBag } from 'lucide-react';
import { Card, EmptyState } from '../../lib/ui';
import { formatTRY, formatDate } from '../../lib/utils';
import type { OrderRow } from '../../lib/supabase';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Yeni',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  'picked-up': 'Teslim Alındı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};

export function OrderHistoryPanel({ orders }: { orders: OrderRow[] }) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ShoppingBag size={16} className="text-ex-red" />
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Sipariş Geçmişi</h3>
        </div>
        <span className="text-xs text-ink-400">{orders.length} sipariş</span>
      </div>

      {orders.length === 0 ? (
        <EmptyState title="Sipariş yok" subtitle="Bu müşterinin henüz siparişi bulunmuyor" />
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {orders.map(o => (
            <div key={o.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-cream-50 dark:bg-ink-800 border border-ink-50 dark:border-ink-700">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">#{o.order_number}</p>
                <p className="text-xs text-ink-400 truncate">
                  {formatDate(o.created_at)} · {o.store_name || '—'} · {STATUS_LABELS[o.status] ?? o.status}
                </p>
              </div>
              <p className="text-sm font-bold text-ink-900 dark:text-ink-100 shrink-0">{formatTRY(Number(o.total))}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
