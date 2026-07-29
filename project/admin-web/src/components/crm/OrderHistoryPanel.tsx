import { ShoppingBag } from 'lucide-react';
import { Card, EmptyState } from '../../lib/ui';
import { formatDate } from '../../lib/utils';
import { formatOrderTotalDisplay, isFreeOrder } from '@shared/utils/orderDisplay';
import { ORDER_STATUS_LABELS_ADMIN } from '@shared/constants/orders';
import type { OrderRow } from '../../lib/supabase';

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
            <div key={o.id} className={`flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl border ${isFreeOrder(Number(o.total)) ? 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/30' : 'bg-cream-50 dark:bg-ink-800 border-ink-50 dark:border-ink-700'}`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">#{o.order_number}</p>
                  {isFreeOrder(Number(o.total)) && (
                    <span className="text-[9px] font-bold uppercase text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">Ücretsiz</span>
                  )}
                </div>
                <p className="text-xs text-ink-400 truncate">
                  {formatDate(o.created_at)} · {o.store_name || '—'} · {ORDER_STATUS_LABELS_ADMIN[o.status] ?? o.status}
                  {o.points_earned > 0 ? ` · +${o.points_earned} puan` : ''}
                </p>
              </div>
              <p className={`text-sm font-bold shrink-0 ${isFreeOrder(Number(o.total)) ? 'text-green-700' : 'text-ink-900 dark:text-ink-100'}`}>
                {formatOrderTotalDisplay(Number(o.total), n => `${n.toLocaleString('tr-TR')} ₺`)}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
