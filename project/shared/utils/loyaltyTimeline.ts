import type { LoyaltyTimelineItem } from '../types/operations';

type PointsRow = { id: string; title: string; points: number; type?: string; created_at: string };
type StampRow = { id: string; stamped_at: string; redeemed: boolean; store_id?: string | null };
type RedemptionRow = { id: string; reward_id: string; points_spent: number; redeemed_at: string };
type FreeCoffeeRow = { id: string; product_name?: string; redeemed_at: string; store_id?: string | null };
type QrScanRow = { id: string; action?: string; points_awarded?: number; scanned_at: string; store_id?: string | null };
type RewardRow = { id: string; title: string; category?: string };
type NotificationRow = { id: string; title: string; body?: string; type: string; created_at: string };
type CouponRedemptionRow = { id: string; redeemed_at: string; discount_amount?: number; title?: string };
type CampaignApplicationRow = { id: string; applied_at: string; discount_amount?: number; title?: string };
type PaymentRow = { id: string; created_at: string; payment_method?: string; payment_status?: string; order_number?: string };

export function buildLoyaltyTimeline(input: {
  pointsHistory?: PointsRow[];
  stamps?: StampRow[];
  redemptions?: RedemptionRow[];
  freeCoffees?: FreeCoffeeRow[];
  qrScans?: QrScanRow[];
  rewards?: RewardRow[];
  notifications?: NotificationRow[];
  couponRedemptions?: CouponRedemptionRow[];
  campaignApplications?: CampaignApplicationRow[];
  payments?: PaymentRow[];
  limit?: number;
}): LoyaltyTimelineItem[] {
  const rewardMap = new Map((input.rewards ?? []).map(r => [r.id, r.title]));
  const items: LoyaltyTimelineItem[] = [];

  for (const p of input.pointsHistory ?? []) {
    items.push({
      id: `ph-${p.id}`,
      at: p.created_at,
      category: 'points',
      title: p.title,
      subtitle: p.type === 'redeem' ? 'Puan harcandı' : p.type === 'earn' ? 'Puan kazanıldı' : 'Puan hareketi',
      delta: p.points,
    });
  }

  for (const s of input.stamps ?? []) {
    items.push({
      id: `st-${s.id}`,
      at: s.stamped_at,
      category: 'stamp',
      title: s.redeemed ? 'Damga kullanıldı' : 'Damga eklendi',
      subtitle: s.store_id ? `Şube: ${s.store_id}` : 'Damga kartı',
      delta: s.redeemed ? undefined : 1,
    });
  }

  for (const r of input.redemptions ?? []) {
    items.push({
      id: `rd-${r.id}`,
      at: r.redeemed_at,
      category: 'reward',
      title: rewardMap.get(r.reward_id) ?? 'Ödül kullanıldı',
      subtitle: r.points_spent > 0 ? `${r.points_spent} puan harcandı` : 'Ücretsiz ödül',
      delta: r.points_spent > 0 ? -r.points_spent : undefined,
    });
  }

  for (const f of input.freeCoffees ?? []) {
    items.push({
      id: `fc-${f.id}`,
      at: f.redeemed_at,
      category: 'free_coffee',
      title: 'Ücretsiz kahve verildi',
      subtitle: f.product_name?.trim() || 'Damga kartı ödülü',
    });
  }

  for (const q of input.qrScans ?? []) {
    items.push({
      id: `qr-${q.id}`,
      at: q.scanned_at,
      category: 'qr',
      title: q.action === 'stamp' ? 'QR damga' : 'QR tarama',
      subtitle: q.points_awarded ? `+${q.points_awarded} puan` : 'Mağazada okutuldu',
      delta: q.points_awarded,
    });
  }

  for (const n of input.notifications ?? []) {
    if (n.type !== 'promo' && n.type !== 'promotion' && n.type !== 'campaign') continue;
    items.push({
      id: `cn-${n.id}`,
      at: n.created_at,
      category: 'campaign',
      title: n.title,
      subtitle: n.body ?? 'Kampanya bildirimi',
    });
  }

  for (const c of input.couponRedemptions ?? []) {
    items.push({
      id: `cp-${c.id}`,
      at: c.redeemed_at,
      category: 'coupon',
      title: c.title ?? 'Kupon kullanıldı',
      subtitle: c.discount_amount ? `₺${Math.round(Number(c.discount_amount))} indirim` : 'Kupon',
      delta: c.discount_amount ? -Math.round(Number(c.discount_amount)) : undefined,
    });
  }

  for (const ca of input.campaignApplications ?? []) {
    items.push({
      id: `ca-${ca.id}`,
      at: ca.applied_at,
      category: 'campaign',
      title: ca.title ?? 'Kampanya uygulandı',
      subtitle: ca.discount_amount ? `₺${Math.round(Number(ca.discount_amount))} indirim` : 'Checkout kampanyası',
    });
  }

  for (const pay of input.payments ?? []) {
    items.push({
      id: `pay-${pay.id}`,
      at: pay.created_at,
      category: 'payment',
      title: pay.order_number ? `Ödeme · ${pay.order_number}` : 'Ödeme',
      subtitle: `${pay.payment_method ?? 'card'} · ${pay.payment_status ?? 'paid'}`,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const cap = input.limit ?? 50;
  return items.slice(0, cap);
}
