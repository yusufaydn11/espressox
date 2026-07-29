import { supabase } from '../../lib/supabase';
import type { Reward, LoyaltySettings } from '../../lib/supabase';

export async function fetchRewards(): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .order('points_cost', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Reward[];
}

export async function createReward(r: Partial<Reward>): Promise<Reward> {
  const { data, error } = await supabase.from('rewards').insert(r).select().single();
  if (error) throw new Error(error.message);
  return data as Reward;
}

export async function updateReward(id: string, patch: Partial<Reward>): Promise<void> {
  const { error } = await supabase.from('rewards').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteReward(id: string): Promise<void> {
  const { error } = await supabase.from('rewards').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchLoyaltySettings(): Promise<LoyaltySettings | null> {
  const { data, error } = await supabase.from('loyalty_settings').select('*').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LoyaltySettings | null;
}

export async function updateLoyaltySettings(id: string, patch: Partial<LoyaltySettings>): Promise<void> {
  const { error } = await supabase
    .from('loyalty_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchPointsRedeemedTotal(): Promise<number> {
  const { data, error } = await supabase.from('points_history').select('points').lt('points', 0);
  if (error) throw new Error(error.message);
  return Math.abs((data as { points: number }[] | null)?.reduce((s, r) => s + r.points, 0) ?? 0);
}

export async function fetchTierBreakdown(): Promise<{ label: string; value: number }[]> {
  const { data, error } = await supabase.from('profiles').select('tier');
  if (error) return [];
  const map: Record<string, number> = {};
  (data as { tier: string }[]).forEach(r => {
    map[r.tier] = (map[r.tier] ?? 0) + 1;
  });
  return Object.entries(map).map(([label, value]) => ({ label, value }));
}
