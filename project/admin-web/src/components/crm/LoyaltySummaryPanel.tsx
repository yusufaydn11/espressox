import { type ReactNode } from 'react';
import { Crown, Flame, Wallet, TrendingUp } from 'lucide-react';
import { Card, Badge } from '../../lib/ui';
import { formatNum } from '../../lib/utils';
import { tierColor, TIERS } from '@shared/constants/loyalty';
import type { UserProfile } from '../../lib/supabase';

export function LoyaltySummaryPanel({ customer }: { customer: UserProfile }) {
  const tierInfo = TIERS.find(t => t.name === customer.tier || t.name === customer.tier.replace('Altin', 'Altın').replace('Gumus', 'Gümüş'));
  const nextTier = TIERS.find(t => t.minPoints > customer.lifetime_points);
  const progress = nextTier
    ? Math.min(100, Math.round((customer.lifetime_points / nextTier.minPoints) * 100))
    : 100;

  return (
    <Card className="p-5 min-w-0">
      <div className="flex items-center gap-2 mb-4">
        <Crown size={16} className="text-gold-600" />
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Sadakat Özeti</h3>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: `${tierColor(customer.tier)}20` }}
        >
          <Crown size={22} style={{ color: tierColor(customer.tier) }} />
        </div>
        <div>
          <Badge tone="gold">{customer.tier}</Badge>
          {tierInfo && <p className="text-xs text-ink-400 mt-1">{tierInfo.perks[0]}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Stat icon={<TrendingUp size={14} className="text-ex-red" />} label="Mevcut Puan" value={formatNum(customer.points)} />
        <Stat icon={<Wallet size={14} className="text-ink-600" />} label="Yaşam Boyu" value={formatNum(customer.lifetime_points)} />
        <Stat icon={<Flame size={14} className="text-amber-600" />} label="Seri" value={`${customer.streak} gün`} />
        <Stat icon={<Wallet size={14} className="text-green-600" />} label="Cüzdan" value={formatNum(customer.reward_wallet)} />
      </div>

      {nextTier && (
        <div>
          <div className="flex justify-between text-xs text-ink-500 mb-1.5">
            <span>{customer.tier} → {nextTier.name}</span>
            <span>%{progress}</span>
          </div>
          <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
            <div className="h-full rounded-full bg-red-gradient" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-cream-50 dark:bg-ink-800/50 p-3 border border-ink-100 dark:border-ink-800">
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[10px] font-semibold text-ink-500 uppercase">{label}</span></div>
      <p className="text-lg font-bold text-ink-900 dark:text-ink-100 font-display">{value}</p>
    </div>
  );
}
