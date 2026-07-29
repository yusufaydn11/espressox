/** Pure VAT math — B2B catalog only; does not mix with retail pricing. */

export function computeVatAmount(lineTotal: number, vatRatePercent: number): number {
  return lineTotal * vatRatePercent / 100;
}

export function formatVatRateLabel(vatRate: number): string {
  return `KDV %${vatRate}`;
}

export function findB2BStockQty(
  stock: { product_id: string; stock_qty: number }[],
  productId: string,
): number {
  return stock.find(s => s.product_id === productId)?.stock_qty ?? 0;
}

export function filterB2BProductsByCategory<T extends { category: string }>(
  products: T[],
  category: string,
  allKey = 'all',
): T[] {
  if (category === allKey) return products;
  return products.filter(p => p.category === category);
}

export function filterB2BProductsBySearch<T extends { name: string; sku: string }>(
  products: T[],
  query: string,
): T[] {
  if (!query.trim()) return products;
  const q = query.toLowerCase();
  return products.filter(
    p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q),
  );
}

export function deriveB2BCategories<T extends { category: string }>(
  products: T[],
  allKey = 'all',
): string[] {
  const set = new Set(products.map(p => p.category));
  return [allKey, ...Array.from(set).sort()];
}
