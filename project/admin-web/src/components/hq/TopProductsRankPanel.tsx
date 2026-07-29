import { memo } from 'react';
import { Award } from 'lucide-react';
import { Card, EmptyState } from '../../lib/ui';
import { formatNum } from '../../lib/utils';

export const TopProductsRankPanel = memo(function TopProductsRankPanel({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  if (data.length === 0) {
    return (
      <Card className="p-5 min-w-0">
        <EmptyState title="Ürün verisi yok" subtitle="Satış kaydı bulunamadı" />
      </Card>
    );
  }

  const max = data[0]?.value || 1;

  return (
    <Card className="p-5 min-w-0">
      <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2">
        <Award size={16} className="text-ex-red" /> En Çok Satan Ürünler
      </h3>
      <div className="space-y-3">
        {data.map((p, i) => (
          <div key={p.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-ink-700 dark:text-ink-300 flex items-center gap-2">
                <span className="text-xs font-bold text-ink-400 w-4">{i + 1}</span>
                {p.label}
              </span>
              <span className="text-xs font-bold text-ink-900 dark:text-ink-100">{formatNum(p.value)} adet</span>
            </div>
            <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden">
              <div className="h-full rounded-full bg-red-gradient" style={{ width: `${(p.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
});
