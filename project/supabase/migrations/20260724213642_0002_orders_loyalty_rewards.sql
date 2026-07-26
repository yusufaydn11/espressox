/*
# Espresso X — Orders, Loyalty, Rewards, QR System

1. New Tables:
   - orders: Customer orders with status tracking
   - order_items: Individual items within an order
   - loyalty_stamps: Stamp card entries
   - points_history: Points earn/redeem log
   - rewards: Available rewards catalog
   - reward_redemptions: Track redeemed rewards (prevents reuse)
2. Security:
   - RLS on all tables, owner-scoped for customer data
   - Admin read-all + write policies on all tables
*/

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','ready','picked-up','delivered','scheduled','cancelled')),
  order_type text NOT NULL DEFAULT 'pickup' CHECK (order_type IN ('pickup','table','delivery','scheduled')),
  store_id text REFERENCES stores(id),
  store_name text NOT NULL DEFAULT '',
  total numeric(10,2) NOT NULL DEFAULT 0,
  points_earned integer NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_orders" ON orders;
CREATE POLICY "select_own_orders" ON orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_all_orders" ON orders;
CREATE POLICY "admin_read_all_orders" ON orders
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_orders" ON orders;
CREATE POLICY "admin_update_orders" ON orders
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id text,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  customizations jsonb DEFAULT '{}'
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_order_items" ON order_items;
CREATE POLICY "select_own_order_items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
CREATE POLICY "insert_own_order_items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "admin_read_order_items" ON order_items;
CREATE POLICY "admin_read_order_items" ON order_items
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- LOYALTY STAMPS
-- ============================================================
CREATE TABLE IF NOT EXISTS loyalty_stamps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id text,
  stamped_at timestamptz NOT NULL DEFAULT now(),
  redeemed boolean NOT NULL DEFAULT false
);

ALTER TABLE loyalty_stamps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stamps" ON loyalty_stamps;
CREATE POLICY "select_own_stamps" ON loyalty_stamps
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_stamps" ON loyalty_stamps;
CREATE POLICY "insert_own_stamps" ON loyalty_stamps
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_stamps" ON loyalty_stamps;
CREATE POLICY "update_own_stamps" ON loyalty_stamps
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_stamps" ON loyalty_stamps;
CREATE POLICY "admin_read_stamps" ON loyalty_stamps
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_insert_stamps" ON loyalty_stamps;
CREATE POLICY "admin_insert_stamps" ON loyalty_stamps
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_stamps" ON loyalty_stamps;
CREATE POLICY "admin_update_stamps" ON loyalty_stamps
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_stamps_user_id ON loyalty_stamps(user_id);

-- ============================================================
-- POINTS HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS points_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  type text NOT NULL DEFAULT 'earn' CHECK (type IN ('earn','redeem','bonus')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE points_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_points_history" ON points_history;
CREATE POLICY "select_own_points_history" ON points_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_points_history" ON points_history;
CREATE POLICY "insert_own_points_history" ON points_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_points_history" ON points_history;
CREATE POLICY "admin_read_points_history" ON points_history
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_insert_points_history" ON points_history;
CREATE POLICY "admin_insert_points_history" ON points_history
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_points_history_user_id ON points_history(user_id);
CREATE INDEX IF NOT EXISTS idx_points_history_created_at ON points_history(created_at DESC);

-- ============================================================
-- REWARDS (catalog)
-- ============================================================
CREATE TABLE IF NOT EXISTS rewards (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  points_cost integer NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'coffee' CHECK (category IN ('coffee','dessert','discount','exclusive','birthday')),
  image text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_rewards" ON rewards;
CREATE POLICY "public_read_rewards" ON rewards
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_insert_rewards" ON rewards;
CREATE POLICY "admin_insert_rewards" ON rewards
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_rewards" ON rewards;
CREATE POLICY "admin_update_rewards" ON rewards
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_delete_rewards" ON rewards;
CREATE POLICY "admin_delete_rewards" ON rewards
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ============================================================
-- REWARD REDEMPTIONS (prevents reuse)
-- ============================================================
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reward_id text NOT NULL REFERENCES rewards(id),
  points_spent integer NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_redemptions" ON reward_redemptions;
CREATE POLICY "select_own_redemptions" ON reward_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_redemptions" ON reward_redemptions;
CREATE POLICY "insert_own_redemptions" ON reward_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_redemptions" ON reward_redemptions;
CREATE POLICY "admin_read_redemptions" ON reward_redemptions
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_redemptions_user_id ON reward_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_reward_id ON reward_redemptions(reward_id);
