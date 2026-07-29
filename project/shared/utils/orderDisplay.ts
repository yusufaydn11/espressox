/** Whether a retail order has zero charge (loyalty / promo — reason stored separately until backend supports billing_type). */
export function isFreeOrder(total: number): boolean {
  return Number(total) === 0;
}

export function formatOrderTotalDisplay(
  total: number,
  formatCurrency: (n: number) => string,
): string {
  if (isFreeOrder(total)) return 'Ücretsiz';
  return formatCurrency(Number(total));
}

/** Short badge for staff / franchise / admin queues when total is 0. */
export function getFreeOrderBadge(total: number): { label: string; hint: string } | null {
  if (!isFreeOrder(total)) return null;
  return {
    label: 'Ücretsiz',
    hint: 'Sadakat ödülü veya promosyon',
  };
}

export { resolveOrderBenefit, benefitShortLabel } from './orderBenefits';
export type { OrderBenefitInfo, OrderBenefitKind } from '../types/operations';
