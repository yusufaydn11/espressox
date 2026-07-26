/*
# Espresso X — Core Tables: Profiles, Stores, Products

1. New Tables:
   - profiles: Extended user data linked to auth.users
   - stores: Physical store locations
   - products: Menu items with customization options as JSONB
2. Security:
   - RLS on all tables
   - profiles: owner-scoped + admin read/update
   - stores, products: public read, admin write
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  tier text NOT NULL DEFAULT 'Bronz',
  points integer NOT NULL DEFAULT 0,
  lifetime_points integer NOT NULL DEFAULT 0,
  reward_wallet numeric(10,2) NOT NULL DEFAULT 0,
  wallet_credits numeric(10,2) NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  favorite_store_id text,
  birthday text DEFAULT '',
  favorite_drinks text[] DEFAULT '{}',
  is_blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- ============================================================
-- STORES
-- ============================================================
CREATE TABLE IF NOT EXISTS stores (
  id text PRIMARY KEY,
  name text NOT NULL,
  address text NOT NULL,
  lat numeric(10,6) NOT NULL,
  lng numeric(10,6) NOT NULL,
  hours text NOT NULL DEFAULT '07:00 – 22:00',
  open boolean NOT NULL DEFAULT true,
  busy text NOT NULL DEFAULT 'moderate' CHECK (busy IN ('quiet','moderate','busy')),
  amenities text[] DEFAULT '{}',
  drive_thru boolean NOT NULL DEFAULT false,
  wifi boolean NOT NULL DEFAULT false,
  parking boolean NOT NULL DEFAULT false,
  image_url text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_stores" ON stores;
CREATE POLICY "public_read_stores" ON stores
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_insert_stores" ON stores;
CREATE POLICY "admin_insert_stores" ON stores
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_stores" ON stores;
CREATE POLICY "admin_update_stores" ON stores
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_delete_stores" ON stores;
CREATE POLICY "admin_delete_stores" ON stores
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  image text NOT NULL DEFAULT '',
  rating numeric(2,1) NOT NULL DEFAULT 4.5,
  popular boolean NOT NULL DEFAULT false,
  seasonal boolean NOT NULL DEFAULT false,
  ai_recommended boolean NOT NULL DEFAULT false,
  in_stock boolean NOT NULL DEFAULT true,
  calories integer NOT NULL DEFAULT 0,
  allergens text[] DEFAULT '{}',
  sizes jsonb NOT NULL DEFAULT '[]',
  milks jsonb NOT NULL DEFAULT '[]',
  syrups jsonb NOT NULL DEFAULT '[]',
  toppings jsonb NOT NULL DEFAULT '[]',
  temperature jsonb NOT NULL DEFAULT '[]',
  ice_levels jsonb NOT NULL DEFAULT '[]',
  nutrition jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_insert_products" ON products;
CREATE POLICY "admin_insert_products" ON products
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_products" ON products;
CREATE POLICY "admin_update_products" ON products
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_delete_products" ON products;
CREATE POLICY "admin_delete_products" ON products
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ============================================================
-- Seed stores
-- ============================================================
INSERT INTO stores (id, name, address, lat, lng, hours, open, busy, amenities, drive_thru, wifi, parking)
VALUES
  ('s1', 'Nişantaşı Mağaza', 'Teşvikiye Cd. No:12, Şişli, İstanbul', 41.0510, 29.0078, '07:00 – 22:00', true, 'moderate', ARRAY['WiFi','Otopark','Drive-thru'], true, true, true),
  ('s2', 'Kadıköy Moda', 'Moda Cd. No:43, Kadıköy, İstanbul', 40.9798, 29.0247, '07:00 – 21:00', true, 'busy', ARRAY['WiFi'], false, true, false),
  ('s3', 'Beşiktaş İskele', 'Cumhuriyet Cd. No:5, Beşiktaş, İstanbul', 41.0426, 29.0034, '06:30 – 23:00', true, 'quiet', ARRAY['WiFi','Otopark'], false, true, true),
  ('s4', 'Karaköy Lokalı', 'Kemankeş Cd. No:1, Beyoğlu, İstanbul', 41.0250, 28.9744, '07:00 – 20:00', false, 'moderate', ARRAY['WiFi'], false, true, false),
  ('s5', 'Bakırköy Meydan', 'İstasyon Cd. No:88, Bakırköy, İstanbul', 40.9722, 28.8744, '07:00 – 22:30', true, 'busy', ARRAY['WiFi','Otopark','Drive-thru'], true, true, true)
ON CONFLICT (id) DO NOTHING;
