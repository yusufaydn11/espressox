import { useState, useEffect, useCallback } from 'react';
import { supabase, type Product, type Store, type Reward, type OrderRow, type OrderItemRow, type PointsHistoryRow, type LoyaltyStampRow, type RewardRedemptionRow, type CampaignRow, type NotificationRow, type NotificationPrefsRow, type QrCodeRow, type QrScanRow, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function useAsync<T>(fn: () => Promise<{ data: T | null; error: string | null }>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data: d, error: e } = await fn();
    if (e) setError(e);
    else setData(d);
    setLoading(false);
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  return { data, error, loading, reload, setData };
}

export function useProducts() {
  return useAsync(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('in_stock', true)
      .order('sort_order', { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: data as Product[], error: null };
  }, []);
}

export function useStores() {
  return useAsync(async () => {
    const { data, error } = await supabase
      .from('stores')
      .select('*')
      .order('name');
    if (error) return { data: null, error: error.message };
    return { data: data as Store[], error: null };
  }, []);
}

export function useRewards() {
  return useAsync(async () => {
    const { data, error } = await supabase
      .from('rewards')
      .select('*')
      .eq('is_active', true);
    if (error) return { data: null, error: error.message };
    return { data: data as Reward[], error: null };
  }, []);
}

export function useOrders() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: data as (OrderRow & { order_items: OrderItemRow[] })[], error: null };
  }, [user?.id]);
}

export function usePointsHistory() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('points_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return { data: null, error: error.message };
    return { data: data as PointsHistoryRow[], error: null };
  }, [user?.id]);
}

export function useLoyaltyStamps() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('loyalty_stamps')
      .select('*')
      .eq('user_id', user.id)
      .order('stamped_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: data as LoyaltyStampRow[], error: null };
  }, [user?.id]);
}

export function useRewardRedemptions() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('reward_redemptions')
      .select('*')
      .eq('user_id', user.id)
      .order('redeemed_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: data as RewardRedemptionRow[], error: null };
  }, [user?.id]);
}

export function useCampaigns() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    if (error) return { data: null, error: error.message };
    return { data: data as CampaignRow[], error: null };
  }, [user?.id]);
}

export function useNotifications() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) return { data: null, error: error.message };
    return { data: data as NotificationRow[], error: null };
  }, [user?.id]);
}

export function useNotificationPrefs() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: null, error: null };
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) {
      const { data: created, error: insErr } = await supabase
        .from('notification_preferences')
        .insert({ user_id: user.id })
        .select('*')
        .maybeSingle();
      if (insErr) return { data: null, error: insErr.message };
      return { data: created as NotificationPrefsRow, error: null };
    }
    return { data: data as NotificationPrefsRow, error: null };
  }, [user?.id]);
}

export function useQrCode() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: null, error: null };
    const { data, error } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) return { data: null, error: error.message };
    if (!data) {
      const code = `EX-${user.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const { data: created, error: insErr } = await supabase
        .from('qr_codes')
        .insert({ user_id: user.id, code })
        .select('*')
        .maybeSingle();
      if (insErr) return { data: null, error: insErr.message };
      return { data: created as QrCodeRow, error: null };
    }
    return { data: data as QrCodeRow, error: null };
  }, [user?.id]);
}

export function useQrScans() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    const { data, error } = await supabase
      .from('qr_scans')
      .select('*')
      .eq('user_id', user.id)
      .order('scanned_at', { ascending: false })
      .limit(20);
    if (error) return { data: null, error: error.message };
    return { data: data as QrScanRow[], error: null };
  }, [user?.id]);
}

export function useCreateOrder() {
  const { user, refreshProfile } = useAuth();

  return useCallback(async (params: {
    items: { name: string; qty: number; price: number; productId?: string }[];
    total: number;
    storeId?: string;
    storeName: string;
    orderType: string;
  }) => {
    if (!user) return { error: 'Giriş yapmalısınız' };

    const itemsJson = JSON.stringify(params.items.map(it => ({
      productId: it.productId ?? null,
      name: it.name,
      qty: it.qty,
      price: it.price,
    })));

    const { data, error } = await supabase.rpc('create_order', {
      p_items: itemsJson,
      p_total: params.total,
      p_store_id: params.storeId ?? null,
      p_store_name: params.storeName,
      p_order_type: params.orderType,
    });

    if (error) return { error: error.message };
    const result = data as { error: string | null; order_number: string };
    if (result.error) return { error: result.error };

    await refreshProfile();
    return { error: null };
  }, [user, refreshProfile]);
}

export function useRedeemReward() {
  const { user, refreshProfile } = useAuth();

  return useCallback(async (reward: Reward) => {
    if (!user) return { error: 'Giriş yapmalısınız' };

    const { data, error } = await supabase.rpc('redeem_reward', {
      p_reward_id: reward.id,
    });

    if (error) return { error: error.message };
    const result = data as { error: string | null; needed?: number };
    if (result.error === 'insufficient_points') {
      return { error: `${result.needed ?? 0} puana daha ihtiyacın var` };
    }
    if (result.error) return { error: result.error };

    await refreshProfile();
    return { error: null };
  }, [user, refreshProfile]);
}

export async function updateNotificationPrefs(userId: string, prefs: Partial<NotificationPrefsRow>) {
  const { error } = await supabase
    .from('notification_preferences')
    .update(prefs)
    .eq('user_id', userId);
  return { error: error?.message ?? null };
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  return { error: error?.message ?? null };
}
