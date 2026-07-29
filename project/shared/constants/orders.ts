/** Store order status flow (franchise panel advance buttons). */
export const ORDER_STATUS_FLOW = ['preparing', 'ready', 'picked-up', 'delivered'] as const;

/** Admin-web order management labels. */
export const ORDER_STATUS_LABELS_ADMIN: Record<string, string> = {
  all: 'Tümü',
  pending: 'Yeni',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  'picked-up': 'Teslim Alındı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};

/** Customer app order history labels. */
export const ORDER_STATUS_LABELS_CUSTOMER: Record<string, string> = {
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  'picked-up': 'Teslim Alındı',
  delivered: 'Teslim Edildi',
  scheduled: 'Planlandı',
  cancelled: 'İptal Edildi',
};

/** Franchise mobile panel labels. */
export const ORDER_STATUS_LABELS_FRANCHISE: Record<string, string> = {
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  'picked-up': 'Alındı',
  delivered: 'Teslim Edildi',
  scheduled: 'Planlandı',
  cancelled: 'İptal',
};

/** NativeWind badge background classes (franchise panel). */
export const ORDER_STATUS_BADGE_BG: Record<string, string> = {
  preparing: 'bg-amber-50',
  ready: 'bg-blue-50',
  'picked-up': 'bg-green-50',
  delivered: 'bg-green-50',
  scheduled: 'bg-ink-100',
  cancelled: 'bg-red-50',
};

/** NativeWind badge text classes (franchise panel). */
export const ORDER_STATUS_BADGE_TEXT: Record<string, string> = {
  preparing: 'text-amber-700',
  ready: 'text-blue-700',
  'picked-up': 'text-green-700',
  delivered: 'text-green-700',
  scheduled: 'text-ink-600',
  cancelled: 'text-ex-red',
};

/** Customer order history chip colors (NativeWind). */
export const ORDER_STATUS_CHIP_CLASSES: Record<string, string> = {
  preparing: 'bg-red-50 text-ex-red',
  ready: 'bg-green-100 text-green-700',
  'picked-up': 'bg-ink-100 text-ink-600',
  delivered: 'bg-ink-100 text-ink-600',
  scheduled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-ex-red',
};

export function nextOrderStatus(current: string): string | null {
  const idx = ORDER_STATUS_FLOW.indexOf(current as typeof ORDER_STATUS_FLOW[number]);
  if (idx === -1 || idx === ORDER_STATUS_FLOW.length - 1) return null;
  return ORDER_STATUS_FLOW[idx + 1];
}
