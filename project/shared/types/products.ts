/** Retail menu product — DB row shape (snake_case). */
export type RetailProductDbRow = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number | string;
  image: string;
  rating: number | string;
  popular: boolean;
  seasonal: boolean;
  ai_recommended: boolean;
  in_stock?: boolean;
  calories: number;
  allergens: string[];
  sizes: unknown;
  milks: unknown;
  syrups: unknown;
  toppings: unknown;
  temperature: unknown;
  ice_levels: string[];
  nutrition: {
    calories: number;
    fat: number;
    carbs: number;
    protein: number;
    caffeine: number;
  };
  sort_order?: number;
};

/** Retail menu product — UI shape (camelCase). */
export type RetailUiProduct = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  popular: boolean;
  seasonal: boolean;
  aiRecommended?: boolean;
  calories: number;
  allergens: string[];
  sizes: RetailProductOption[];
  milks: RetailProductOption[];
  syrups: RetailProductOption[];
  toppings: RetailProductOption[];
  temperature: RetailProductOption[];
  iceLevels: string[];
  nutrition: RetailProductDbRow['nutrition'];
};

export type RetailProductOption = {
  id: string;
  label: string;
  priceModifier: number;
};

/** Retail categories table row (admin-web). */
export type RetailCategoryRow = {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};
