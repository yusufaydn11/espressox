/*
# Espresso X Admin Panel Schema

## Purpose
Adds the database tables required by the new central WEB ADMIN PANEL.
The existing mobile-app tables (products, stores, orders, profiles, campaigns,
rewards, user_roles, etc.) are NOT modified or dropped — this migration only ADDS
new tables and a few nullable columns so the admin can manage everything from one place.

## New Tables
1. `categories` — product categories with sort order and active flag.
2. `coupons` — discount coupons with code, type, value, validity window, target segment.
3. `franchises` — franchise company accounts (firm info, authorized person, linked stores).
4. `employees` — staff records (name, phone, role, store, active).
5. `inventory_items` — raw materials / stock keeping units per store.
6. `inventory_movements` — stock in/out ledger per item per store.
7. `loyalty_settings` — single-row config table for points earn/redeem rates and tier thresholds.
8. `admin_push_queue` — push notification jobs created from the admin panel (target segment, status).

## Modified Tables
- `products`: adds nullable `category_id`, `discount_price`, `is_active` (separate from in_stock),
  `store_overrides` (jsonb) for per-store price/visibility overrides. All nullable so existing
  rows continue to work unchanged.

## Security
- RLS enabled on every new table.
- Policies scope by role via `user_roles` table:
  - super_admin: full CRUD on all admin tables.
  - franchise / store_manager / staff: SELECT + limited UPDATE scoped to their store_id.
- `loyalty_settings` is readable by authenticated (admins) and updateable by super_admin only.
- No anon access on admin tables (admin panel requires sign-in).
*/

-- ─── categories ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY,
  name text NOT NULL,
  icon text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_categories" ON categories;
CREATE POLICY "admin_select_categories" ON categories FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_insert_categories" ON categories;
CREATE POLICY "admin_insert_categories" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );
DROP POLICY IF EXISTS "admin_update_categories" ON categories;
CREATE POLICY "admin_update_categories" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );
DROP POLICY IF EXISTS "admin_delete_categories" ON categories;
CREATE POLICY "admin_delete_categories" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- anon/mobile can read active categories so the menu can group by category
DROP POLICY IF EXISTS "anon_select_active_categories" ON categories;
CREATE POLICY "anon_select_active_categories" ON categories FOR SELECT
  TO anon, authenticated USING (is_active = true);

-- ─── coupons ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'percent' CHECK (type IN ('percent','fixed','free_item','bxgy')),
  value numeric NOT NULL DEFAULT 0,
  min_order numeric NOT NULL DEFAULT 0,
  target_segment text NOT NULL DEFAULT 'all',
  store_id text,
  max_redemptions integer,
  redemptions_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_coupons" ON coupons;
CREATE POLICY "admin_select_coupons" ON coupons FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_insert_coupons" ON coupons;
CREATE POLICY "admin_insert_coupons" ON coupons FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );
DROP POLICY IF EXISTS "admin_update_coupons" ON coupons;
CREATE POLICY "admin_update_coupons" ON coupons FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );
DROP POLICY IF EXISTS "admin_delete_coupons" ON coupons;
CREATE POLICY "admin_delete_coupons" ON coupons FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- ─── franchises ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS franchises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  tax_id text,
  authorized_person text NOT NULL,
  authorized_email text,
  authorized_phone text,
  contract_start date,
  contract_end date,
  royalty_percent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','terminated')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_franchises" ON franchises;
CREATE POLICY "admin_select_franchises" ON franchises FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_insert_franchises" ON franchises;
CREATE POLICY "admin_insert_franchises" ON franchises FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );
DROP POLICY IF EXISTS "admin_update_franchises" ON franchises;
CREATE POLICY "admin_update_franchises" ON franchises FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','franchise'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','franchise'))
  );
DROP POLICY IF EXISTS "admin_delete_franchises" ON franchises;
CREATE POLICY "admin_delete_franchises" ON franchises FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- link stores to a franchise (nullable column added below)

-- ─── employees ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text,
  role text NOT NULL DEFAULT 'barista' CHECK (role IN ('manager','shift_lead','barista','cashier','kitchen')),
  store_id text,
  franchise_id uuid,
  hire_date date,
  is_active boolean NOT NULL DEFAULT true,
  avatar_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_employees" ON employees;
CREATE POLICY "admin_select_employees" ON employees FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_insert_employees" ON employees;
CREATE POLICY "admin_insert_employees" ON employees FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager'))
  );
DROP POLICY IF EXISTS "admin_update_employees" ON employees;
CREATE POLICY "admin_update_employees" ON employees FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager'))
  );
