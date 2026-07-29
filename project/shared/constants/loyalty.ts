import type { TierInfo } from '../types/loyalty';

/** Loyalty tier accent colors (mobile QR / profile). */
export const TIER_COLORS: Record<string, string> = {
  Bronz: '#B87333',
  Gumus: '#A1A1AA',
  Gümüş: '#A1A1AA',
  Altin: '#C8102E',
  Altın: '#C8102E',
  Siyah: '#18181B',
  VIP: '#C8102E',
};

export function tierColor(tier: string): string {
  return TIER_COLORS[tier] ?? '#9494A0';
}

/** Mobile loyalty tier ladder (display + progress). */
export const TIERS: TierInfo[] = [
  { name: 'Bronz', minPoints: 0, color: '#a87f54', perks: ['Hoş geldin ödülü', 'Doğum günü hediyesi'] },
  { name: 'Gümüş', minPoints: 1000, color: '#9ca3af', perks: ['Salı günleri 2x puan', 'Ücretsiz boy yükseltme'] },
  { name: 'Altın', minPoints: 3000, color: '#C8102E', perks: ['Favorilerde 3x puan', 'Aylık ücretsiz içecek', 'Öncelikli teslim'] },
  { name: 'Siyah', minPoints: 7000, color: '#18181B', perks: ['Concierge sipariş', 'Özel tadım etkinlikleri', '5x puan', 'Ücretsiz teslimat'] },
  { name: 'VIP', minPoints: 15000, color: '#C8102E', perks: ['Kişisel kahve küratörü', 'Özel kavurum erişimi', 'Sınırsız ücretsiz ekstra', 'Yıllık altın hediye seti'] },
];

export const DEFAULT_EARN_RATE = 0.2;

export const STAMP_CARD_SIZE = 5;
export const STAMPS_TO_REWARD = 5;
export const POINTS_PER_STAMP = 10;

/** Lucide icon names per tier (consumer maps to components). */
export const TIER_ICON_NAMES: Record<string, 'Crown' | 'Zap' | 'Diamond'> = {
  Bronz: 'Zap',
  Gümüş: 'Zap',
  Altın: 'Crown',
  Siyah: 'Diamond',
  VIP: 'Crown',
};

export const REWARD_CATEGORY_LABELS: Record<string, string> = {
  coffee: 'Kahve',
  dessert: 'Tatlı',
  discount: 'İndirim',
  exclusive: 'Özel',
  birthday: 'Doğum Günü',
};

export const REWARD_STATUS_LABELS = {
  active: 'Aktif',
  inactive: 'Pasif',
} as const;

export const REWARD_BUTTON_LABELS = {
  finished: 'Bitti',
  redeem: 'Kullan',
  locked: 'Kilitli',
} as const;

export const SCAN_ERROR_LABELS: Record<string, string> = {
  qr_not_found: 'QR kodu bulunamadı veya pasif.',
  invalid_code: 'Geçersiz QR kod formatı.',
  account_blocked: 'Müşteri hesabı engellenmiş.',
  not_owner: 'Bu mağaza için tarama yetkiniz yok.',
  store_required: 'Tarama için şube seçimi zorunlu.',
  store_not_found: 'Şube bulunamadı.',
  rate_limited: 'Çok hızlı tarama. Bir dakika bekleyin.',
  unauthenticated: 'Oturum açık değil.',
  invalid_action: 'Geçersiz tarama işlemi.',
};

/** VIP segment filter (push + customer lists). */
export const VIP_TIER_FILTER = ['Altın', 'Siyah', 'VIP'] as const;
