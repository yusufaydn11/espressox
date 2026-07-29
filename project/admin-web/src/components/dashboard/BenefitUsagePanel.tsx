import { Gift, Coffee, Sparkles } from 'lucide-react';
import { Card, Spinner, ErrorState } from '../../lib/ui';
import { formatNum } from '../../lib/utils';
import type { BenefitUsageDailyStats } from '@shared/types/operations';

export function BenefitUsagePanel({
  stats,
  loading,
  error,
  onRetry,
}: {
  stats: BenefitUsageDailyStats | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-ex-red" />
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Bugünkü Avantaj Kullanımı</h3>
      </div>
      {loading ? <Spinner label="Yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={onRetry} /> :
       !stats ? null : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Stat icon={Coffee} label="Ücretsiz sipariş" value={formatNum(stats.freeOrders)} />
          <Stat icon={Gift} label="Damga ödülü" value={formatNum(stats.stampRedemptions)} />
          <Stat icon={Gift} label="Puan ödülü" value={formatNum(stats.rewardRedemptions)} />
          <Stat icon={Sparkles} label="Kampanya bildirimi" value={formatNum(stats.campaignNotifications)} />
          <Stat icon={Sparkles} label="Harcanan puan" value={formatNum(stats.pointsRedeemed)} />
        </div>
      )}
    </Card>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Gift; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 dark:bg-ink-800/50 p-3 border border-ink-100 dark:border-ink-800">
      <Icon size={14} className="text-ex-red mb-1" />
      <p className="text-lg font-bold text-ink-900 dark:text-ink-100 font-display">{value}</p>
      <p className="text-[10px] font-semibold text-ink-500 uppercase">{label}</p>
    </div>
  );
}
