import { supabase } from '@/lib/supabase';

export type CustomerAddress = {
  id: string;
  user_id: string;
  label: string;
  line1: string;
  line2: string;
  city: string;
  district: string;
  postal_code: string;
  is_default: boolean;
  created_at: string;
};

export async function fetchAddresses(): Promise<{ data: CustomerAddress[]; error: string | null }> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as CustomerAddress[], error: null };
}

export async function saveAddress(input: Omit<CustomerAddress, 'id' | 'user_id' | 'created_at'> & { id?: string }): Promise<{ error: string | null }> {
  if (input.id) {
    const { error } = await supabase.from('customer_addresses').update({
      label: input.label,
      line1: input.line1,
      line2: input.line2,
      city: input.city,
      district: input.district,
      postal_code: input.postal_code,
      is_default: input.is_default,
    }).eq('id', input.id);
    return { error: error?.message ?? null };
  }
  const { error } = await supabase.from('customer_addresses').insert({
    label: input.label,
    line1: input.line1,
    line2: input.line2,
    city: input.city,
    district: input.district,
    postal_code: input.postal_code,
    is_default: input.is_default,
  });
  return { error: error?.message ?? null };
}

export async function deleteAddress(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
  return { error: error?.message ?? null };
}
