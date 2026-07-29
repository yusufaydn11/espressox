import { Store, TrendingUp, DollarSign, AlertTriangle, Award } from 'lucide-react';
import { EnterpriseKpiCard } from '../dashboard/EnterpriseKpiCard';
import { formatTRY, formatNum } from '../../lib/utils';
import type { HqStoreSummary } from '../../hooks/useHqStorePerformance';

export function HqStoreKpiGrid({ summary }: { summary: HqStoreSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
      <EnterpriseKpiCard
        variant="primary"
        label="Toplam Şube"
        value={formatNum(summary.totalStores)}
        sub={`${summary.openStores} açık`}
        icon={<Store size={18} className="text-white" />}
      />
      <EnterpriseKpiCard
        variant="gold"
        label="Toplam Ciro"
        value={formatTRY(summary.totalRevenue)}
        sub="Karşılaştırma dönemi"
        icon={<DollarSign size={18} className="text-gold-700" />}
      />
      <EnterpriseKpiCard
        label="En İyi Şube"
        value={summary.topStore}
        sub="Ciro lideri"
        icon={<Award size={18} className="text-ex-red" />}
      />
      <EnterpriseKpiCard
        label="Ort. Şube Ciro"
        value={formatTRY(summary.avgRevenuePerStore)}
        sub="Ağ ortalaması"
        icon={<TrendingUp size={18} className="text-ink-600" />}
      />
      <EnterpriseKpiCard
        variant="dark"
        label="Franchise Eksik"
        value={formatNum(summary.unlinkedStores)}
        sub="Atama gerekli"
        icon={<AlertTriangle size={18} className="text-white" />}
      />
    </div>
  );
}
