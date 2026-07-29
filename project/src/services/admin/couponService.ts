import { supabase } from '@/lib/supabase';
import type { Coupon as UiCoupon } from '@/context/AdminContext';
import { mapDbCouponToUi, mapUiCouponToDb, type DbCoupon } from './adminMappers';

export async function fetchCouponsForAdmin(): Promise<{ data: UiCoupon[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data as DbCoupon[]).map(mapDbCouponToUi), error: null };
}

export async function createCouponForAdmin(c: Partial<UiCoupon>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('coupons').insert(mapUiCouponToDb(c));
  return { error: error?.message ?? null };
}

export async function updateCouponForAdmin(id: string, patch: Partial<UiCoupon>): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('coupons')
    .update({ ...mapUiCouponToDb(patch), updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteCouponForAdmin(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  return { error: error?.message ?? null };
}
