/** Retail product badge labels (customer-facing). */
export const RETAIL_PRODUCT_BADGE_LABELS = {
  popular: 'Popüler',
  seasonal: 'Mevsimlik',
  aiRecommended: 'ÖNERİLEN',
} as const;

/** Retail product badge labels (mobile admin panel — uppercase). */
export const RETAIL_PRODUCT_BADGE_LABELS_ADMIN = {
  popular: 'POPÜLER',
  seasonal: 'MEVSİMLİK',
} as const;

export const RETAIL_CATEGORY_ALL = 'Tümü';

export const RETAIL_SEARCH_PLACEHOLDERS = {
  menu: 'İçecek veya yemek ara…',
  admin: 'Ürün ara…',
} as const;

/** Default Pexels product image URL pattern. */
export const DEFAULT_PRODUCT_IMAGE_ID = '302899';

export function retailProductImageUrl(
  photoId: string = DEFAULT_PRODUCT_IMAGE_ID,
  width = 800,
): string {
  return `https://images.pexels.com/photos/${photoId}/pexels-photo-${photoId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}
