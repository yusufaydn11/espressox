import { View, Text } from 'react-native';
import {
  Inbox, Heart, ShoppingBag, Gift, Bell, Coffee, MapPin, type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { emptyStateVariants } from '@shared/design/componentVariants';

type PresetId = 'orders' | 'favorites' | 'campaigns' | 'notifications' | 'products';

const PRESETS: Record<PresetId, {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}> = {
  orders: {
    title: 'Henüz siparişin yok',
    subtitle: 'İlk siparişini ver, puan kazanmaya başla',
    icon: ShoppingBag,
  },
  favorites: {
    title: 'Favori ürünün yok',
    subtitle: 'Menüden kalp ikonuna dokunarak favorilerine ekle',
    icon: Heart,
  },
  campaigns: {
    title: 'Aktif kampanya yok',
    subtitle: 'Yeni fırsatlar için takipte kal',
    icon: Gift,
  },
  notifications: {
    title: 'Bildirim yok',
    subtitle: 'Sipariş ve kampanya güncellemeleri burada görünecek',
    icon: Bell,
  },
  products: {
    title: 'Ürün bulunamadı',
    subtitle: 'Menüyü kontrol et veya daha sonra tekrar dene',
    icon: Coffee,
  },
};

interface CustomerEmptyStateProps {
  preset?: PresetId;
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
  className?: string;
}

export function CustomerEmptyState({
  preset,
  title,
  subtitle,
  icon,
  actionLabel,
  onAction,
  compact,
  className,
}: CustomerEmptyStateProps) {
  const presetData = preset ? PRESETS[preset] : null;
  const Icon = icon ?? presetData?.icon ?? Inbox;
  const displayTitle = title ?? presetData?.title ?? 'Henüz veri yok';
  const displaySubtitle = subtitle ?? presetData?.subtitle;

  return (
    <View
      className={cn(
        'flex-col items-center justify-center px-5',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      <View
        className={cn(
          'items-center justify-center mb-3 rounded-3xl bg-cream-100',
          compact ? 'h-12 w-12' : 'h-16 w-16',
        )}
      >
        <Icon size={compact ? 20 : 26} color={emptyStateVariants.default.iconColor} />
      </View>
      <Text className="text-sm font-semibold text-ink-800 text-center">{displayTitle}</Text>
      {displaySubtitle && (
        <Text className="text-xs text-ink-500 text-center mt-1.5 max-w-xs leading-relaxed">
          {displaySubtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button variant="outline" size="sm" className="mt-4" onPress={onAction}>
          {actionLabel}
        </Button>
      )}
    </View>
  );
}

export function CustomerEmptyCard({
  preset,
  actionLabel,
  onAction,
}: {
  preset: PresetId;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View className="rounded-2xl border border-cream-100 bg-white shadow-soft overflow-hidden">
      <CustomerEmptyState preset={preset} compact actionLabel={actionLabel} onAction={onAction} />
    </View>
  );
}

export { MapPin };
