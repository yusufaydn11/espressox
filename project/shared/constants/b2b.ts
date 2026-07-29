import type { B2BStatusTone } from '../types/b2b';

/** Mobile B2B module — full status label set. */
export const B2B_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  awaiting_payment: 'Ödeme Bekleniyor',
  paid: 'Onay Bekleniyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
};

/** Admin-web HQ panel — slightly different copy for paid/all filters. */
export const B2B_STATUS_LABELS_HQ: Record<string, string> = {
  all: 'Tümü',
  awaiting_payment: 'Ödeme Bekleniyor',
  paid: 'Bekliyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
};

export const B2B_INVOICE_STATUS_LABELS: Record<string, string> = {
  issued: 'Kesildi',
  paid: 'Ödendi',
  partial: 'Kısmi Ödeme',
  cancelled: 'İptal',
};

export const B2B_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  success: 'Başarılı',
  failed: 'Başarısız',
  refunded: 'İade',
};

export const B2B_RISK_LABELS: Record<string, string> = {
  normal: 'Normal',
  warning: 'Uyarı',
  blocked: 'Bloke',
};

export const B2B_ORDER_STATUS_TONES: Record<string, string> = {
  draft: 'neutral',
  awaiting_payment: 'amber',
  paid: 'blue',
  confirmed: 'blue',
  preparing: 'gold',
  shipped: 'dark',
  delivered: 'green',
  cancelled: 'red',
};

/** Admin-web tone map (paid uses amber). */
export const B2B_STATUS_TONES_HQ: Record<string, B2BStatusTone> = {
  awaiting_payment: 'amber',
  paid: 'amber',
  confirmed: 'blue',
  preparing: 'amber',
  shipped: 'dark',
  delivered: 'green',
  cancelled: 'red',
};

export const B2B_INVOICE_STATUS_TONES: Record<string, string> = {
  issued: 'amber',
  paid: 'green',
  partial: 'neutral',
  cancelled: 'red',
};

export const B2B_PAYMENT_STATUS_TONES: Record<string, string> = {
  pending: 'amber',
  success: 'green',
  failed: 'red',
  refunded: 'neutral',
};

export const B2B_RISK_TONES: Record<string, string> = {
  normal: 'green',
  warning: 'amber',
  blocked: 'red',
};

export const B2B_STATUS_FLOW = ['paid', 'confirmed', 'preparing', 'shipped', 'delivered'] as const;

export const B2B_TIMELINE_LABELS: Record<string, string> = {
  b2b_order_created: 'Sipariş Oluşturuldu',
  b2b_order_status_change: 'Durum Değişti',
  b2b_order_rejected: 'Sipariş İptal Edildi',
  b2b_admin_note_added: 'Merkez Notu',
  b2b_shipping_updated: 'Kargo Güncellendi',
  b2b_payment_processed: 'Ödeme Alındı',
};

/** Admin-web includes extra audit action labels. */
export const B2B_TIMELINE_LABELS_HQ: Record<string, string> = {
  ...B2B_TIMELINE_LABELS,
  b2b_order_status_advanced: 'Durum Güncellendi',
  b2b_admin_note_added: 'Merkez Notu Eklendi',
  b2b_shipping_updated: 'Kargo Bilgisi Güncellendi',
};

export const B2B_FILTER_CHIPS = [
  { key: 'all', label: 'Tümü' },
  { key: 'awaiting_payment', label: 'Ödeme Bekliyor' },
  { key: 'paid', label: 'Bekliyor' },
  { key: 'confirmed', label: 'Onaylandı' },
  { key: 'preparing', label: 'Hazırlanıyor' },
  { key: 'shipped', label: 'Kargoya Verildi' },
  { key: 'delivered', label: 'Teslim Edildi' },
  { key: 'cancelled', label: 'İptal' },
] as const;

export type B2BStatusFilter = typeof B2B_FILTER_CHIPS[number]['key'];

export const B2B_PRODUCT_SEARCH_PLACEHOLDER = 'Ürün adı veya kodu ara…';

export function getEffectivePrice(p: {
  price: number;
  campaign_price: number | null;
  campaign_ends: string | null;
}): number {
  if (p.campaign_price !== null && (!p.campaign_ends || new Date(p.campaign_ends) > new Date())) {
    return p.campaign_price;
  }
  return p.price;
}

export function hasActiveCampaign(p: {
  campaign_price: number | null;
  campaign_ends: string | null;
}): boolean {
  return p.campaign_price !== null && (!p.campaign_ends || new Date(p.campaign_ends) > new Date());
}
