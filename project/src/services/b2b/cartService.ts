// ─── Cart Service (AsyncStorage-backed) ────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { B2BCartItem } from './types';

const B2B_CART_KEY = 'b2b_supply_cart';

class CartService {
  async get(): Promise<B2BCartItem[]> {
    try {
      const raw = await AsyncStorage.getItem(B2B_CART_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async save(items: B2BCartItem[]): Promise<void> {
    await AsyncStorage.setItem(B2B_CART_KEY, JSON.stringify(items));
  }

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(B2B_CART_KEY);
  }

  async add(product: {
    id: string; sku: string; name: string; unit: string;
    price: number; min_order_qty: number;
  }): Promise<B2BCartItem[]> {
    const items = await this.get();
    const existing = items.find(i => i.product_id === product.id);
    if (existing) {
      existing.quantity += product.min_order_qty;
    } else {
      items.push({
        product_id: product.id,
        sku: product.sku,
        name: product.name,
        unit: product.unit,
        price: product.price,
        quantity: product.min_order_qty,
      });
    }
    await this.save(items);
    return items;
  }

  async updateQty(productId: string, delta: number): Promise<B2BCartItem[]> {
    const items = await this.get();
    const item = items.find(i => i.product_id === productId);
    if (item) {
      item.quantity = Math.max(1, item.quantity + delta);
      await this.save(items);
    }
    return items;
  }

  async remove(productId: string): Promise<B2BCartItem[]> {
    const items = (await this.get()).filter(i => i.product_id !== productId);
    await this.save(items);
    return items;
  }

  getSubtotal(items: B2BCartItem[]): number {
    return items.reduce((s, i) => s + i.price * i.quantity, 0);
  }

  getVatTotal(items: B2BCartItem[], vatRate = 0.10): number {
    return items.reduce((s, i) => s + i.price * i.quantity * vatRate, 0);
  }

  getTotal(items: B2BCartItem[], vatRate = 0.10): number {
    return this.getSubtotal(items) + this.getVatTotal(items, vatRate);
  }
}

export const cartService = new CartService();
