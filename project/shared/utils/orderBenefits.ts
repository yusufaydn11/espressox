import type { OrderBenefitInfo, OrderBenefitKind } from '../types/operations';

export const BENEFIT_CORRELATION_MS = 2 * 60 * 60 * 1000;

type OrderLike = {
  total: number;
  points_earned: number;
  points_spent?: number;
  user_id: string;
  store_id?: string | null;
  created_at: string;
  billing_type?: string | null;
  benefit_source?: string | null;
  benefit_title?: string | null;
  reward_id?: string | null;
  coupon_id?: string | null;
  campaign_id?: string | null;
  discount_amount?: number;
};

type FreeCoffeeLike = {
  user_id: string;
  store_id?: string | null;
  product_name?: string;
  redeemed_at: string;
};

type RedemptionLike = {
  user_id: string;
  reward_id: string;
  points_spent: number;
  redeemed_at: string;
};

type RewardLike = {
  id: string;
  title: string;
  category?: string;
  points_cost?: number;
};

type PointsLike = {
  user_id: string;
  title: string;
  points: number;
  type?: string;
  created_at: string;
};

function billingKind(bt: string | null | undefined): OrderBenefitKind | null {
  if (!bt || bt === 'standard') return null;
  if (bt === 'free_coffee') return 'stamp_card';
  if (bt === 'birthday') return 'birthday';
  if (bt === 'vip_benefit') return 'vip';
  if (bt === 'reward' || bt === 'points') return 'points_reward';
  if (bt === 'coupon') return 'coupon';
  if (bt === 'campaign') return 'campaign';
  return 'free_unknown';
}

function billingLabel(kind: OrderBenefitKind, title?: string | null): string {
  if (title?.trim()) return title.trim();
  const map: Record<OrderBenefitKind, string> = {
    paid: 'Ücretli sipariş',
    stamp_card: 'Damga Kartı',
    points_reward: 'Puan Ödülü',
    birthday: 'Doğum Günü Ödülü',
    vip: 'VIP Avantajı',
    campaign: 'Kampanya',
    coupon: 'Kupon',
    free_unknown: 'Ücretsiz',
  };
  return map[kind] ?? 'Avantaj';
}

function withinWindow(a: string, b: string, ms = BENEFIT_CORRELATION_MS): boolean {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) <= ms;
}

function storeMatches(orderStore: string | null | undefined, eventStore: string | null | undefined): boolean {
  if (!orderStore || !eventStore) return true;
  return orderStore === eventStore;
}

function toneForKind(kind: OrderBenefitKind): OrderBenefitInfo['badgeTone'] {
  if (kind === 'vip') return 'gold';
  if (kind === 'paid') return 'default';
  if (kind === 'coupon' || kind === 'campaign') return 'green';
  if (kind === 'free_unknown') return 'green';
  return 'green';
}

/** Prefer authoritative order.billing_type; fall back to timestamp correlation. */
export function resolveOrderBenefit(
  order: OrderLike,
  ctx: {
    freeCoffees?: FreeCoffeeLike[];
    redemptions?: RedemptionLike[];
    rewards?: RewardLike[];
    pointsHistory?: PointsLike[];
  } = {},
): OrderBenefitInfo {
  const total = Number(order.total);
  const storedKind = billingKind(order.billing_type);

  if (storedKind) {
    const detailParts: string[] = [];
    if (order.discount_amount && order.discount_amount > 0) {
      detailParts.push(`₺${Math.round(order.discount_amount)} indirim`);
    }
    if (order.points_spent && order.points_spent > 0) {
      detailParts.push(`${order.points_spent} puan harcandı`);
    }
    if (order.benefit_source) detailParts.push(`Kaynak: ${order.benefit_source}`);
    if (detailParts.length === 0 && total === 0) detailParts.push('Ücretsiz sipariş');
    if (total > 0 && order.points_earned > 0) detailParts.push(`+${order.points_earned} puan`);

    return {
      kind: storedKind,
      label: billingLabel(storedKind, order.benefit_title),
      detail: detailParts.join(' · ') || order.benefit_title || 'Avantaj uygulandı',
      pointsEarned: order.points_earned > 0 ? order.points_earned : undefined,
      pointsSpent: order.points_spent && order.points_spent > 0 ? order.points_spent : undefined,
      badgeTone: toneForKind(storedKind),
    };
  }

  if (total > 0) {
    return {
      kind: 'paid',
      label: 'Ücretli sipariş',
      detail: order.points_earned > 0 ? `+${order.points_earned} puan kazanıldı` : 'Puan kazanımı yok',
      pointsEarned: order.points_earned,
      badgeTone: 'default',
    };
  }

  const fcr = (ctx.freeCoffees ?? []).find(f =>
    f.user_id === order.user_id
    && withinWindow(f.redeemed_at, order.created_at)
    && storeMatches(order.store_id, f.store_id),
  );
  if (fcr) {
    return {
      kind: 'stamp_card',
      label: 'Damga Kartı',
      detail: fcr.product_name?.trim() || '5 damga — ücretsiz kahve',
      badgeTone: 'green',
    };
  }

  const redemption = (ctx.redemptions ?? []).find(r =>
    r.user_id === order.user_id && withinWindow(r.redeemed_at, order.created_at),
  );
  if (redemption) {
    const reward = (ctx.rewards ?? []).find(rw => rw.id === redemption.reward_id);
    const isBirthday = reward?.category === 'birthday' || redemption.points_spent === 0;
    const isVip = reward?.category === 'exclusive' || reward?.category === 'vip';
    const kind: OrderBenefitKind = isBirthday ? 'birthday' : isVip ? 'vip' : 'points_reward';
    return {
      kind,
      label: isBirthday ? 'Doğum Günü Ödülü' : isVip ? 'VIP Ödülü' : 'Puan Ödülü',
      detail: reward?.title ?? 'Ödül kullanıldı',
      pointsSpent: redemption.points_spent > 0 ? redemption.points_spent : undefined,
      badgeTone: toneForKind(kind),
    };
  }

  const spent = (ctx.pointsHistory ?? []).find(p =>
    p.user_id === order.user_id
    && p.points < 0
    && withinWindow(p.created_at, order.created_at),
  );
  if (spent) {
    return {
      kind: 'points_reward',
      label: 'Puan Kullanımı',
      detail: spent.title,
      pointsSpent: Math.abs(spent.points),
      badgeTone: 'green',
    };
  }

  return {
    kind: 'free_unknown',
    label: 'Ücretsiz',
    detail: 'Sadakat veya promosyon avantajı',
    badgeTone: 'green',
  };
}

export function benefitShortLabel(info: OrderBenefitInfo): string {
  if (info.kind === 'paid') return info.pointsEarned ? `+${info.pointsEarned} puan` : 'Ücretli';
  return info.label;
}
