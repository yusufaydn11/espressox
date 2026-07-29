import { RETAIL_CATEGORY_ALL } from '../constants/products';
import type { RetailProductDbRow, RetailProductOption, RetailUiProduct } from '../types/products';
import { formatPrice } from './format';

export function formatRetailProductPrice(price: number): string {
  return formatPrice(price);
}

export function mapRetailDbProductToUi(p: RetailProductDbRow): RetailUiProduct {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    description: p.description,
    price: Number(p.price),
    image: p.image,
    rating: Number(p.rating),
    popular: p.popular,
    seasonal: p.seasonal,
    aiRecommended: p.ai_recommended,
    calories: p.calories,
    allergens: p.allergens,
    sizes: p.sizes as RetailProductOption[],
    milks: p.milks as RetailProductOption[],
    syrups: p.syrups as RetailProductOption[],
    toppings: p.toppings as RetailProductOption[],
    temperature: p.temperature as RetailProductOption[],
    iceLevels: p.ice_levels,
    nutrition: p.nutrition,
  };
}

export function mapRetailDbProductsToUi(rows: RetailProductDbRow[]): RetailUiProduct[] {
  return rows.map(mapRetailDbProductToUi);
}

/** Admin mobile: UI form → DB patch for products table. */
export function mapRetailUiProductToDb(
  form: RetailUiProduct,
  opts?: { in_stock?: boolean },
): Partial<RetailProductDbRow> {
  return {
    id: form.id,
    name: form.name,
    category: form.category,
    description: form.description,
    price: form.price,
    image: form.image,
    rating: form.rating,
    popular: form.popular,
    seasonal: form.seasonal,
    ai_recommended: form.aiRecommended ?? false,
    calories: form.calories,
    allergens: form.allergens,
    sizes: form.sizes,
    milks: form.milks,
    syrups: form.syrups,
    toppings: form.toppings,
    temperature: form.temperature,
    ice_levels: form.iceLevels,
    nutrition: form.nutrition,
    in_stock: opts?.in_stock ?? true,
  };
}

export function deriveRetailCategories(
  products: Pick<RetailUiProduct, 'category'>[],
  allLabel: string = RETAIL_CATEGORY_ALL,
): string[] {
  const set = new Set<string>();
  products.forEach(p => set.add(p.category));
  return [allLabel, ...Array.from(set).sort()];
}

export function filterRetailProductsByCategory<T extends Pick<RetailUiProduct, 'category'>>(
  products: T[],
  category: string,
  allLabel: string = RETAIL_CATEGORY_ALL,
): T[] {
  if (category === allLabel) return products;
  return products.filter(p => p.category === category);
}

export function filterRetailProductsBySearch<T extends Pick<RetailUiProduct, 'name'>>(
  products: T[],
  query: string,
): T[] {
  if (!query.trim()) return products;
  const q = query.toLowerCase();
  return products.filter(p => p.name.toLowerCase().includes(q));
}

export function filterRetailPopularProducts<T extends Pick<RetailUiProduct, 'popular'>>(
  products: T[],
): T[] {
  return products.filter(p => p.popular);
}

export function filterRetailRecommendedProducts<T extends Pick<RetailUiProduct, 'aiRecommended'>>(
  products: T[],
): T[] {
  return products.filter(p => p.aiRecommended);
}
