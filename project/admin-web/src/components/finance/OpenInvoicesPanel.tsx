import { memo } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { Card, Badge, EmptyState } from '../../lib/ui';
import { formatTRY, formatDate } from '../../lib/utils';
import { B2B_INVOICE_STATUS_UI_LABELS, B2B_INVOICE_STATUS_UI_TONES } from '@shared/constants/payments';
import type { InvoiceWithMeta } from '../../hooks/useHqFinance';

export const OpenInvoicesPanel = memo(function OpenInvoicesPanel({
  invoices,
  onOpenOrder,
}: {
  invoices: InvoiceWithMeta[];
  onOpenOrder?: (orderId: string) => void;
}) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-ex-red" />
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Açık Faturalar</h3>
        </div>
        <span className="text-xs text-ink-400">{invoices.length} kayıt</span>
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="Açık fatura yok" subtitle="Tüm faturalar kapatılmış görünüyor" />
      ) : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {invoices.map(inv => (
            <div key={inv.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-cream-50 dark:bg-ink-800 border border-ink-50 dark:border-ink-700">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">{inv.invoice_number}</p>
                <p className="text-xs text-ink-400 truncate">
                  {inv.franchise_name ?? '—'} · Sipariş #{inv.order_number ?? '—'} · {formatDate(inv.issued_at)}
                </p>
              </div>
              <div className="text-right shrink-0 flex flex-col items-end gap-1">
                <p className="text-sm font-bold text-ex-red">{formatTRY(Number(inv.total) - Number(inv.paid_amount))}</p>
                <Badge tone={B2B_INVOICE_STATUS_UI_TONES[inv.status] ?? 'neutral'}>
                  {B2B_INVOICE_STATUS_UI_LABELS[inv.status] ?? inv.status}
                </Badge>
                {onOpenOrder && (
                  <button type="button" onClick={() => onOpenOrder(inv.order_id)} className="text-[10px] text-ink-400 hover:text-ex-red flex items-center gap-0.5">
                    Detay <ExternalLink size={10} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
});
