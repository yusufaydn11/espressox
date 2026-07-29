import { View, Text } from 'react-native';
import { Gift, Crown, Zap, Coffee, Bell, Tag, CreditCard } from 'lucide-react';
import type { LoyaltyTimelineItem } from '@shared/types/operations';
import { cn } from '@/lib/utils';

const ICONS = {
  points: Zap,
  stamp: Coffee,
  reward: Gift,
  free_coffee: Coffee,
  qr: Crown,
  campaign: Bell,
  coupon: Tag,
  payment: CreditCard,
};

export function LoyaltyTimelineList({
  items,
  emptyLabel = 'Henüz kayıt yok',
}: {
  items: LoyaltyTimelineItem[];
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return (
      <View className="py-8 items-center">
        <Text className="text-sm text-ink-400">{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {items.map(item => {
        const Icon = ICONS[item.category] ?? Gift;
        return (
          <View key={item.id} className="flex-row gap-3 p-3 rounded-2xl bg-white border border-ink-100">
            <View className="h-9 w-9 rounded-xl bg-red-50 items-center justify-center shrink-0">
              <Icon size={15} color="#C8102E" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-semibold text-ink-900">{item.title}</Text>
              <Text className="text-[11px] text-ink-400 mt-0.5">{item.subtitle}</Text>
              <Text className="text-[10px] text-ink-300 mt-1">
                {new Date(item.at).toLocaleString('tr-TR')}
              </Text>
            </View>
            {item.delta != null && (
              <Text className={cn('text-xs font-bold shrink-0', item.delta >= 0 ? 'text-ex-red' : 'text-ink-500')}>
                {item.delta >= 0 ? '+' : ''}{item.delta}{item.category === 'points' || item.category === 'qr' ? ' puan' : ''}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
