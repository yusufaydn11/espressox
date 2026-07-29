import { TrendingUp, ShoppingBag, Crown, Users } from 'lucide-react';
import { EnterpriseKpiCard } from '../dashboard/EnterpriseKpiCard';
import { formatTRY, formatNum } from '../../lib/utils';
import type { HqAnalyticsSummary } from '../../hooks/useHqAnalytics';

export function HqAnalyticsKpiGrid({ summary, range }: { summary: HqAnalyticsSummary; range: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <EnterpriseKpiCard
        variant="primary"
        label="Toplam Ciro"
        value={formatTRY(summary.totalRevenue)}
        sub={`Son ${range} gün`}
        icon={<TrendingUp size={18} className="text-white" />}
      />
      <EnterpriseKpiCard
        label="Toplam Sipariş"
        value={formatNum(summary.totalOrders)}
        sub="Seçili dönem"
        icon={<ShoppingBag size={18} className="text-ex-red" />}
      />
      <EnterpriseKpiCard
        variant="gold"
        label="Ortalama Sepet"
        value={formatTRY(summary.avgOrder)}
        sub="Dönem ortalaması"
        icon={<TrendingUp size={18} className="text-gold-700" />}
      />
      <EnterpriseKpiCard
        label="Toplam Üye"
        value={formatNum(summary.totalMembers)}
        sub="Tier dağılımı"
        icon={<Crown size={18} className="text-ink-600" />}
      />
    </div>
  );
}

export function HqReportsKpiGrid({
  totalRevenue,
  avgBasket,
  newMembers,
  topStore,
  range,
}: {
  totalRevenue: number;
  avgBasket: number;
  newMembers: number;
  topStore: string;
  range: number;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <EnterpriseKpiCard
        variant="primary"
        label="Toplam Ciro"
        value={formatTRY(totalRevenue)}
        sub={`Son ${range} gün`}
        icon={<TrendingUp size={18} className="text-white" />}
      />
      <EnterpriseKpiCard
        label="Ort. Sepet"
        value={formatTRY(avgBasket)}
        sub="Ağ geneli"
        icon={<ShoppingBag size={18} className="text-ex-red" />}
      />
      <EnterpriseKpiCard
        variant="gold"
        label="Yeni Üye"
        value={formatNum(newMembers)}
        sub="Bu dönem"
        icon={<Users size={18} className="text-gold-700" />}
      />
      <EnterpriseKpiCard
        label="En İyi Şube"
        value={topStore}
        sub="Ciro lideri"
        icon={<Crown size={18} className="text-ink-600" />}
      />
    </div>
  );
}
