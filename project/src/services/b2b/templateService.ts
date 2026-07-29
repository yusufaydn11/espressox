// ─── Template, Notification & Warehouse Services ───────────

import { supabase } from '@/lib/supabase';
import { B2BService } from './base';
import type { B2BOrderTemplate, B2BNotification, B2BWarehouse, B2BOrder } from './types';

class TemplateService extends B2BService<B2BOrderTemplate> {
  constructor() {
    super('b2b_order_templates');
  }

  async getRecent(): Promise<B2BOrderTemplate[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BOrderTemplate[];
  }
}

class NotificationService {
  async getB2B(limit = 50): Promise<B2BNotification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, title, body, is_read, type, data, created_at')
      .eq('type', 'order')
      .not('data->>source', 'is', null)
      .like('data->>source', 'b2b%')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as B2BNotification[];
  }

  async markRead(id: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    if (error) throw new Error(error.message);
  }

  // ── Realtime subscription for B2B notifications ──
  subscribeRealtime(onNew: (notif: B2BNotification) => void): () => void {
    const channel = supabase
      .channel('b2b-notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'type=eq.order' },
        (payload) => {
          const row = payload.new as B2BNotification;
          if (row.data?.source && String(row.data.source).startsWith('b2b')) {
            onNew(row);
          }
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }

  // ── Realtime subscription for order status changes ──
  subscribeOrderChanges(storeId: string, onChange: (order: B2BOrder) => void): () => void {
    const channel = supabase
      .channel(`b2b-orders-${storeId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'b2b_orders', filter: `store_id=eq.${storeId}` },
        (payload) => {
          onChange(payload.new as B2BOrder);
        },
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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
export const notificationService = new NotificationService();
export const warehouseService = new WarehouseService();