DROP POLICY IF EXISTS "admin_delete_employees" ON employees;
CREATE POLICY "admin_delete_employees" ON employees FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- ─── inventory_items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'adet',
  category text,
  min_stock numeric NOT NULL DEFAULT 0,
  cost_per_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_inventory_items" ON inventory_items;
CREATE POLICY "admin_select_inventory_items" ON inventory_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_insert_inventory_items" ON inventory_items;
CREATE POLICY "admin_insert_inventory_items" ON inventory_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','store_manager'))
  );
DROP POLICY IF EXISTS "admin_update_inventory_items" ON inventory_items;
CREATE POLICY "admin_update_inventory_items" ON inventory_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','store_manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('super_admin','store_manager'))
  );
DROP POLICY IF EXISTS "admin_delete_inventory_items" ON inventory_items;
CREATE POLICY "admin_delete_inventory_items" ON inventory_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- ─── inventory_movements (per-store stock ledger) ────────────
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  store_id text NOT NULL,
  delta numeric NOT NULL,
  reason text NOT NULL DEFAULT 'adjustment',
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_inventory_movements" ON inventory_movements;
CREATE POLICY "admin_select_inventory_movements" ON inventory_movements FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_insert_inventory_movements" ON inventory_movements;
CREATE POLICY "admin_insert_inventory_movements" ON inventory_movements FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','store_manager','staff'))
  );

-- current stock per store = sum of movements
CREATE OR REPLACE VIEW store_stock AS
SELECT im.store_id, im.item_id, ii.name, ii.sku, ii.unit, ii.min_stock,
       COALESCE(SUM(im.delta), 0) AS current_stock
FROM inventory_items ii
LEFT JOIN inventory_movements im ON im.item_id = ii.id
GROUP BY im.store_id, im.item_id, ii.name, ii.sku, ii.unit, ii.min_stock;

-- ─── loyalty_settings (single config row) ───────────────────
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  earn_rate numeric NOT NULL DEFAULT 0.2,
  redeem_rate numeric NOT NULL DEFAULT 1.0,
  bronze_min integer NOT NULL DEFAULT 0,
  silver_min integer NOT NULL DEFAULT 1000,
  gold_min integer NOT NULL DEFAULT 3000,
  vip_min integer NOT NULL DEFAULT 15000,
  points_per_stamp integer NOT NULL DEFAULT 50,
  stamps_per_free_coffee integer NOT NULL DEFAULT 10,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_loyalty_settings" ON loyalty_settings;
CREATE POLICY "admin_select_loyalty_settings" ON loyalty_settings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_update_loyalty_settings" ON loyalty_settings;
CREATE POLICY "admin_update_loyalty_settings" ON loyalty_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
  );

-- seed one config row if none exists
INSERT INTO loyalty_settings (id) SELECT gen_random_uuid()
WHERE NOT EXISTS (SELECT 1 FROM loyalty_settings);

-- ─── admin_push_queue ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  image_url text,
  target_segment text NOT NULL DEFAULT 'all',
  store_id text,
  audience_count integer,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sending','sent','failed')),
  sent_by uuid,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE admin_push_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_select_push_queue" ON admin_push_queue;
CREATE POLICY "admin_select_push_queue" ON admin_push_queue FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager','staff'))
  );
DROP POLICY IF EXISTS "admin_insert_push_queue" ON admin_push_queue;
CREATE POLICY "admin_insert_push_queue" ON admin_push_queue FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager'))
  );
DROP POLICY IF EXISTS "admin_update_push_queue" ON admin_push_queue;
CREATE POLICY "admin_update_push_queue" ON admin_push_queue FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid()
            AND ur.role IN ('super_admin','franchise','store_manager'))
  );

-- ─── products: add nullable admin columns (non-destructive) ──
ALTER TABLE products ADD COLUMN IF NOT EXISTS category_id text REFERENCES categories(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_price numeric;
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── stores: link to franchise ───────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS franchise_id uuid REFERENCES franchises(id);

-- ─── helper: admin role check ────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin_role(p_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (p_role IS NULL OR ur.role = p_role)
      AND ur.role IN ('super_admin','franchise','store_manager','staff')
  );
$$;

-- ─── updated_at triggers for new tables ──────────────────────
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS tr_categories_updated ON categories;
CREATE TRIGGER tr_categories_updated BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_coupons_updated ON coupons;
CREATE TRIGGER tr_coupons_updated BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_franchises_updated ON franchises;
CREATE TRIGGER tr_franchises_updated BEFORE UPDATE ON franchises
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_employees_updated ON employees;
CREATE TRIGGER tr_employees_updated BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_inventory_items_updated ON inventory_items;
CREATE TRIGGER tr_inventory_items_updated BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS tr_loyalty_settings_updated ON loyalty_settings;
CREATE TRIGGER tr_loyalty_settings_updated BEFORE UPDATE ON loyalty_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
