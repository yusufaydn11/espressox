// ─── Base B2B Service ──────────────────────────────────────
// Generic CRUD + query layer that all domain services inherit.
// Centralizes Supabase access so screens never call supabase directly.

import { supabase } from '@/lib/supabase';
import type { PaginatedResult, QueryOptions } from './types';

export class B2BService<T extends { id: string }> {
  constructor(protected tableName: string) {}

  protected async rpc<R>(fn: string, params: Record<string, unknown>): Promise<R> {
    const { data, error } = await supabase.rpc(fn, params);
    if (error) throw new Error(error.message);
    return data as R;
  }

  async getById(id: string): Promise<T | null> {
    const { data, error } = await supabase.from(this.tableName).select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as T | null;
  }

  async getAll(): Promise<T[]> {
    const { data, error } = await supabase.from(this.tableName).select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  }

  async paginate(opts: QueryOptions = {}): Promise<PaginatedResult<T>> {
    const { page = 1, pageSize = 20, filter, orderBy = 'created_at', ascending = false } = opts;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let q = supabase.from(this.tableName).select('*', { count: 'exact' });
    if (filter) {
      for (const [key, val] of Object.entries(filter)) {
        if (val && val !== 'all') q = q.eq(key, val);
      }
    }
    q = q.order(orderBy, { ascending }).range(from, to);

    const { data, error, count } = await q;
    if (error) throw new Error(error.message);

    const items = (data ?? []) as T[];
    const total = count ?? 0;
    return {
      items,
      total,
      page,
      pageSize,
      hasMore: from + items.length < total,
    };
  }

  async create(payload: Partial<T>): Promise<T> {
    const { data, error } = await supabase.from(this.tableName).insert(payload).select().single();
    if (error) throw new Error(error.message);
    return data as T;
  }

  async update(id: string, patch: Partial<T>): Promise<void> {
    const { error } = await supabase.from(this.tableName).update(patch).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from(this.tableName).delete().eq('id', id);
    if (error) throw new Error(error.message);
  }
}

// ─── Formatting helpers (shared across all modules) ────────

export const b2bFormatTRY = (n: number): string =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

export const b2bFormatDate = (s: string): string =>
  new Date(s).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });

export const b2bFormatDateTime = (s: string): string =>
  new Date(s).toLocaleString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export const b2bTimeAgo = (s: string): string => {
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'az önce';
  if (mins < 60) return `${mins} dk önce`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} sa önce`;
  return `${Math.floor(hrs / 24)} gün önce`;
};

// ─── Status label maps ──────────────────────────────────────

export const B2B_ORDER_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  awaiting_payment: 'Ödeme Bekleniyor',
  paid: 'Ödeme Alındı',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
};

export const B2B_INVOICE_STATUS_LABELS: Record<string, string> = {
  issued: 'Kesildi',
  paid: 'Ödendi',
  partial: 'Kısmi Ödeme',
  cancelled: 'İptal',
};

export const B2B_PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Beklemede',
  success: 'Başarılı',
  failed: 'Başarısız',
  refunded: 'İade',
};

export const B2B_RISK_LABELS: Record<string, string> = {
  normal: 'Normal',
  warning: 'Uyarı',
  blocked: 'Bloke',
};

// ─── Status color maps for shared StatusBadge component ─────

export const B2B_ORDER_STATUS_TONES: Record<string, string> = {
  draft: 'neutral',
  awaiting_payment: 'amber',
  paid: 'blue',
  confirmed: 'blue',
  preparing: 'gold',
  shipped: 'dark',
  delivered: 'green',
  cancelled: 'red',
};

export const B2B_INVOICE_STATUS_TONES: Record<string, string> = {
  issued: 'amber',
  paid: 'green',
  partial: 'neutral',
  cancelled: 'red',
};

export const B2B_PAYMENT_STATUS_TONES: Record<string, string> = {
  pending: 'amber',
  success: 'green',
  failed: 'red',
  refunded: 'neutral',
};

export const B2B_RISK_TONES: Record<string, string> = {
  normal: 'green',
  warning: 'amber',
  blocked: 'red',
};

// ─── Product helpers ────────────────────────────────────────

export function getEffectivePrice(p: { price: number; campaign_price: number | null; campaign_ends: string | null }): number {
  if (p.campaign_price !== null && (!p.campaign_ends || new Date(p.campaign_ends) > new Date())) {
    return p.campaign_price;
  }
  return p.price;
}

export function hasActiveCampaign(p: { campaign_price: number | null; campaign_ends: string | null }): boolean {
  return p.campaign_price !== null && (!p.campaign_ends || new Date(p.campaign_ends) > new Date());
}
