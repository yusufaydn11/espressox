/** Customer notification inbox categories (UI grouping). */
export type CustomerNotificationCategory = 'order' | 'campaign' | 'loyalty' | 'system';

export const CUSTOMER_NOTIFICATION_CATEGORIES: {
  id: CustomerNotificationCategory | 'all';
  label: string;
}[] = [
  { id: 'all', label: 'Tümü' },
  { id: 'order', label: 'Sipariş' },
  { id: 'campaign', label: 'Kampanya' },
  { id: 'loyalty', label: 'Loyalty' },
  { id: 'system', label: 'Sistem' },
];

const CATEGORY_BY_TYPE: Record<string, CustomerNotificationCategory> = {
  order: 'order',
  promotion: 'campaign',
  promo: 'campaign',
  campaign: 'campaign',
  reward: 'loyalty',
  admin: 'system',
  system: 'system',
};

export function getCustomerNotificationCategory(type: string): CustomerNotificationCategory {
  return CATEGORY_BY_TYPE[type] ?? 'system';
}
