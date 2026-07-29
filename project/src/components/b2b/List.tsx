import { View, Text, Pressable } from 'react-native';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface B2BListProps {
  children: ReactNode;
  gap?: number;
}

export function B2BList({ children, gap = 12 }: B2BListProps) {
  return <View style={{ gap }}>{children}</View>;
}

interface B2BListRowProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  showChevron?: boolean;
  divider?: boolean;
}

export function B2BListRow({ icon, title, subtitle, right, onPress, showChevron, divider }: B2BListRowProps) {
  const content = (
    <View className={cn('flex-row items-center gap-3 py-2.5', divider && 'border-t border-ink-50')}>
      {icon && <View className="h-10 w-10 rounded-xl bg-cream-100 items-center justify-center shrink-0">{icon}</View>}
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-bold text-ink-900" numberOfLines={1}>{title}</Text>
        {subtitle && <Text className="text-[11px] text-ink-400 mt-0.5" numberOfLines={1}>{subtitle}</Text>}
      </View>
      {right}
      {showChevron && <Text className="text-ink-300">›</Text>}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}
