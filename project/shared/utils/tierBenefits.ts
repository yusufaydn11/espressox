import { TIERS } from '../constants/loyalty';
import type { TierInfo } from '../types/loyalty';

export type ActiveTierBenefit = {
  id: string;
  label: string;
  active: boolean;
  note?: string;
};

function normalizeTierName(tier: string): string {
  return tier
    .replace('Gumus', 'Gümüş')
    .replace('Altin', 'Altın')
    .replace('Silver', 'Gümüş')
    .replace('Gold', 'Altın')
    .replace('Platinum', 'Siyah')
    .replace('Premium', 'VIP');
}

export function getTierInfo(tier: string): TierInfo | undefined {
  const normalized = normalizeTierName(tier);
  return TIERS.find(t => t.name === normalized);
}

/** Display-only active benefits; earn multipliers applied server-side at checkout. */
export function getActiveTierBenefits(tier: string, lifetimePoints = 0): ActiveTierBenefit[] {
  const info = getTierInfo(tier);
  if (!info) {
    return [{ id: 'base', label: 'Temel sadakat programı', active: true }];
  }

  const perks = info.perks.map((perk, i) => ({
    id: `${info.name}-${i}`,
    label: perk,
    active: lifetimePoints >= info.minPoints,
    note: undefined,
  }));

  if (info.name === 'Gümüş') {
    perks.push({ id: 'silver-tuesday', label: 'Salı günleri 2x puan', active: true, note: undefined });
  }
  if (info.name === 'Altın' || info.name === 'Siyah' || info.name === 'VIP') {
    perks.push({ id: 'priority', label: 'Öncelikli sipariş sırası', active: true, note: undefined });
  }

  return perks;
}
