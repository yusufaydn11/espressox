/** Notification type labels (in-app display). */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  order: 'Sipariş',
  admin: 'Duyuru',
  reward: 'Ödül',
  promotion: 'Kampanya',
  system: 'Sistem',
};

export const NOTIFICATION_SOURCE_B2B_PREFIX = 'b2b';

export function isB2BSource(source?: string | null): boolean {
  return !!source && source.startsWith(NOTIFICATION_SOURCE_B2B_PREFIX);
}

export function filterNotificationsByStoreId<T extends { data: Record<string, unknown> | null }>(
  rows: T[],
  storeId: string | null,
): T[] {
  if (!storeId) return rows;
  return rows.filter(row => {
    const sid = row.data?.store_id;
    return sid == null || sid === storeId;
  });
}

export type NotificationTapAction = {
  orderId?: string;
  source?: string;
  deepLink?: string;
  openB2BOrder: boolean;
  openStoreOrders: boolean;
};

/** Central deep-link / tap resolution for notification payloads. */
export function resolveNotificationTapAction(
  data: Record<string, unknown> | null | undefined,
): NotificationTapAction {
  const orderId = typeof data?.order_id === 'string' ? data.order_id : undefined;
  const source = typeof data?.source === 'string' ? data.source : undefined;
  const deepLink = typeof data?.deep_link === 'string' ? data.deep_link : undefined;
  const isB2B = isB2BSource(source);

  return {
    orderId,
    source,
    deepLink,
    openB2BOrder: !!orderId && isB2B,
    openStoreOrders: !!orderId && !isB2B,
  };
}

/** Push notification cold-start / tap handler (B2B order only). */
export function resolvePushNotificationOrderId(
  data: Record<string, unknown> | undefined,
): string | null {
  const action = resolveNotificationTapAction(data);
  if (action.orderId && action.openB2BOrder) return action.orderId;
  return null;
}

/** Read/unread badge tokens (NativeWind + hex icon colors). */
export const NOTIFICATION_BADGE_READ = {
  container: 'bg-ink-50',
  iconColor: '#9494A0',
} as const;

export const NOTIFICATION_BADGE_UNREAD = {
  container: 'bg-ex-red/10',
  iconColor: '#C8102E',
} as const;

export function getNotificationBadge(isRead: boolean) {
  return isRead ? NOTIFICATION_BADGE_READ : NOTIFICATION_BADGE_UNREAD;
}

/** Preference category labels (settings sheet). */
export const NOTIFICATION_PREF_LABELS: Record<string, { label: string; desc: string }> = {
  order_updates: {
    label: 'Sipariş güncellemeleri',
    desc: 'Sipariş durumu, hazırlık ve teslimat bildirimleri',
  },
  promotions: {
    label: 'Kampanya ve indirimler',
    desc: 'Mutlu saat, mevsimsel kampanya ve özel fırsatlar',
  },
  rewards: {
    label: 'Ödül ve puan',
    desc: 'Puan kazançları, ödül açılışı ve seviye yükselmeleri',
  },
  challenges: {
    label: 'Görev hatırlatmaları',
    desc: 'Haftalık görevler ve seri uyarıları',
  },
};
