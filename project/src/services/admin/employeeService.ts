import { supabase, type Store } from '@/lib/supabase';
import type { Employee as UiEmployee } from '@/types';
import { mapDbEmployeeToUi, mapUiEmployeeToDb, type DbEmployee } from './adminMappers';

export async function fetchEmployeesForAdmin(
  stores: Store[],
): Promise<{ data: UiEmployee[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: (data as DbEmployee[]).map(row => mapDbEmployeeToUi(row, stores)), error: null };
}

export async function createEmployeeForAdmin(
  e: Partial<UiEmployee>,
  stores: Store[],
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('employees').insert(mapUiEmployeeToDb(e, stores));
  return { error: error?.message ?? null };
}

export async function updateEmployeeForAdmin(
  id: string,
  patch: Partial<UiEmployee>,
  stores: Store[],
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('employees')
    .update({ ...mapUiEmployeeToDb(patch, stores), updated_at: new Date().toISOString() })
    .eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteEmployeeForAdmin(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  return { error: error?.message ?? null };
}
