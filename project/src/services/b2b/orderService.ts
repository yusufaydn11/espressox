// ─── Order Service ─────────────────────────────────────────

import { supabase } from '@/lib/supabase';
import { B2BService } from './base';
import type { B2BOrder, B2BOrderItem, RpcResult } from './types';

class OrderService extends B2BService<B2BOrder> {
  constructor() {
    super('b2b_orders');
  }

  async getWithItems(id: string): Promise<(B2BOrder & { b2b_order_items: B2BOrderItem[] }) | null> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*, b2b_order_items(*)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    const order = data as B2BOrder & { b2b_order_items: B2BOrderItem[] };
    const productIds = order.b2b_order_items.map(i => i.product_id).filter(Boolean) as string[];
    if (productIds.length === 0) return order;

    const { data: products } = await supabase.from('b2b_products').select('id, image_url').in('id', productIds);
    const imageMap: Record<string, string> = {};
    (products as { id: string; image_url: string }[] | null)?.forEach(p => { imageMap[p.id] = p.image_url; });

    return {
      ...order,
      b2b_order_items: order.b2b_order_items.map(it => ({
        ...it,
        image_url: it.product_id ? imageMap[it.product_id] ?? '' : '',
      })),
    };
  }

  async listWithItems(status?: string, limit = 100): Promise<(B2BOrder & { b2b_order_items: B2BOrderItem[] })[]> {
    let q = supabase
      .from(this.tableName)
      .select('*, b2b_order_items(*)')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []) as (B2BOrder & { b2b_order_items: B2BOrderItem[] })[];
  }

  async createOrder(items: Array<{ product_id: string; quantity: number }>, notes: string, warehouseId?: string): Promise<RpcResult & { order_id?: string; order_number?: string; total?: number }> {
    return this.rpc<RpcResult & { order_id?: string; order_number?: string; total?: number }>('create_b2b_order', {
      p_items: items,
      p_notes: notes,
      p_warehouse_id: warehouseId ?? null,
    });
  }

  async cancel(orderId: string, reason: string): Promise<RpcResult> {
    return this.rpc<RpcResult>('cancel_b2b_order', { p_order_id: orderId, p_reason: reason });
  }

  async reorder(orderId: string, templateName?: string): Promise<RpcResult & { new_order?: { order_id?: string; order_number?: string } }> {
    return this.rpc<RpcResult & { new_order?: { order_id?: string; order_number?: string } }>('reorder_b2b_order', {
      p_order_id: orderId,
      p_template_name: templateName ?? null,
    });
  }

  // ── HQ only: advance order status (paid→confirmed→preparing→shipped→delivered) ──
  async advanceStatus(orderId: string, newStatus: string, opts?: { trackingNo?: string; carrier?: string; eta?: string }): Promise<RpcResult> {
    return this.rpc<RpcResult>('advance_b2b_order_status', {
      p_order_id: orderId,
      p_new_status: newStatus,
      p_tracking_no: opts?.trackingNo ?? '',
      p_carrier: opts?.carrier ?? '',
      p_eta: opts?.eta ?? null,
    });
  }

  // ── HQ only: update shipping info independently ──
  async updateShipping(orderId: string, carrier: string, trackingNo: string, trackingUrl: string, eta?: string): Promise<RpcResult> {
    return this.rpc<RpcResult>('update_b2b_shipping', {
      p_order_id: orderId,
      p_carrier: carrier,
      p_tracking_no: trackingNo,
      p_tracking_url: trackingUrl,
      p_eta: eta ?? null,
    });
  }

  async listForManagement(limit = 200): Promise<(B2BOrder & { b2b_order_items: B2BOrderItem[] })[]> {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*, b2b_order_items(*)')
      .in('status', ['paid', 'confirmed', 'preparing', 'shipped', 'delivered'])
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as (B2BOrder & { b2b_order_items: B2BOrderItem[] })[];
  }

  async getTimeline(orderId: string): Promise<Array<{
    action: string;
    created_at: string;
    actor_name: string;
    details: Record<string, unknown>;
  }>> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('action, created_at, actor_id, details')
      .eq('entity_type', 'b2b_order')
      .eq('entity_id', orderId)
      .order('created_at', { ascending: true });
    if (error) return [];

    const rows = data as { action: string; created_at: string; actor_id: string | null; details: Record<string, unknown> }[];
    const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))] as string[];
    const nameMap: Record<string, string> = {};
    if (actorIds.length) {
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', actorIds);
      (profiles as { user_id: string; full_name: string }[] | null)?.forEach(p => {
        nameMap[p.user_id] = p.full_name || 'Merkez';
      });
    }
    return rows.map(r => ({
      action: r.action,
      created_at: r.created_at,
      actor_name: r.actor_id ? nameMap[r.actor_id] ?? 'Merkez' : 'Sistem',
      details: r.details,
    }));
  }
}

export const orderService = new OrderService();
