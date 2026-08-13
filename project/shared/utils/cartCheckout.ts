import type { CartItem } from '@/types';
import { optionPriceModifier } from './productOptions';

function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** Map app cart lines to checkout RPC item payload (incl. size modifier for campaigns). */
export function mapCartItemsForCheckout(cart: CartItem[]) {
  return cart
    .map(item => ({
      name: `${item.product.name} — ${item.size.label}${item.milk.id !== 'whole' ? ', ' + item.milk.label : ''}`,
      qty: Math.max(1, Math.floor(Number(item.quantity) || 1)),
      price: Number(item.unitPrice),
      productId: nullIfEmpty(item.product.id),
      sizeModifier: optionPriceModifier(item.size),
    }))
    .filter(item => item.productId && Number.isFinite(item.price) && item.price > 0);
}
