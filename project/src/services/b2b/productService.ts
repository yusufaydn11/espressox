// ─── Product Service ───────────────────────────────────────

import { supabase } from '@/lib/supabase';
import { B2BService, getEffectivePrice, hasActiveCampaign } from './base';
import type { B2BProduct, B2BProductStock } from './types';

class ProductService extends B2BService<B2BProduct> {
  constructor() {
    super('b2b_products');
  }

  async getActive(): Promise<B2BProduct[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BProduct[];
  }

  async getStock(): Promise<B2BProductStock[]> {
    const { data, error } = await supabase.from('b2b_product_stock').select('*');
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BProductStock[];
  }

  effectivePrice(p: B2BProduct): number {
    return getEffectivePrice(p);
  }

  isOnCampaign(p: B2BProduct): boolean {
    return hasActiveCampaign(p);
  }
}

export const productService = new ProductService();
