import { View, Text } from 'react-native';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, action, className }: SectionHeaderProps) {
  return (
    <View className={cn('flex-row items-end justify-between mb-4', className)}>
      <View className="flex-1">
        <Text className="text-xl font-bold text-ink-900 leading-tight">{title}</Text>
        {subtitle && <Text className="text-sm text-ink-400 mt-0.5">{subtitle}</Text>}
      </View>
      {action}
    </View>
  );
}
