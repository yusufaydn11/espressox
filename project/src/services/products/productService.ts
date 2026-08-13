import { supabase, type Product } from '@/lib/supabase';
import { resolveProductImageUrl } from '@shared/constants/products';

function withResolvedImages(products: Product[]): Product[] {
  return products.map(p => ({ ...p, image: resolveProductImageUrl(p.image) }));
}

/**
 * Retail menu catalog (`products` table). Independent from B2B `b2b_products`.
 * Pure fetch/CRUD wrappers — suitable for future caching without behavior changes.
 */

export async function fetchActiveProducts(): Promise<{ data: Product[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('in_stock', true)
    .order('sort_order', { ascending: true });
  if (error) return { data: null, error: error.message };
  return { data: withResolvedImages(data as Product[]), error: null };
}

export async function fetchAllProducts(): Promise<{ data: Product[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order');
  if (error) return { data: null, error: error.message };
  return { data: withResolvedImages(data as Product[]), error: null };
}

export async function createProduct(p: Partial<Product>): Promise<{ error: string | null }> {
  const { error } = await supabase.from('products').insert(p);
  return { error: error?.message ?? null };
}

export async function updateProduct(
  id: string,
  patch: Partial<Product>,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

export async function deleteProduct(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  return { error: error?.message ?? null };
}
