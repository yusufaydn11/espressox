// ─── Template & Warehouse Services ───────────────────────────

import { supabase } from '@/lib/supabase';
import { B2BService } from './base';
import type { B2BOrderTemplate, B2BWarehouse } from './types';

export { notificationService } from '@/services/notifications';

class TemplateService extends B2BService<B2BOrderTemplate> {
  constructor() {
    super('b2b_order_templates');
  }

  async getRecent(limit = 50): Promise<B2BOrderTemplate[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BOrderTemplate[];
  }
}

class WarehouseService extends B2BService<B2BWarehouse> {
  constructor() {
    super('b2b_warehouses');
  }

  async getActive(): Promise<B2BWarehouse[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BWarehouse[];
  }
}

export const templateService = new TemplateService();
export const warehouseService = new WarehouseService();
