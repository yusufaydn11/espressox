import { View, Text } from 'react-native';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface B2BStatTileProps {
  label: string;
  value: string;
  icon?: ReactNode;
  accent?: string;
  sub?: string;
}

export function B2BStatTile({ label, value, icon, accent = 'bg-ex-red/10', sub }: B2BStatTileProps) {
  return (
    <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-4 flex-1 min-w-[140px]">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{label}</Text>
        {icon && <View className={cn('h-8 w-8 rounded-lg items-center justify-center', accent)}>{icon}</View>}
      </View>
      <Text className="text-xl font-bold text-ink-900 mt-2">{value}</Text>
      {sub && <Text className="text-[11px] text-ink-400 mt-0.5">{sub}</Text>}
    </View>
  );
}
