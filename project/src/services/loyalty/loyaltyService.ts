import { supabase, type Profile, type Reward, type PointsHistoryRow, type LoyaltyStampRow, type RewardRedemptionRow, type QrCodeRow, type QrScanRow } from '@/lib/supabase';
import { DEFAULT_EARN_RATE, POINTS_PER_STAMP } from '@shared/constants/loyalty';
import { parseRedeemRpcResult } from '@shared/utils/loyalty';
import type { RedeemRpcPayload } from '@shared/types/loyalty';

/**
 * Loyalty data access layer. Pure fetch/RPC wrappers — suitable for future
 * in-memory or query caching without changing consumer hooks/screens.
 */

export async function fetchActiveRewards(): Promise<{ data: Reward[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('is_active', true);
  if (error) return { data: null, error: error.message };
  return { data: data as Reward[], error: null };
}

export async function fetchAllRewards(): Promise<{ data: Reward[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .order('points_cost');
  if (error) return { data: null, error: error.message };
  return { data: data as Reward[], error: null };
}

export async function createReward(r: Partial<Reward>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('rewards').insert(r);
  return { error: error?.message ?? null };
}

export async function updateReward(id: string, patch: Partial<Reward>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('rewards').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteReward(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('rewards').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function fetchPointsHistory(
  userId: string,
  limit = 20,
): Promise<{ data: PointsHistoryRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('points_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: data as PointsHistoryRow[], error: null };
}

export async function fetchLoyaltyStamps(
  userId: string,
): Promise<{ data: LoyaltyStampRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('loyalty_stamps')
    .select('*')
    .eq('user_id', userId)
    .order('stamped_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data as LoyaltyStampRow[], error: null };
}

export async function fetchRewardRedemptions(
  userId: string,
): Promise<{ data: RewardRedemptionRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('reward_redemptions')
    .select('*')
    .eq('user_id', userId)
    .order('redeemed_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data as RewardRedemptionRow[], error: null };
}

export async function fetchQrCode(
  userId: string,
): Promise<{ data: QrCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  if (data) return { data: data as QrCodeRow, error: null };

  const code = `EX-${userId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const { data: created, error: insErr } = await supabase
    .from('qr_codes')
    .insert({ user_id: userId, code })
    .select('*')
    .maybeSingle();
  if (insErr) return { data: null, error: insErr.message };
  return { data: created as QrCodeRow, error: null };
}

export async function fetchQrScans(
  userId: string,
  limit = 20,
): Promise<{ data: QrScanRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('qr_scans')
    .select('*')
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: data as QrScanRow[], error: null };
}

export async function fetchQrScansForAdmin(
  limit = 20,
): Promise<{ data: QrScanRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('qr_scans')
    .select('*')
    .order('scanned_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: data as QrScanRow[], error: null };
}

export async function fetchEarnRate(): Promise<number> {
  const { data } = await supabase
    .from('loyalty_settings')
    .select('earn_rate')
    .limit(1)
    .maybeSingle();
  if (data && typeof (data as { earn_rate: number }).earn_rate === 'number') {
    return Number((data as { earn_rate: number }).earn_rate);
  }
  return DEFAULT_EARN_RATE;
}

export async function redeemReward(
  rewardId: string,
): Promise<{ error: string | null; needed?: number }> {
  const { data, error } = await supabase.rpc('redeem_reward', {
    p_reward_id: rewardId,
  });
  if (error) return { error: error.message };
  const result = parseRedeemRpcResult(data as RedeemRpcPayload);
  if (result.error === 'insufficient_points') {
    return { error: 'insufficient_points', needed: result.needed };
  }
  return result;
}

export async function addPoints(
  amount: number,
  title = 'Puan eklendi',
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('add_points', { p_amount: amount, p_title: title });
  return { error: error?.message ?? null };
}

export async function spendPoints(
  amount: number,
  title = 'Ödül kullanıldı',
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('spend_points', { p_amount: amount, p_title: title });
  return { error: error?.message ?? null };
}

export async function lookupQrByCode(
  code: string,
): Promise<{ data: QrCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('code', code)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as QrCodeRow | null, error: null };
}

export type QrScanRpcResult = {
  error: string | null;
  points_awarded?: number;
  customer_id?: string;
};

export async function scanQrStamp(
  qrCodeId: string,
  storeId: string | null,
  points = POINTS_PER_STAMP,
): Promise<{ data: QrScanRpcResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('qr_scan', {
    p_qr_code_id: qrCodeId,
    p_store_id: storeId,
    p_action: 'stamp',
    p_points: points,
  });
  if (error) return { data: null, error: error.message };
  return { data: data as QrScanRpcResult, error: null };
}

export async function fetchProfileByUserId(
  userId: string,
): Promise<{ data: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as Profile | null, error: null };
}

export async function countActiveStamps(
  userId: string,
): Promise<{ count: number | null; error: string | null }> {
  const { count, error } = await supabase
    .from('loyalty_stamps')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('redeemed', false);
  if (error) return { count: null, error: error.message };
  return { count: count ?? 0, error: null };
}
