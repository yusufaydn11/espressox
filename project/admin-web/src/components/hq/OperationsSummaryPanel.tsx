import { memo } from 'react';
import { Activity, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card } from '../../lib/ui';
import { formatNum } from '../../lib/utils';

type OpsSummary = {
  totalRecent: number;
  pending: number;
  preparing: number;
  ready: number;
  completed: number;
};

export const OperationsSummaryPanel = memo(function OperationsSummaryPanel({
  summary,
  storeName,
}: {
  summary: OpsSummary;
  storeName?: string;
}) {
  const items = [
    { label: 'Son Siparişler', value: summary.totalRecent, icon: Activity, color: 'text-ex-red' },
    { label: 'Bekleyen', value: summary.pending, icon: Clock, color: 'text-amber-600' },
    { label: 'Hazırlanıyor', value: summary.preparing, icon: AlertCircle, color: 'text-blue-600' },
    { label: 'Hazır', value: summary.ready, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Tamamlanan', value: summary.completed, icon: CheckCircle2, color: 'text-ink-600' },
  ];

  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={16} className="text-ex-red" />
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Operasyon Özeti</h3>
      </div>
      {storeName && (
        <p className="text-xs text-ink-400 mb-4">{storeName} — son 30 sipariş kaydı</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl bg-cream-50 dark:bg-ink-800/50 p-3 border border-ink-100 dark:border-ink-800">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon size={13} className={item.color} />
                <span className="text-[10px] font-semibold text-ink-500 uppercase">{item.label}</span>
              </div>
              <p className="text-xl font-bold text-ink-900 dark:text-ink-100 font-display">{formatNum(item.value)}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
});
