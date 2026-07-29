import { memo, type ReactNode } from 'react';
import { DollarSign, TrendingUp, ShoppingBag, PieChart } from 'lucide-react';
import { Card } from '../../lib/ui';
import { formatTRY, formatNum } from '../../lib/utils';
import type { DashboardKpis } from '../../lib/api';

export const FinanceSummaryPanel = memo(function FinanceSummaryPanel({
  revenue,
  revenueShare,
  rank,
  kpis,
  avgOrderValue,
}: {
  revenue: number;
  revenueShare: number;
  rank: number | null;
  kpis: DashboardKpis;
  avgOrderValue?: number;
}) {
  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign size={16} className="text-gold-600" />
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Finans Özeti</h3>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat icon={<DollarSign size={14} className="text-ex-red" />} label="Şube Ciro" value={formatTRY(revenue)} />
        <Stat icon={<PieChart size={14} className="text-ink-600" />} label="Ciro Payı" value={`%${revenueShare}`} />
        <Stat icon={<TrendingUp size={14} className="text-gold-600" />} label="Sıralama" value={rank ? `#${rank}` : '—'} />
        <Stat icon={<ShoppingBag size={14} className="text-green-600" />} label="Ort. Sepet" value={formatTRY(avgOrderValue ?? kpis.avgBasket)} />
      </div>

      <div className="rounded-xl bg-cream-50 dark:bg-ink-800/50 p-3 border border-ink-100 dark:border-ink-800 space-y-2">
        <p className="text-[10px] font-semibold text-ink-500 uppercase">Ağ Geneli (HQ)</p>
        <div className="flex justify-between text-xs">
          <span className="text-ink-500">Aylık ciro</span>
          <span className="font-bold text-ink-900 dark:text-ink-100">{formatTRY(kpis.monthRevenue)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-ink-500">Bugünkü satış</span>
          <span className="font-bold text-ink-900 dark:text-ink-100">{formatTRY(kpis.todaySales)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-ink-500">Toplam sipariş</span>
          <span className="font-bold text-ink-900 dark:text-ink-100">{formatNum(kpis.totalOrders)}</span>
        </div>
      </div>
    </Card>
  );
});

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 dark:bg-ink-800/50 p-3 border border-ink-100 dark:border-ink-800">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] font-semibold text-ink-500 uppercase">{label}</span></div>
      <p className="text-lg font-bold text-ink-900 dark:text-ink-100 font-display">{value}</p>
    </div>
  );
}
