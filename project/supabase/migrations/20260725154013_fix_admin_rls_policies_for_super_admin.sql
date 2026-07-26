/*
# Fix admin RLS policies to include super_admin role

## Background
The app supports two admin roles: `admin` and `super_admin` (verified by the
existing `is_admin()` helper function which checks `user_roles` for either
value). However, most RLS policies were written to check the JWT claim
`(auth.jwt() ->> 'role') = 'admin'` — an exact-string match that excludes
`super_admin`. As a result, a `super_admin` user (e.g. the project owner) can
see the admin panel UI but every write (insert/update/delete) silently fails
RLS, so they cannot add, edit, or delete stores, products, campaigns, rewards,
orders, notifications, etc.

## Changes
- Replace every `(auth.jwt() ->> 'role') = 'admin'` check with a call to the
  existing `is_admin()` SECURITY DEFINER function, which already accepts both
  `admin` and `super_admin` by reading from the `user_roles` table.
- Affected tables and policies (all admin-scoped CRUD):
  - stores: insert, update, delete (select stays public)
  - products: insert, update, delete
  - campaigns: insert, update, delete, and the admin read branch
  - rewards: insert, update, delete
  - orders: read all, update
  - order_items: read (insert already used is_admin)
  - profiles: read all, update
  - notifications: read, insert
  - loyalty_stamps: read, insert, update
  - points_history: read, insert
  - qr_codes: read
  - qr_scans: read, insert
  - reward_redemptions: read
  - user_roles: read all (already used is_admin — left as-is)

## Security
- No table structure changes. No data changes.
- RLS remains enabled on all tables.
- The policies remain as restrictive as before — the only change is the
  predicate used to identify an admin, now correctly covering both
  `admin` and `super_admin` roles via the audited `is_admin()` function.
- SELECT policies for customer-facing data (stores public read, own-data
  reads) are unchanged.

## Notes
1. `is_admin()` is `STABLE SECURITY DEFINER` with `search_path = 'public'`,
   which is safe to call from RLS policies.
2. All policy drops use `IF EXISTS` so the migration is safe to re-run if
   the apply call times out after committing.
*/

-- stores
DROP POLICY IF EXISTS "admin_insert_stores" ON stores;
CREATE POLICY "admin_insert_stores" ON stores FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_stores" ON stores;
CREATE POLICY "admin_update_stores" ON stores FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_stores" ON stores;
CREATE POLICY "admin_delete_stores" ON stores FOR DELETE
  TO authenticated USING (is_admin());

-- products
DROP POLICY IF EXISTS "admin_insert_products" ON products;
CREATE POLICY "admin_insert_products" ON products FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_products" ON products;
CREATE POLICY "admin_update_products" ON products FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_products" ON products;
CREATE POLICY "admin_delete_products" ON products FOR DELETE
  TO authenticated USING (is_admin());

-- campaigns
DROP POLICY IF EXISTS "admin_insert_campaigns" ON campaigns;
CREATE POLICY "admin_insert_campaigns" ON campaigns FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_campaigns" ON campaigns;
CREATE POLICY "admin_update_campaigns" ON campaigns FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_campaigns" ON campaigns;
CREATE POLICY "admin_delete_campaigns" ON campaigns FOR DELETE
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "read_active_campaigns" ON campaigns;
CREATE POLICY "read_active_campaigns" ON campaigns FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR is_admin());

-- rewards
DROP POLICY IF EXISTS "admin_insert_rewards" ON rewards;
CREATE POLICY "admin_insert_rewards" ON rewards FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_rewards" ON rewards;
CREATE POLICY "admin_update_rewards" ON rewards FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_delete_rewards" ON rewards;
CREATE POLICY "admin_delete_rewards" ON rewards FOR DELETE
  TO authenticated USING (is_admin());

-- orders
DROP POLICY IF EXISTS "admin_read_all_orders" ON orders;
CREATE POLICY "admin_read_all_orders" ON orders FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_update_orders" ON orders;
CREATE POLICY "admin_update_orders" ON orders FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- order_items
DROP POLICY IF EXISTS "admin_read_order_items" ON order_items;
CREATE POLICY "admin_read_order_items" ON order_items FOR SELECT
  TO authenticated USING (is_admin());

-- profiles
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
CREATE POLICY "admin_read_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
CREATE POLICY "admin_update_profiles" ON profiles FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- notifications
DROP POLICY IF EXISTS "admin_read_notifications" ON notifications;
CREATE POLICY "admin_read_notifications" ON notifications FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_notifications" ON notifications;
CREATE POLICY "admin_insert_notifications" ON notifications FOR INSERT
  TO authenticated WITH CHECK (is_admin());

-- loyalty_stamps
DROP POLICY IF EXISTS "admin_read_stamps" ON loyalty_stamps;
CREATE POLICY "admin_read_stamps" ON loyalty_stamps FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_stamps" ON loyalty_stamps;
CREATE POLICY "admin_insert_stamps" ON loyalty_stamps FOR INSERT
  TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "admin_update_stamps" ON loyalty_stamps;
CREATE POLICY "admin_update_stamps" ON loyalty_stamps FOR UPDATE
  TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- points_history
DROP POLICY IF EXISTS "admin_read_points_history" ON points_history;
CREATE POLICY "admin_read_points_history" ON points_history FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_points_history" ON points_history;
CREATE POLICY "admin_insert_points_history" ON points_history FOR INSERT
  TO authenticated WITH CHECK (is_admin());

-- qr_codes
DROP POLICY IF EXISTS "admin_read_qr_codes" ON qr_codes;
CREATE POLICY "admin_read_qr_codes" ON qr_codes FOR SELECT
  TO authenticated USING (is_admin());

-- qr_scans
DROP POLICY IF EXISTS "admin_read_scans" ON qr_scans;
CREATE POLICY "admin_read_scans" ON qr_scans FOR SELECT
  TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "admin_insert_scans" ON qr_scans;
CREATE POLICY "admin_insert_scans" ON qr_scans FOR INSERT
  TO authenticated WITH CHECK (is_admin());

-- reward_redemptions
DROP POLICY IF EXISTS "admin_read_redemptions" ON reward_redemptions;
CREATE POLICY "admin_read_redemptions" ON reward_redemptions FOR SELECT
  TO authenticated USING (is_admin());
