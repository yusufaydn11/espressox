import { supabase, type NotificationRow, type NotificationPrefsRow } from '@/lib/supabase';
import { filterNotificationsByStoreId } from '@shared/constants/notifications';
import type { B2BOrder } from '@/services/b2b/types';
import {
  subscribeB2BNotifications,
  subscribeB2BOrderChanges,
} from './realtimeService';

export type B2BNotification = Pick<
  NotificationRow,
  'id' | 'title' | 'body' | 'is_read' | 'type' | 'created_at'
> & {
  data: { order_id?: string; source?: string; store_id?: string } | null;
};

export type BulkNotificationInsert = {
  user_id: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
};

const STORE_PANEL_SELECT = 'id, title, body, created_at, is_read, data';

export async function fetchByUserId(
  userId: string,
  limit = 20,
): Promise<{ data: NotificationRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: data as NotificationRow[], error: null };
}

export async function fetchForStorePanel(
  userId: string,
  storeId: string | null,
  limit = 30,
): Promise<{ data: NotificationRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('notifications')
    .select(STORE_PANEL_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };

  const rows = (data ?? []) as NotificationRow[];
  return {
    data: filterNotificationsByStoreId(rows, storeId),
    error: null,
  };
}

export async function fetchB2B(limit = 50): Promise<B2BNotification[]> {
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

export async function markNotificationRead(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchPrefs(
  userId: string,
): Promise<{ data: NotificationPrefsRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (data) return { data: data as NotificationPrefsRow, error: null };

  const { data: created, error: insErr } = await supabase
    .from('notification_preferences')
    .insert({ user_id: userId })
    .select('*')
    .maybeSingle();
  if (insErr) return { data: null, error: insErr.message };
  return { data: created as NotificationPrefsRow, error: null };
}

export async function updatePrefs(
  userId: string,
  prefs: Partial<NotificationPrefsRow>,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('notification_preferences')
    .update(prefs)
    .eq('user_id', userId);
  return { error: error?.message ?? null };
}

export async function insertBulk(
  rows: BulkNotificationInsert[],
): Promise<{ error: string | null; count: number }> {
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) return { error: error.message, count: 0 };
  return { error: null, count: rows.length };
}

/** Backward-compatible class API used by B2B screens. */
class NotificationService {
  getB2B(limit?: number) {
    return fetchB2B(limit);
  }

  async markRead(id: string): Promise<void> {
    const result = await markNotificationRead(id);
    if (result.error) throw new Error(result.error);
  }

  subscribeRealtime(onNew: (notif: B2BNotification) => void): () => void {
    return subscribeB2BNotifications(onNew);
  }

  subscribeOrderChanges(storeId: string, onChange: (order: B2BOrder) => void): () => void {
    return subscribeB2BOrderChanges(storeId, onChange);
  }
}

export const notificationService = new NotificationService();

export { subscribeB2BNotifications, subscribeB2BOrderChanges };
