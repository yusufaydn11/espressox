import { type ReactNode } from 'react';
import { Crown, UserPlus, Users, Award } from 'lucide-react';
import { Card } from '../../lib/ui';
import { formatNum } from '../../lib/utils';
import type { DashboardKpis } from '../../lib/api';

export function LoyaltySnapshot({ kpis }: { kpis: DashboardKpis }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Crown size={16} className="text-gold-600" />
        <div>
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Loyalty Durumu</h3>
          <p className="text-xs text-ink-400">Sadakat programı özeti</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={<Users size={14} className="text-ink-600" />} label="Aktif Üye" value={formatNum(kpis.activeCustomers)} />
        <Metric icon={<UserPlus size={14} className="text-green-600" />} label="Yeni Üye" value={formatNum(kpis.newMembers)} sub="Bu ay" />
        <Metric icon={<Crown size={14} className="text-amber-600" />} label="Kullanılan Puan" value={formatNum(kpis.pointsRedeemed)} />
        <Metric icon={<Award size={14} className="text-ex-red" />} label="En Çok Satan" value={kpis.topProduct.length > 12 ? `${kpis.topProduct.slice(0, 12)}…` : kpis.topProduct} small />
      </div>
    </Card>
  );
}

function Metric({ icon, label, value, sub, small }: { icon: ReactNode; label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="rounded-xl bg-cream-50 dark:bg-ink-800/50 p-3 border border-ink-100 dark:border-ink-800">
      <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">{label}</span></div>
      <p className={`font-bold text-ink-900 dark:text-ink-100 ${small ? 'text-xs' : 'text-lg'} font-display`}>{value}</p>
      {sub && <p className="text-[10px] text-ink-400 mt-0.5">{sub}</p>}
    </div>
  );
}
