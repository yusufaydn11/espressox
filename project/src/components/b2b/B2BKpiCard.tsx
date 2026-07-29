import { View, Text } from 'react-native';
import { type ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { cn } from '@/lib/utils';

interface B2BKpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  variant?: 'default' | 'primary' | 'gold' | 'dark';
  className?: string;
}

export function B2BKpiCard({ label, value, sub, icon, variant = 'default', className }: B2BKpiCardProps) {
  if (variant === 'primary') {
    return (
      <View className={cn('flex-1 min-w-[148px] rounded-2xl overflow-hidden shadow-red', className)}>
        <LinearGradient colors={['#C8102E', '#A00D24']} className="p-4">
          <View className="flex-row items-start justify-between">
            <Text className="text-[10px] font-bold text-white/80 uppercase tracking-wider">{label}</Text>
            {icon && <View className="h-8 w-8 rounded-lg bg-white/15 items-center justify-center">{icon}</View>}
          </View>
          <Text className="text-2xl font-bold text-white mt-2 font-display">{value}</Text>
          {sub && <Text className="text-[11px] text-white/70 mt-0.5">{sub}</Text>}
        </LinearGradient>
      </View>
    );
  }

  const accents: Record<string, string> = {
    default: 'bg-white border-ink-100',
    gold: 'bg-gold-50 border-gold-200',
    dark: 'bg-ink-900 border-ink-800',
  };

  return (
    <View className={cn('flex-1 min-w-[148px] rounded-2xl border shadow-card p-4', accents[variant], className)}>
      <View className="flex-row items-start justify-between">
        <Text className={cn('text-[10px] font-bold uppercase tracking-wider', variant === 'dark' ? 'text-ink-400' : 'text-ink-400')}>
          {label}
        </Text>
        {icon && (
          <View className={cn('h-8 w-8 rounded-xl items-center justify-center', variant === 'dark' ? 'bg-ink-800' : 'bg-cream-100')}>
            {icon}
          </View>
        )}
      </View>
      <Text className={cn('text-2xl font-bold mt-2 font-display', variant === 'dark' ? 'text-white' : 'text-ink-900')}>
        {value}
      </Text>
      {sub && <Text className={cn('text-[11px] mt-0.5', variant === 'dark' ? 'text-ink-400' : 'text-ink-500')}>{sub}</Text>}
    </View>
  );
}
