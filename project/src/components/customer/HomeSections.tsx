import { View, Text, Pressable } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';

interface HomeQuickLinkProps {
  icon: LucideIcon;
  label: string;
  sub: string;
  badge?: string;
  onPress: () => void;
}

export function HomeQuickLink({ icon: Icon, label, sub, badge, onPress }: HomeQuickLinkProps) {
  return (
    <Pressable onPress={onPress} className="active:scale-[0.98]">
      <Card className="p-4 flex-row items-center gap-3.5">
        <View className="h-11 w-11 rounded-2xl bg-cream-100 items-center justify-center">
          <Icon size={19} color="#C8102E" />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-ink-900" numberOfLines={1}>{label}</Text>
          <Text className="text-[11px] text-ink-400 mt-0.5" numberOfLines={1}>{sub}</Text>
        </View>
        {badge && (
          <View className={cn('px-2 py-0.5 rounded-full', badge === 'Açık' ? 'bg-green-50' : 'bg-red-50')}>
            <Text
              className={cn(
                'text-[10px] font-bold uppercase tracking-wide',
                badge === 'Açık' ? 'text-green-600' : 'text-ex-red',
              )}
            >
              {badge}
            </Text>
          </View>
        )}
        <ChevronRight size={18} color="#C4C4CC" />
      </Card>
    </Pressable>
  );
}

interface HomeSectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function HomeSectionHeader({ title, subtitle, actionLabel, onAction }: HomeSectionHeaderProps) {
  return (
    <View className="flex-row items-end justify-between px-5 mb-3">
      <View className="flex-1">
        <Text className="text-lg font-bold text-ink-900 font-display">{title}</Text>
        {subtitle && <Text className="text-xs text-ink-400 mt-0.5">{subtitle}</Text>}
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} className="active:opacity-60">
          <Text className="text-xs font-semibold text-ex-red">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
