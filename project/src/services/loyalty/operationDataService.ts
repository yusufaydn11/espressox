import { supabase } from '@/lib/supabase';
import type {
  PointsHistoryRow,
  LoyaltyStampRow,
  RewardRedemptionRow,
  Reward,
  QrScanRow,
  NotificationRow,
} from '@/lib/supabase';
import type { BenefitUsageDailyStats } from '@shared/types/operations';

export type FreeCoffeeRedemptionRow = {
  id: string;
  user_id: string;
  store_id: string | null;
  product_id: string | null;
  product_name: string;
  redeemed_at: string;
};

export type OperationContext = {
  freeCoffees: FreeCoffeeRedemptionRow[];
  redemptions: RewardRedemptionRow[];
  rewards: Reward[];
  pointsHistory: PointsHistoryRow[];
  stamps: LoyaltyStampRow[];
  qrScans: QrScanRow[];
  notifications: NotificationRow[];
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
}): Promise<{ data: FreeCoffeeRedemptionRow[] | null; error: string | null }> {
  let q = supabase
    .from('free_coffee_redemptions')
    .select('*')
    .order('redeemed_at', { ascending: false });
  if (opts?.userId) q = q.eq('user_id', opts.userId);
  if (opts?.storeId) q = q.eq('store_id', opts.storeId);
  if (opts?.since) q = q.gte('redeemed_at', opts.since);
  if (opts?.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) return { data: null, error: error.message };
  return { data: data as FreeCoffeeRedemptionRow[], error: null };
}

export async function fetchOperationContextForUser(
  userId: string,
): Promise<{ data: OperationContext | null; error: string | null }> {
  const [freeRes, redRes, rewRes, phRes, stRes, qrRes, nRes] = await Promise.all([
    fetchFreeCoffeeRedemptions({ userId, limit: 100 }),
    supabase.from('reward_redemptions').select('*').eq('user_id', userId).order('redeemed_at', { ascending: false }).limit(100),
    supabase.from('rewards').select('*'),
    supabase.from('points_history').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    supabase.from('loyalty_stamps').select('*').eq('user_id', userId).order('stamped_at', { ascending: false }).limit(100),
    supabase.from('qr_scans').select('*').eq('user_id', userId).order('scanned_at', { ascending: false }).limit(50),
    supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
  ]);

  if (freeRes.error) return { data: null, error: freeRes.error };
  if (redRes.error) return { data: null, error: redRes.error.message };
  if (rewRes.error) return { data: null, error: rewRes.error.message };
  if (phRes.error) return { data: null, error: phRes.error.message };
  if (stRes.error) return { data: null, error: stRes.error.message };
  if (qrRes.error) return { data: null, error: qrRes.error.message };
  if (nRes.error) return { data: null, error: nRes.error.message };

  return {
    data: {
      freeCoffees: freeRes.data ?? [],
      redemptions: redRes.data as RewardRedemptionRow[],
      rewards: rewRes.data as Reward[],
      pointsHistory: phRes.data as PointsHistoryRow[],
      stamps: stRes.data as LoyaltyStampRow[],
      qrScans: qrRes.data as QrScanRow[],
      notifications: nRes.data as NotificationRow[],
    },
    error: null,
  };
}

export async function fetchDailyBenefitStats(opts?: {
  storeId?: string;
}): Promise<{ data: BenefitUsageDailyStats | null; error: string | null }> {
  const since = startOfTodayIso();

  let ordersQ = supabase.from('orders').select('id, total, created_at').gte('created_at', since);
  if (opts?.storeId) ordersQ = ordersQ.eq('store_id', opts.storeId);

  const [ordersRes, fcrRes, redRes, notifRes, phRes] = await Promise.all([
    ordersQ,
    fetchFreeCoffeeRedemptions({ storeId: opts?.storeId, since, limit: 500 }),
    supabase.from('reward_redemptions').select('id, points_spent, redeemed_at').gte('redeemed_at', since),
    supabase.from('notifications').select('id, type, created_at').gte('created_at', since).in('type', ['promo', 'promotion', 'campaign']),
    supabase.from('points_history').select('points').gte('created_at', since).lt('points', 0),
  ]);

  if (ordersRes.error) return { data: null, error: ordersRes.error.message };
  if (fcrRes.error) return { data: null, error: fcrRes.error };
  if (redRes.error) return { data: null, error: redRes.error.message };
  if (notifRes.error) return { data: null, error: notifRes.error.message };
  if (phRes.error) return { data: null, error: phRes.error.message };

  const orders = ordersRes.data ?? [];
  const freeOrders = orders.filter(o => Number(o.total) === 0).length;

  return {
    data: {
      freeOrders,
      stampRedemptions: fcrRes.data?.length ?? 0,
      rewardRedemptions: redRes.data?.length ?? 0,
      campaignNotifications: notifRes.data?.length ?? 0,
      pointsRedeemed: (phRes.data ?? []).reduce((s, r) => s + Math.abs(Number(r.points)), 0),
    },
    error: null,
  };
}

export async function fetchStoreOperationSnapshot(
  storeId: string,
  limit = 200,
): Promise<Pick<OperationContext, 'freeCoffees' | 'redemptions' | 'rewards'>> {
  const [freeRes, redRes, rewRes] = await Promise.all([
    fetchFreeCoffeeRedemptions({ storeId, limit }),
    supabase.from('reward_redemptions').select('*').order('redeemed_at', { ascending: false }).limit(limit),
    supabase.from('rewards').select('id, title, category, points_cost'),
  ]);
  if (redRes.error) throw new Error(redRes.error.message);
  if (rewRes.error) throw new Error(rewRes.error.message);
  return {
    freeCoffees: freeRes.data ?? [],
    redemptions: (redRes.data ?? []) as RewardRedemptionRow[],
    rewards: (rewRes.data ?? []) as Reward[],
  };
}
