import { View, Text, Pressable } from 'react-native';
import { type ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';

export function B2BLoadingSpinner({ label }: { label?: string }) {
  return (
    <View className="items-center justify-center py-20">
      <View className="h-8 w-8 rounded-full border-2 border-ex-red border-t-transparent" />
      {label && <Text className="text-sm text-ink-400 mt-3">{label}</Text>}
    </View>
  );
}

export function B2BErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="items-center justify-center py-20 px-5">
      <View className="h-12 w-12 rounded-2xl bg-ex-100 items-center justify-center mb-3">
        <AlertCircle size={22} color="#C8102E" />
      </View>
      <Text className="text-sm font-medium text-ink-700 text-center">{message}</Text>
      {onRetry && (
        <Pressable onPress={onRetry} className="mt-4 px-4 py-2 rounded-xl bg-white border border-ink-200">
          <Text className="text-sm text-ink-600">Tekrar dene</Text>
        </Pressable>
      )}
    </View>
  );
}

export function B2BEmptyState({ title, subtitle, icon, action }: {
  title: string; subtitle?: string; icon?: ReactNode; action?: ReactNode;
}) {
  return (
    <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-10 items-center">
      <View className="h-14 w-14 rounded-2xl bg-cream-100 items-center justify-center mb-3">
        {icon ?? <Inbox size={28} color="#C8C4CC" />}
      </View>
      <Text className="text-sm font-medium text-ink-600">{title}</Text>
      {subtitle && <Text className="text-xs text-ink-400 mt-1.5 text-center leading-relaxed max-w-[240px]">{subtitle}</Text>}
      {action && <View className="mt-4">{action}</View>}
    </View>
  );
}
