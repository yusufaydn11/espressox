import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { RefreshCw, AlertCircle, Inbox, type LucideIcon } from 'lucide-react';

export function LoadingState({ label = 'Yükleniyor…' }: { label?: string }) {
  return (
    <View className="flex-col items-center justify-center py-16">
      <ActivityIndicator size="large" color="#C8102E" />
      <Text className="text-sm text-ink-400 mt-3">{label}</Text>
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View className="flex-col items-center justify-center py-16 px-5">
      <View className="h-14 w-14 rounded-3xl bg-red-50 items-center justify-center mb-3">
        <AlertCircle size={24} color="#C8102E" />
      </View>
      <Text className="text-sm font-medium text-ink-700 text-center">{message}</Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          className="mt-4 flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-ex-red active:bg-ex-redDark"
        >
          <RefreshCw size={14} color="#fff" />
          <Text className="text-sm font-medium text-white">Tekrar dene</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ title, subtitle, icon: Icon = Inbox }: { title: string; subtitle?: string; icon?: LucideIcon }) {
  return (
    <View className="flex-col items-center justify-center py-16 px-5">
      <View className="h-14 w-14 rounded-3xl bg-ink-100 items-center justify-center mb-3">
        <Icon size={24} color="#9494A0" />
      </View>
      <Text className="text-sm font-medium text-ink-700 text-center">{title}</Text>
      {subtitle && <Text className="text-xs text-ink-400 text-center mt-1 max-w-xs">{subtitle}</Text>}
    </View>
  );
}

export function StateWrapper({
  loading, error, empty, loadingLabel, emptyTitle, emptySubtitle, onRetry, emptyIcon, children,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  loadingLabel?: string;
  emptyTitle?: string;
  emptySubtitle?: string;
  onRetry?: () => void;
  emptyIcon?: LucideIcon;
  children: React.ReactNode;
}) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (error) return <ErrorState message={error} onRetry={onRetry} />;
  if (empty) return <EmptyState title={emptyTitle ?? 'Henüz veri yok'} subtitle={emptySubtitle} icon={emptyIcon} />;
  return <>{children}</>;
}
