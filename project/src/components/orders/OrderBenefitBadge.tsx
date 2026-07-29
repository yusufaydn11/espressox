import { View, Text } from 'react-native';
import type { OrderBenefitInfo } from '@shared/types/operations';
import { cn } from '@/lib/utils';

const TONE: Record<OrderBenefitInfo['badgeTone'], { bg: string; text: string }> = {
  default: { bg: 'bg-ink-100', text: 'text-ink-600' },
  green: { bg: 'bg-green-100', text: 'text-green-700' },
  gold: { bg: 'bg-amber-100', text: 'text-amber-800' },
  red: { bg: 'bg-red-100', text: 'text-ex-red' },
};

export function OrderBenefitBadge({ benefit, compact }: { benefit: OrderBenefitInfo; compact?: boolean }) {
  const tone = TONE[benefit.badgeTone];
  return (
    <View className={cn('self-start px-2 py-0.5 rounded-full', tone.bg)}>
      <Text className={cn('font-bold uppercase', compact ? 'text-[8px]' : 'text-[9px]', tone.text)}>
        {benefit.label}
      </Text>
    </View>
  );
}

export function OrderBenefitDetail({ benefit }: { benefit: OrderBenefitInfo }) {
  return (
    <View className="rounded-xl bg-cream-50 border border-ink-100 p-3 gap-1">
      <View className="flex-row items-center gap-2">
        <OrderBenefitBadge benefit={benefit} />
        {benefit.pointsSpent != null && benefit.pointsSpent > 0 && (
          <Text className="text-[10px] text-ink-500">-{benefit.pointsSpent} puan</Text>
        )}
        {benefit.pointsEarned != null && benefit.pointsEarned > 0 && (
          <Text className="text-[10px] text-ex-red">+{benefit.pointsEarned} puan</Text>
        )}
      </View>
      <Text className="text-xs text-ink-600">{benefit.detail}</Text>
    </View>
  );
}
