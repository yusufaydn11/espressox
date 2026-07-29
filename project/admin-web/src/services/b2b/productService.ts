import { supabase } from '../../lib/supabase';
import type { B2BProduct, B2BProductStock, B2BWarehouse } from '../../lib/supabase';

/** B2B supply catalog — `b2b_products` + stock/warehouses. Separate from retail `products`. */

export async function fetchB2BProducts(): Promise<B2BProduct[]> {
  const { data, error } = await supabase
    .from('b2b_products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data as B2BProduct[];
}

export async function createB2BProduct(p: Partial<B2BProduct>): Promise<B2BProduct> {
  const { data, error } = await supabase.from('b2b_products').insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as B2BProduct;
}

export async function updateB2BProduct(id: string, patch: Partial<B2BProduct>): Promise<void> {
  const { error } = await supabase
    .from('b2b_products')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteB2BProduct(id: string): Promise<void> {
  const { error } = await supabase.from('b2b_products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchB2BWarehouses(): Promise<B2BWarehouse[]> {
  const { data, error } = await supabase.from('b2b_warehouses').select('*').order('name');
  if (error) throw new Error(error.message);
  return data as B2BWarehouse[];
}

export async function fetchB2BProductStock(
  productId: string,
): Promise<(B2BProductStock & { b2b_warehouses: { name: string } })[]> {
  const { data, error } = await supabase
    .from('b2b_product_stock')
    .select('*, b2b_warehouses(name)')
    .eq('product_id', productId);
  if (error) throw new Error(error.message);
  return data as (B2BProductStock & { b2b_warehouses: { name: string } })[];
}

export async function upsertB2BProductStock(
  productId: string,
  warehouseId: string,
  stockQty: number,
): Promise<void> {
  const { error } = await supabase
    .from('b2b_product_stock')
    .upsert(
      { product_id: productId, warehouse_id: warehouseId, stock_qty: stockQty },
      { onConflict: 'product_id,warehouse_id' },
    );
  if (error) throw new Error(error.message);
}
