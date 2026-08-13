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

/** Pexels photo IDs that no longer resolve (404) → working replacements. */
export const BROKEN_PEXELS_REPLACEMENTS: Record<string, string> = {
  '2304771': '851555', // matcha
  '2135': '1775043', // croissant / pastry
  '312428': '3226868', // discount reward
  '2198032': '1695052', // birthday reward
  '2599295': '302899', // removed generic coffee stock
};

export function retailProductImageUrl(
  photoId: string = DEFAULT_PRODUCT_IMAGE_ID,
  width = 800,
): string {
  const resolvedId = BROKEN_PEXELS_REPLACEMENTS[photoId] ?? photoId;
  return `https://images.pexels.com/photos/${resolvedId}/pexels-photo-${resolvedId}.jpeg?auto=compress&cs=tinysrgb&w=${width}`;
}

/** Normalize product/reward image URLs; swap known-dead Pexels links. */
export function resolveProductImageUrl(
  url: string | null | undefined,
  width = 800,
): string {
  if (!url?.trim()) return retailProductImageUrl(DEFAULT_PRODUCT_IMAGE_ID, width);
  for (const [broken, replacement] of Object.entries(BROKEN_PEXELS_REPLACEMENTS)) {
    if (url.includes(`/photos/${broken}/`) || url.includes(`pexels-photo-${broken}`)) {
      return retailProductImageUrl(replacement, width);
    }
  }
  return url;
}
