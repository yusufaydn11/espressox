import { View, Text, ScrollView, type ViewStyle } from 'react-native';
import { type ReactNode } from 'react';

export function B2BScreenWrapper({ children, maxW = 460 }: { children: ReactNode; maxW?: number }) {
  return (
    <View className="flex-1">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-8 px-5 pt-3" style={{ maxWidth: maxW, width: '100%', marginLeft: 'auto', marginRight: 'auto' } as ViewStyle}>
        {children}
      </ScrollView>
    </View>
  );
}

export function B2BSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View className="mb-5">
      <Text className="text-lg font-bold text-ink-900">{title}</Text>
      {subtitle && <Text className="text-sm text-ink-400 mt-0.5">{subtitle}</Text>}
    </View>
  );
}
