import { supabase } from '../../lib/supabase';
import type { Product, Category } from '../../lib/supabase';

/** Retail menu catalog — `products` + `categories` tables only. */

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Product[];
}

export async function createProduct(p: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase.from('products').insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>): Promise<void> {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Category[];
}

export async function createCategory(c: Partial<Category>): Promise<Category> {
  const { data, error } = await supabase.from('categories').insert(c).select().single();
  if (error) throw new Error(error.message);
  return data as Category;
}

export async function updateCategory(id: string, patch: Partial<Category>): Promise<void> {
  const { error } = await supabase.from('categories').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderCategories(items: { id: string; sort_order: number }[]): Promise<void> {
  const { error } = await supabase.from('categories').upsert(items, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}
