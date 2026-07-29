import { useState, useEffect, useCallback } from 'react';
import { supabase, type Store, type Reward, type CampaignRow, type NotificationPrefsRow } from '@/lib/supabase';
import { fetchOrdersByUserId, createOrder as createOrderService } from '@/services/orders';
import {
  fetchByUserId,
  fetchPrefs,
  markNotificationRead,
  updatePrefs,
} from '@/services/notifications';
import {
  fetchActiveRewards,
  fetchPointsHistory,
  fetchLoyaltyStamps,
  fetchRewardRedemptions,
  fetchQrCode,
  fetchQrScans,
  redeemReward as redeemRewardService,
} from '@/services/loyalty';
import {
  fetchActiveProducts,
} from '@/services/products';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-supplied dependency list
  }, deps);

  useEffect(() => { reload(); }, [reload]);

  return { data, error, loading, reload, setData };
}

export function useProducts() {
  return useAsync(async () => fetchActiveProducts(), []);
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
  return useAsync(async () => fetchActiveRewards(), []);
}

export function useOrders() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    return fetchOrdersByUserId(user.id);
  }, [user?.id]);
}

export function usePointsHistory() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    return fetchPointsHistory(user.id);
  }, [user?.id]);
}

export function useLoyaltyStamps() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    return fetchLoyaltyStamps(user.id);
  }, [user?.id]);
}

export function useRewardRedemptions() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    return fetchRewardRedemptions(user.id);
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
    return fetchByUserId(user.id);
  }, [user?.id]);
}

export function useNotificationPrefs() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: null, error: null };
    return fetchPrefs(user.id);
  }, [user?.id]);
}

export function useQrCode() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: null, error: null };
    return fetchQrCode(user.id);
  }, [user?.id]);
}

export function useQrScans() {
  const { user } = useAuth();
  return useAsync(async () => {
    if (!user) return { data: [], error: null };
    return fetchQrScans(user.id);
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

    const result = await createOrderService({
      items: params.items.map(it => ({
        name: it.name,
        qty: it.qty,
        price: it.price,
        productId: it.productId ?? null,
      })),
      total: params.total,
      storeId: params.storeId ?? null,
      storeName: params.storeName,
      orderType: params.orderType,
    });

    if (result.error) return { error: result.error };

    await refreshProfile();
    return {
      error: null,
      orderNumber: result.orderNumber,
      pointsEarned: result.pointsEarned ?? 0,
    };
  }, [user, refreshProfile]);
}

export function useRedeemReward() {
  const { user, refreshProfile } = useAuth();

  return useCallback(async (reward: Reward) => {
    if (!user) return { error: 'Giriş yapmalısınız' };

    const result = await redeemRewardService(reward.id);
    if (result.error === 'insufficient_points') {
      return { error: `${result.needed ?? 0} puana daha ihtiyacın var` };
    }
    if (result.error) return { error: result.error };

    await refreshProfile();
    return { error: null };
  }, [user, refreshProfile]);
}

export async function updateNotificationPrefs(userId: string, prefs: Partial<NotificationPrefsRow>) {
  return updatePrefs(userId, prefs);
}

export { markNotificationRead };
