import { Users, Crown, UserPlus, ShieldOff } from 'lucide-react';
import { EnterpriseKpiCard } from '../dashboard/EnterpriseKpiCard';
import { formatNum } from '../../lib/utils';
import type { CrmSummary } from '../../hooks/useCrmCustomers';

export function CrmKpiGrid({ summary }: { summary: CrmSummary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <EnterpriseKpiCard
        variant="primary"
        label="Toplam Müşteri"
        value={formatNum(summary.total)}
        sub="Kayıtlı profil"
        icon={<Users size={18} className="text-white" />}
      />
      <EnterpriseKpiCard
        variant="gold"
        label="VIP Üye"
        value={formatNum(summary.vip)}
        sub="Altın / Siyah / VIP"
        icon={<Crown size={18} className="text-gold-700" />}
      />
      <EnterpriseKpiCard
        label="Yeni Üye"
        value={formatNum(summary.newThisMonth)}
        sub="Bu ay katılan"
        icon={<UserPlus size={18} className="text-green-600" />}
      />
      <EnterpriseKpiCard
        variant="dark"
        label="Engelli"
        value={formatNum(summary.blocked)}
        sub="Erişimi kısıtlı"
        icon={<ShieldOff size={18} className="text-white" />}
      />
    </div>
  );
}
