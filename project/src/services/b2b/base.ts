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

export {
  formatTRYDecimal as b2bFormatTRY,
  formatDate as b2bFormatDate,
  formatDateTime as b2bFormatDateTime,
  timeAgo as b2bTimeAgo,
} from '@shared/utils';

export {
  B2B_ORDER_STATUS_LABELS,
  B2B_INVOICE_STATUS_LABELS,
  B2B_PAYMENT_STATUS_LABELS,
  B2B_RISK_LABELS,
  B2B_ORDER_STATUS_TONES,
  B2B_INVOICE_STATUS_TONES,
  B2B_PAYMENT_STATUS_TONES,
  B2B_RISK_TONES,
  B2B_TIMELINE_LABELS,
  getEffectivePrice,
  hasActiveCampaign,
} from '@shared/constants/b2b';
