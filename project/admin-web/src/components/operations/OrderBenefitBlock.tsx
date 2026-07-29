import type { OrderBenefitInfo } from '@shared/types/operations';

const TONE: Record<OrderBenefitInfo['badgeTone'], string> = {
  default: 'bg-ink-100 text-ink-600',
  green: 'bg-green-100 text-green-700',
  gold: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-ex-red',
};

export function OrderBenefitBlock({ benefit }: { benefit: OrderBenefitInfo }) {
  return (
    <div className="rounded-xl bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700 p-3 space-y-1">
      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${TONE[benefit.badgeTone]}`}>
        {benefit.label}
      </span>
      <p className="text-sm text-ink-700 dark:text-ink-200">{benefit.detail}</p>
      <div className="flex gap-3 text-xs text-ink-500">
        {benefit.pointsSpent != null && benefit.pointsSpent > 0 && <span>-{benefit.pointsSpent} puan harcandı</span>}
        {benefit.pointsEarned != null && benefit.pointsEarned > 0 && <span className="text-ex-red">+{benefit.pointsEarned} puan</span>}
      </div>
    </div>
  );
}
