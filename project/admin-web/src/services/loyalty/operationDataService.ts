import { supabase } from '../../lib/supabase';
import type { BenefitUsageDailyStats } from '@shared/types/operations';

export type FreeCoffeeRedemptionRow = {
  id: string;
  user_id: string;
  store_id: string | null;
  product_name: string;
  redeemed_at: string;
};

export type OperationContext = {
  freeCoffees: FreeCoffeeRedemptionRow[];
  redemptions: { id: string; user_id: string; reward_id: string; points_spent: number; redeemed_at: string }[];
  rewards: { id: string; title: string; category?: string; points_cost?: number }[];
  pointsHistory: { id: string; user_id: string; title: string; points: number; type?: string; created_at: string }[];
  stamps: { id: string; user_id: string; stamped_at: string; redeemed: boolean }[];
  notifications: { id: string; user_id: string | null; title: string; body?: string; type: string; created_at: string }[];
};

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function fetchFreeCoffeeRedemptions(opts?: {
  userId?: string;
  storeId?: string;
  since?: string;
  limit?: number;
}): Promise<FreeCoffeeRedemptionRow[]> {
  let q = supabase.from('free_coffee_redemptions').select('*').order('redeemed_at', { ascending: false });
  if (opts?.userId) q = q.eq('user_id', opts.userId);
  if (opts?.storeId) q = q.eq('store_id', opts.storeId);
  if (opts?.since) q = q.gte('redeemed_at', opts.since);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as FreeCoffeeRedemptionRow[];
}

export async function fetchOperationContextForUser(userId: string): Promise<OperationContext> {
  const [freeCoffees, redemptions, rewards, pointsHistory, stamps, notifications] = await Promise.all([
    fetchFreeCoffeeRedemptions({ userId, limit: 100 }),
    supabase.from('reward_redemptions').select('*').eq('user_id', userId).order('redeemed_at', { ascending: false }).limit(100).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
    supabase.from('rewards').select('id, title, category, points_cost').then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
    supabase.from('points_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
    supabase.from('loyalty_stamps').select('*').eq('user_id', userId).order('stamped_at', { ascending: false }).limit(100).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
  ]);

  return {
    freeCoffees,
    redemptions: redemptions as OperationContext['redemptions'],
    rewards: rewards as OperationContext['rewards'],
    pointsHistory: pointsHistory as OperationContext['pointsHistory'],
    stamps: stamps as OperationContext['stamps'],
    notifications: notifications as OperationContext['notifications'],
  };
}

export async function fetchDailyBenefitStats(storeId?: string): Promise<BenefitUsageDailyStats> {
  const since = startOfTodayIso();
  let ordersQ = supabase.from('orders').select('total, billing_type').gte('created_at', since);
  if (storeId) ordersQ = ordersQ.eq('store_id', storeId);

  const [orders, freeCoffees, redemptions, notifications, pointsHistory] = await Promise.all([
    ordersQ.then(r => { if (r.error) throw new Error(r.error.message); return r.data ?? []; }),
    fetchFreeCoffeeRedemptions({ storeId, since, limit: 500 }),
    supabase.from('reward_redemptions').select('id').gte('redeemed_at', since).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
    supabase.from('notifications').select('id').gte('created_at', since).in('type', ['promo', 'promotion', 'campaign']).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
    supabase.from('points_history').select('points').gte('created_at', since).lt('points', 0).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
  ]);

  const freeOrders = orders.filter(o =>
    o.billing_type ? o.billing_type !== 'standard' : Number(o.total) === 0,
  ).length;

  return {
    freeOrders,
    stampRedemptions: freeCoffees.length,
    rewardRedemptions: redemptions.length,
    campaignNotifications: notifications.length,
    pointsRedeemed: pointsHistory.reduce((s, r) => s + Math.abs(Number(r.points)), 0),
  };
}

export async function fetchCouponRedemptionsForUser(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('coupon_redemptions')
    .select('*, coupons(code, title)')
    .eq('user_id', userId)
    .order('redeemed_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchCampaignApplicationsForUser(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('campaign_applications')
    .select('*, campaigns(title, name)')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOrderPaymentsForUser(userId: string, limit = 50) {
  const { data, error } = await supabase
    .from('order_payments')
    .select('*, orders!inner(order_number, user_id)')
    .eq('orders.user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchStoreOperationSnapshot(storeId: string, limit = 200): Promise<Pick<OperationContext, 'freeCoffees' | 'redemptions' | 'rewards'>> {
  const [freeCoffees, redemptions, rewards] = await Promise.all([
    fetchFreeCoffeeRedemptions({ storeId, limit }),
    supabase.from('reward_redemptions').select('*').order('redeemed_at', { ascending: false }).limit(limit).then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
    supabase.from('rewards').select('id, title, category, points_cost').then(r => {
      if (r.error) throw new Error(r.error.message);
      return r.data ?? [];
    }),
  ]);
  return {
    freeCoffees,
    redemptions: redemptions as OperationContext['redemptions'],
    rewards: rewards as OperationContext['rewards'],
  };
}
