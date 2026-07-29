import { View, Text, Pressable } from 'react-native';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /** Kırmızı alt çizgi — ana sayfa bölümleri */
  underline?: boolean;
  className?: string;
}

export function SectionHeader({
  title,
  subtitle,
  action,
  actionLabel,
  onAction,
  underline = false,
  className,
}: SectionHeaderProps) {
  return (
    <View className={cn('flex-row items-center justify-between mb-4', className)}>
      <View className="flex-1 min-w-0">
        <Text className="text-xl font-bold text-ink-900 leading-tight font-display">{title}</Text>
        {underline && <View className="h-0.5 w-8 bg-ex-red rounded-full mt-1.5" />}
        {subtitle && (
          <Text className={cn('text-ink-400', underline ? 'text-xs mt-2' : 'text-sm mt-0.5')}>
            {subtitle}
          </Text>
        )}
      </View>
      {action}
      {!action && actionLabel && onAction && (
        <Pressable onPress={onAction} className="flex-row items-center gap-0.5 px-3 py-1.5 rounded-full bg-ex-red/10 active:opacity-60 ml-3">
          <Text className="text-xs font-bold text-ex-red">{actionLabel}</Text>
          <ChevronRight size={14} color={colors.ex.red} />
        </Pressable>
      )}
    </View>
  );
}
