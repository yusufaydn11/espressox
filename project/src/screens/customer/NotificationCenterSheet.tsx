import { useMemo, useState, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Bell, ShoppingBag, Gift, Crown, Info } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNotifications, markNotificationRead } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { Card } from '@/components/ui/Card';
import { StateWrapper } from '@/components/ui/States';
import { cn } from '@/lib/utils';
import {
  CUSTOMER_NOTIFICATION_CATEGORIES,
  getCustomerNotificationCategory,
  type CustomerNotificationCategory,
} from '@shared/constants/customerNotifications';
import { getNotificationBadge } from '@shared/constants/notifications';
import type { NotificationRow } from '@/lib/supabase';

const CATEGORY_ICONS: Record<CustomerNotificationCategory, typeof Bell> = {
  order: ShoppingBag,
  campaign: Gift,
  loyalty: Crown,
  system: Info,
};

function filterByCategory(rows: NotificationRow[], category: CustomerNotificationCategory | 'all') {
  if (category === 'all') return rows;
  return rows.filter(n => getCustomerNotificationCategory(n.type) === category);
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

export function NotificationCenterSheet() {
  const { sheet, closeSheet, openSheet } = useApp();
  const open = sheet === 'notification-inbox';
  const { data: notifications, loading, error, reload, setData } = useNotifications();
  const [category, setCategory] = useState<CustomerNotificationCategory | 'all'>('all');

  const filtered = useMemo(
    () => filterByCategory(notifications ?? [], category),
    [notifications, category],
  );

  const unreadCount = useMemo(
    () => (notifications ?? []).filter(n => !n.is_read).length,
    [notifications],
  );

  const handleOpen = useCallback(async (n: NotificationRow) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setData(prev => (prev ?? []).map(row => (row.id === n.id ? { ...row, is_read: true } : row)));
    }
    if (getCustomerNotificationCategory(n.type) === 'order') {
      closeSheet();
      openSheet('orders');
    }
  }, [closeSheet, openSheet, setData]);

  return (
    <Sheet
      open={open}
      onClose={closeSheet}
      title={unreadCount > 0 ? `Bildirimler (${unreadCount})` : 'Bildirimler'}
    >
      <View className="flex-row flex-wrap gap-2 mb-4">
        {CUSTOMER_NOTIFICATION_CATEGORIES.map(cat => (
          <Pressable
            key={cat.id}
            onPress={() => setCategory(cat.id)}
            className={cn(
              'px-3 py-1.5 rounded-full border',
              category === cat.id
                ? 'bg-ink-900 border-ink-900'
                : 'bg-white border-ink-200',
            )}
          >
            <Text
              className={cn(
                'text-xs font-semibold',
                category === cat.id ? 'text-white' : 'text-ink-600',
              )}
            >
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        loadingLabel="Bildirimler yükleniyor…"
        emptyTitle="Bildirim yok"
        emptySubtitle="Sipariş ve kampanya güncellemeleri burada görünecek"
        emptyIcon={Bell}
        onRetry={reload}
      >
        <View className="gap-2.5">
          {filtered.map(n => {
            const cat = getCustomerNotificationCategory(n.type);
            const Icon = CATEGORY_ICONS[cat];
            const badge = getNotificationBadge(n.is_read);

            return (
              <Pressable key={n.id} onPress={() => void handleOpen(n)} className="active:scale-[0.99]">
                <Card className={cn('p-4 flex-row gap-3', !n.is_read && 'border-ex-red/20')}>
                  <View className={cn('h-10 w-10 rounded-xl items-center justify-center', badge.container)}>
                    <Icon size={18} color={badge.iconColor} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold text-ink-900 flex-1" numberOfLines={1}>
                        {n.title}
                      </Text>
                      {!n.is_read && <View className="h-2 w-2 rounded-full bg-ex-red" />}
                    </View>
                    <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={2}>{n.body}</Text>
                    <Text className="text-[10px] text-ink-400 mt-1.5">{formatRelativeTime(n.created_at)}</Text>
                  </View>
                </Card>
              </Pressable>
            );
          })}
        </View>
      </StateWrapper>
    </Sheet>
  );
}
