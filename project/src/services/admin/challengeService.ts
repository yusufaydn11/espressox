import { supabase } from '@/lib/supabase';
import type { Challenge } from '@/types';

type DbChallenge = {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward_points: number;
  expires_label: string | null;
  type: 'weekly' | 'monthly' | 'streak';
  is_active: boolean;
};

function mapDbToUi(row: DbChallenge): Challenge {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    progress: row.progress,
    target: row.target,
    rewardPoints: row.reward_points,
    expires: row.expires_label ?? '—',
    type: row.type,
  };
}

function mapUiToDb(c: Partial<Challenge>): Record<string, unknown> {
  return {
    title: c.title?.trim(),
    description: c.description?.trim() ?? '',
    progress: c.progress ?? 0,
    target: c.target ?? 5,
    reward_points: c.rewardPoints ?? 100,
    expires_label: c.expires ?? null,
    type: c.type ?? 'weekly',
    is_active: true,
  };
}

export async function fetchChallengesForAdmin(): Promise<{ data: Challenge[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('loyalty_challenges')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data as DbChallenge[]).map(mapDbToUi), error: null };
}

export async function createChallengeForAdmin(c: Partial<Challenge>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('loyalty_challenges').insert(mapUiToDb(c));
  return { error: error?.message ?? null };
}

export async function updateChallengeForAdmin(id: string, patch: Partial<Challenge>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('loyalty_challenges')
    .update({ ...mapUiToDb(patch), updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteChallengeForAdmin(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('loyalty_challenges').update({ is_active: false }).eq('id', id);
  return { error: error?.message ?? null };
}
