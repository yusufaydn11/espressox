/** B2B notification inbox categories (UI grouping from notifications.data.source) */

export type B2BNotificationCategory = 'order' | 'payment' | 'shipping' | 'system';

export const B2B_NOTIFICATION_CATEGORIES: {
  id: B2BNotificationCategory | 'all';
  label: string;
}[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'order', label: 'Sipariş' },
  { id: 'payment', label: 'Ödeme' },
  { id: 'shipping', label: 'Kargo' },
  { id: 'system', label: 'Sistem' },
];

export function getB2BNotificationCategory(source?: string | null, type?: string): B2BNotificationCategory {
  if (source === 'b2b_payment') return 'payment';
  if (source === 'b2b_shipping') return 'shipping';
  if (source === 'b2b_admin_note' || source === 'b2b_hq') return 'system';
  if (source === 'b2b' || type === 'order') return 'order';
  return 'system';
}
