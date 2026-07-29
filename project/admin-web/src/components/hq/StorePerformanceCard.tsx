import { memo } from 'react';
import { Store, ChevronRight, TrendingUp } from 'lucide-react';
import { Badge, Card } from '../../lib/ui';
import { formatTRY } from '../../lib/utils';
import type { StorePerformanceRow } from '../../hooks/useHqStorePerformance';

export const StorePerformanceCard = memo(function StorePerformanceCard({
  store,
  onClick,
}: {
  store: StorePerformanceRow;
  onClick: () => void;
}) {
  return (
    <Card className="p-4 min-w-0 cursor-pointer hover:shadow-soft transition-shadow" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl bg-ink-900 flex items-center justify-center shrink-0">
          <Store size={16} className="text-white" />
        </div>
        <div className="flex items-center gap-2">
          {store.rank && (
            <span className="text-[10px] font-bold text-ink-400 uppercase">#{store.rank}</span>
          )}
          <Badge tone={store.open ? 'green' : 'red'}>{store.open ? 'Açık' : 'Kapalı'}</Badge>
        </div>
      </div>
      <p className="text-sm font-bold text-ink-900 dark:text-ink-100 truncate">{store.name}</p>
      <p className="text-xl font-bold text-ex-red mt-1 font-display">{formatTRY(store.revenue)}</p>
      <div className="mt-3 h-2 rounded-full bg-ink-100 overflow-hidden">
        <div className="h-full rounded-full bg-red-gradient" style={{ width: `${store.revenueShare}%` }} />
      </div>
      <p className="text-[10px] text-ink-400 mt-1.5 flex items-center gap-1">
        <TrendingUp size={10} /> Ciro payı %{store.revenueShare}
      </p>
      <ChevronRight size={14} className="text-ink-300 mt-2 ml-auto" />
    </Card>
  );
});
