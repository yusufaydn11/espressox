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

export function B2BSectionTitle({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: string }) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center gap-2">
        <View className="h-6 w-1 rounded-full bg-ex-red" />
        <Text className="text-xl font-bold text-ink-900 font-display flex-1">{title}</Text>
        {badge && (
          <View className="px-2.5 py-1 rounded-full bg-gold-100 border border-gold-200">
            <Text className="text-[10px] font-bold text-gold-700 uppercase tracking-wide">{badge}</Text>
          </View>
        )}
      </View>
      {subtitle && <Text className="text-sm text-ink-500 mt-1.5 ml-3">{subtitle}</Text>}
    </View>
  );
}
