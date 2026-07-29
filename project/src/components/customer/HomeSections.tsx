import { View, Text, Pressable } from 'react-native';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface HomeQuickLinkProps {
  icon: LucideIcon;
  label: string;
  sub: string;
  badge?: string;
  onPress: () => void;
}

export function HomeQuickLink({ icon: Icon, label, sub, badge, onPress }: HomeQuickLinkProps) {
  return (
    <Pressable onPress={onPress} className="active:scale-[0.99] flex-1 min-w-[280px]">
      <View className="p-4 flex-row items-center gap-3.5 bg-white rounded-2xl shadow-soft border border-cream-100">
        <View className="h-11 w-11 rounded-xl bg-ex-red/10 items-center justify-center">
          <Icon size={19} color={colors.ex.red} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-bold text-ink-900" numberOfLines={1}>{label}</Text>
          <Text className="text-xs text-ink-400 mt-0.5" numberOfLines={1}>{sub}</Text>
        </View>
        {badge && (
          <View className={cn('px-2.5 py-1 rounded-full', badge === 'Açık' ? 'bg-green-50' : 'bg-ex-red/10')}>
            <Text className={cn('text-[10px] font-bold', badge === 'Açık' ? 'text-green-600' : 'text-ex-red')}>{badge}</Text>
          </View>
        )}
        <View className="h-8 w-8 rounded-full bg-cream-50 items-center justify-center">
          <ChevronRight size={15} color={colors.ink[300]} />
        </View>
      </View>
    </Pressable>
  );
}

interface HomeSectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function HomeSectionHeader(props: HomeSectionHeaderProps) {
  return <SectionHeader {...props} underline className="mb-3" />;
}
