import { Text, Pressable, ScrollView } from 'react-native';
import { cn } from '@/lib/utils';

interface B2BFilterChipsProps {
  options: Array<{ id: string; label: string }>;
  value: string;
  onChange: (v: string) => void;
}

export function B2BFilterChips({ options, value, onChange }: B2BFilterChipsProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
      {options.map(opt => (
        <Pressable
          key={opt.id}
          onPress={() => onChange(opt.id)}
          className={cn('px-3.5 py-2 rounded-lg', value === opt.id ? 'bg-ink-900' : 'bg-white border border-ink-100')}
        >
          <Text className={cn('text-xs font-medium', value === opt.id ? 'text-white' : 'text-ink-500')}>
            {opt.label}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
