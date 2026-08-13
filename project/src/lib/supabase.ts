import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  const msg = 'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY';
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(`[supabase] ${msg}`);
  } else {
    throw new Error(msg);
  }
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

export type Profile = {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  avatar_url: string;
  tier: string;
  points: number;
  lifetime_points: number;
  reward_wallet: number;
  wallet_credits: number;
  streak: number;
  favorite_store_id: string | null;
  birthday: string;
  favorite_drinks: string[];
  is_blocked: boolean;
  role: string;
  expo_push_token: string | null;
  last_sign_in_at: string | null;
  created_at: string;
  updated_at: string;
};

export type UserRole = {
  id: string;
  user_id: string;
  role: 'customer' | 'staff' | 'store_manager' | 'admin' | 'super_admin' | 'franchise';
  store_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
};

export type Store = {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  hours: string;
  open: boolean;
  busy: string;
  amenities: string[];
  drive_thru: boolean;
  wifi: boolean;
  parking: boolean;
  image_url: string;
  phone: string | null;
  whatsapp: string | null;
  franchise_id: string | null;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  popular: boolean;
  seasonal: boolean;
  ai_recommended: boolean;
  in_stock: boolean;
  calories: number;
  allergens: string[];
  sizes: ProductOption[];
  milks: ProductOption[];
  syrups: ProductOption[];
  toppings: ProductOption[];
  temperature: ProductOption[];
  ice_levels: string[];
  nutrition: Nutrition;
  sort_order: number;
};

export type ProductOption = {
  id: string;
  label: string;
  priceModifier: number;
};

export type Nutrition = {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  caffeine: number;
};

export type Reward = {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  category: string;
  image: string;
  is_active: boolean;
};

export type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  order_type: string;
  store_id: string | null;
  store_name: string;
  total: number;
  subtotal?: number;
  discount_amount?: number;
  points_earned: number;
  points_spent?: number;
  points_credited?: boolean;
  billing_type?: string;
  reward_id?: string | null;
  coupon_id?: string | null;
  campaign_id?: string | null;
  benefit_source?: string | null;
  benefit_title?: string | null;
  payment_method?: string | null;
  payment_status?: string | null;
  transaction_id?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  customizations: Record<string, unknown>;
};

export type PointsHistoryRow = {
  id: string;
  user_id: string;
  title: string;
  points: number;
  type: string;
  created_at: string;
};

export type LoyaltyStampRow = {
  id: string;
  user_id: string;
  store_id: string | null;
  stamped_at: string;
  redeemed: boolean;
};

export type RewardRedemptionRow = {
  id: string;
  user_id: string;
  reward_id: string;
  points_spent: number;
  redeemed_at: string;
};

export type CampaignRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  target_segment: string;
  store_id: string | null;
  message: string;
  title: string;
  reach: number;
  conversion: number;
  revenue: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  data: Record<string, unknown>;
  created_at: string;
};

export type NotificationPrefsRow = {
  id: string;
  user_id: string;
  master_enabled: boolean;
  order_updates: boolean;
  promotions: boolean;
  rewards: boolean;
  challenges: boolean;
};

export type QrCodeRow = {
  id: string;
  user_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
  rotated_at: string | null;
};

export type QrScanRow = {
  id: string;
  user_id: string;
  qr_code_id: string | null;
  store_id: string | null;
  action: string;
  points_awarded: number;
  dedup_token: string;
  scanned_at: string;
  scanned_by: string | null;
};
