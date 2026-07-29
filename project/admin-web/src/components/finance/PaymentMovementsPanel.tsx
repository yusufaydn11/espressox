import { memo } from 'react';
import { CreditCard } from 'lucide-react';
import { Card, Badge, EmptyState } from '../../lib/ui';
import { formatTRY, formatDate } from '../../lib/utils';
import { B2B_PAYMENT_STATUS_UI_TONES } from '@shared/constants/payments';
import type { PaymentWithMeta } from '../../hooks/useHqFinance';

const PAYMENT_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  success: 'Başarılı',
  failed: 'Başarısız',
  refunded: 'İade',
};

export const PaymentMovementsPanel = memo(function PaymentMovementsPanel({
  payments,
}: {
  payments: PaymentWithMeta[];
}) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard size={16} className="text-gold-600" />
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Ödeme Hareketleri</h3>
        </div>
        <span className="text-xs text-ink-400">{payments.length} kayıt</span>
      </div>

      {payments.length === 0 ? (
        <EmptyState title="Ödeme kaydı yok" subtitle="Son dönemde ödeme hareketi bulunamadı" />
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {payments.map(p => (
            <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-cream-50 dark:bg-ink-800 border border-ink-50 dark:border-ink-700">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">{p.payment_number}</p>
                <p className="text-xs text-ink-400 truncate">
                  {p.franchise_name ?? '—'} · #{p.order_number ?? '—'} · {p.payment_method || p.provider}
                </p>
                <p className="text-[10px] text-ink-400 mt-0.5">{formatDate(p.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(p.amount))}</p>
                <Badge tone={B2B_PAYMENT_STATUS_UI_TONES[p.status] ?? 'neutral'}>
                  {PAYMENT_LABELS[p.status] ?? p.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
});
