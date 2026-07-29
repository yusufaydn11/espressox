import {
  REWARD_BUTTON_LABELS,
  STAMP_CARD_SIZE,
  TIERS,
} from '../constants/loyalty';
import type { RedeemRpcPayload, TierInfo } from '../types/loyalty';

export function formatPoints(n: number): string {
  return n.toLocaleString('tr-TR');
}

export function formatPointsWithSuffix(n: number): string {
  return `${formatPoints(n)} puan`;
}

export function formatRewardCost(cost: number): string {
  return cost === 0 ? 'Ücretsiz (doğum günü)' : `${formatPoints(cost)} puan`;
}

export function getTierIndex(tier: string, tiers: TierInfo[] = TIERS): number {
  return tiers.findIndex(t => t.name === tier);
}

export function getNextTier(
  tier: string,
  tiers: TierInfo[] = TIERS,
): TierInfo | undefined {
  const idx = getTierIndex(tier, tiers);
  if (idx < 0) return tiers[0];
  return tiers[idx + 1];
}

export function getTierProgress(
  points: number,
  tier: string,
  tiers: TierInfo[] = TIERS,
): number {
  const idx = getTierIndex(tier, tiers);
  if (idx < 0) return 0;
  const next = tiers[idx + 1];
  if (!next) return 100;
  const current = tiers[idx];
  return Math.min(
    100,
    Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100),
  );
}

export function computeCartPoints(cartTotal: number, earnRate: number): number {
  return Math.round(cartTotal * earnRate);
}

export function computeStampProgress(
  stampCount: number,
  cardSize: number = STAMP_CARD_SIZE,
): { freeCoffees: number; currentStamps: number } {
  const mod = stampCount % cardSize;
  return {
    freeCoffees: Math.floor(stampCount / cardSize),
    currentStamps: stampCount > 0 && mod === 0 ? cardSize : mod,
  };
}

export function parseRedeemRpcResult(
  data: RedeemRpcPayload,
): { error: string | null; needed?: number } {
  if (data.error === 'insufficient_points') {
    return { error: 'insufficient_points', needed: data.needed ?? 0 };
  }
  if (data.error) return { error: data.error };
  return { error: null };
}

export function getRewardButtonLabel(canRedeem: boolean, alreadyRedeemed: boolean): string {
  if (alreadyRedeemed) return REWARD_BUTTON_LABELS.finished;
  if (canRedeem) return REWARD_BUTTON_LABELS.redeem;
  return REWARD_BUTTON_LABELS.locked;
}

export function customerStatusFromTier(
  tier: string,
  isBlocked: boolean,
): 'active' | 'inactive' | 'vip' {
  if (isBlocked) return 'inactive';
  if (tier === 'VIP' || tier === 'Siyah') return 'vip';
  return 'active';
}
