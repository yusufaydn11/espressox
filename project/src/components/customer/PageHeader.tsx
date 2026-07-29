import { View, Text, Pressable } from 'react-native';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function PageHeader({ title, subtitle, actionLabel, onAction, className }: PageHeaderProps) {
  return (
    <View className={cn('flex-row items-center justify-between mb-6', className)}>
      <View className="flex-1 min-w-0">
        <Text className="text-3xl font-bold text-ink-900 font-display tracking-tight">{title}</Text>
        {subtitle && <Text className="text-sm text-ink-400 mt-1">{subtitle}</Text>}
        <View className="h-0.5 w-10 bg-ex-red rounded-full mt-3" />
      </View>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} className="flex-row items-center gap-0.5 px-3 py-1.5 rounded-full bg-ex-red/10 active:opacity-60 ml-3 mb-1">
          <Text className="text-xs font-bold text-ex-red">{actionLabel}</Text>
          <ChevronRight size={14} color={colors.ex.red} />
        </Pressable>
      )}
    </View>
  );
}
