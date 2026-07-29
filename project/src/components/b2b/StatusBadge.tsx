import { View, Text } from 'react-native';
import { cn } from '@/lib/utils';

const TONE_STYLES: Record<string, { bg: string; text: string }> = {
  neutral: { bg: 'bg-ink-100', text: 'text-ink-600' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-700' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-700' },
  green: { bg: 'bg-green-50', text: 'text-green-700' },
  red: { bg: 'bg-red-50', text: 'text-ex-red' },
  gold: { bg: 'bg-amber-50', text: 'text-amber-700' },
  dark: { bg: 'bg-ink-900', text: 'text-white' },
};

interface B2BStatusBadgeProps {
  label: string;
  tone?: string;
}

export function B2BStatusBadge({ label, tone = 'neutral' }: B2BStatusBadgeProps) {
  const s = TONE_STYLES[tone] ?? TONE_STYLES.neutral;
  return (
    <View className={cn('px-2.5 py-1 rounded-full', s.bg)}>
      <Text className={cn('text-[10px] font-semibold', s.text)}>{label}</Text>
    </View>
  );
}
