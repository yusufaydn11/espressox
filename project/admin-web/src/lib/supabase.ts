import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check admin-web/.env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type AdminRole = 'super_admin' | 'franchise' | 'store_manager' | 'staff';

export interface UserProfile {
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
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  expo_push_token: string | null;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AdminRole;
  store_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Store {
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
}

export interface Product {
  id: string;
  name: string;
  category: string;
  category_id: string | null;
  description: string;
  price: number;
  discount_price: number | null;
  image: string;
  rating: number;
  popular: boolean;
  seasonal: boolean;
  ai_recommended: boolean;
  in_stock: boolean;
  is_active: boolean;
  calories: number;
  allergens: string[];
  sizes: unknown[];
  milks: unknown[];
  syrups: unknown[];
  toppings: unknown[];
  temperature: unknown[];
  ice_levels: string[];
  nutrition: { calories: number; fat: number; carbs: number; protein: number; caffeine: number };
  store_overrides: Record<string, unknown>;
  sort_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  order_type: string;
  store_id: string | null;
  store_name: string;
  total: number;
  points_earned: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  customizations: Record<string, unknown>;
}

export interface CampaignRow {
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
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: 'percent' | 'fixed' | 'free_item' | 'bxgy';
  value: number;
  min_order: number;
  target_segment: string;
  store_id: string | null;
  max_redemptions: number | null;
  redemptions_count: number;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  points_cost: number;
  category: string;
  image: string;
  is_active: boolean;
  created_at: string;
}

export interface Franchise {
  id: string;
  company_name: string;
  tax_id: string | null;
  authorized_person: string;
  authorized_email: string | null;
  authorized_phone: string | null;
  contract_start: string | null;
  contract_end: string | null;
  royalty_percent: number;
  status: 'active' | 'suspended' | 'terminated';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  role: 'manager' | 'shift_lead' | 'barista' | 'cashier' | 'kitchen';
  store_id: string | null;
  franchise_id: string | null;
  hire_date: string | null;
  is_active: boolean;
  avatar_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category: string | null;
  min_stock: number;
  cost_per_unit: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  store_id: string;
  delta: number;
  reason: string;
  actor_id: string | null;
  created_at: string;
}

export interface StoreStock {
  store_id: string | null;
  item_id: string;
  name: string;
  sku: string;
  unit: string;
  min_stock: number;
  current_stock: number;
}

export interface LoyaltySettings {
  id: string;
  earn_rate: number;
  redeem_rate: number;
  bronze_min: number;
  silver_min: number;
  gold_min: number;
  vip_min: number;
  points_per_stamp: number;
  stamps_per_free_coffee: number;
  updated_at: string;
  updated_by: string | null;
}

export interface PushJob {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  target_segment: string;
  store_id: string | null;
  audience_count: number | null;
  status: 'queued' | 'sending' | 'sent' | 'failed';
  sent_by: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  data: Record<string, unknown>;
  created_at: string;
}

// ─── B2B Types ──────────────────────────────────────────────
export interface B2BOrder {
  id: string;
  order_number: string;
  store_id: string | null;
  franchise_id: string | null;
  warehouse_id: string | null;
  status: 'awaiting_payment' | 'paid' | 'confirmed' | 'preparing' | 'shipped' | 'delivered' | 'cancelled';
  subtotal: number;
  vat_total: number;
  total: number;
  notes: string;
  carrier_company: string;
  tracking_number: string;
  tracking_url: string;
  estimated_delivery: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  paid_at: string | null;
  confirmed_at: string | null;
  cancel_reason: string;
  created_at: string;
  updated_at: string;
  b2b_order_items?: B2BOrderItem[];
}

export interface B2BOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  sku: string;
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  line_total: number;
}

export interface B2BInvoice {
  id: string;
  invoice_number: string;
  order_id: string;
  status: 'issued' | 'paid' | 'partial' | 'cancelled';
  subtotal: number;
  vat_total: number;
  total: number;
  paid_amount: number;
  pdf_url: string;
  e_invoice_status: string;
  issued_at: string;
  paid_at: string | null;
  created_at: string;
}

export interface B2BPayment {
  id: string;
  payment_number: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  provider: string;
  payment_method: string;
  paid_at: string | null;
  created_at: string;
}

export interface B2BLedgerEntry {
  id: string;
  entry_number: string;
  franchise_id: string;
  type: 'debit' | 'credit';
  amount: number;
  description: string;
  balance_after: number;
  created_at: string;
}

// ─── B2B Product Management ──────────────────────────────────
export interface B2BProduct {
  id: string;
  sku: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  unit: string;
  price: number;
  vat_rate: number;
  min_order_qty: number;
  is_active: boolean;
  campaign_label: string;
  campaign_price: number | null;
  campaign_ends: string | null;
  default_warehouse_id: string | null;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface B2BProductStock {
  id: string;
  product_id: string;
  warehouse_id: string;
  stock_qty: number;
  reserved_qty: number;
  updated_at: string;
}

export interface B2BWarehouse {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  is_active: boolean;
  is_default: boolean;
}
