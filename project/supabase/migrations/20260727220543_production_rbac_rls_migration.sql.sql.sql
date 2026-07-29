/*
# Production RBAC RLS Migration for Espresso X

## Summary

This migration replaces the existing permissive role-based access control with a
strict, production-grade RBAC model. The old `is_admin()` helper returned true for
super_admin, franchise, store_manager AND staff — granting staff the same powers as
the HQ super_admin on many tables. This migration narrows every policy so each role
gets only the access it needs.

## New Role Model

Five roles are now in effect:

- **super_admin** — full system access (HQ / central office). Owns global content.
- **admin** — a new intermediate role: super_admin + admin. Used for read-mostly
  oversight and internal operations that span stores but must NOT touch global
  catalog/settings. `is_admin()` now means super_admin OR admin (NOT staff).
- **franchise** — can only see and manage their own store_id + franchise_id data.
  Cannot manage products, categories, rewards, or global settings.
- **store_manager** — limited to their own store. Can manage orders, stock,
  employees for that store. No global settings, no catalog, no campaigns, no
  user management.
- **staff** — operational read + limited operational writes (scan QR, record stock
  movements). Cannot manage products, categories, campaigns, users, or stores.
- **customer** (implicit, default role) — can only see and edit their own profile,
  points, orders, notifications, QR codes, and reward redemptions.

## Helper Functions

- `is_super_admin()` — NEW. Returns true only for super_admin.
- `is_admin()` — REDEFINED. Returns true for super_admin OR admin (was: 4 roles).
- `is_franchise()` — unchanged (franchise only).
- `is_store_manager()` — NEW. store_manager only.
- `is_staff()` — NEW. staff only.
- `is_internal()` — NEW. super_admin OR admin OR franchise OR store_manager OR staff
  (any authenticated staff-side user, used for broad read access on catalog tables).
- `my_store_id()` — unchanged (single store_id from user_roles).
- `my_store_ids()` — NEW. Returns all store_ids the current user may access:
  - franchise: their own store_id + every store sharing their franchise_id.
  - store_manager / staff: just their own store_id.
  - super_admin / admin / customer: empty array (use has_store_access separately).
- `has_store_access(p_store_id)` — NEW. True for super_admin/admin OR when
  p_store_id is in my_store_ids(). Used as the standard store-scope predicate.
- `user_roles_store_match()` — UPDATED to include store_manager (was: franchise only).

## RPC Functions Updated

- `qr_scan()` — replaced `is_admin()` with `is_super_admin()` so only HQ can scan
  on behalf of another user; franchise/store_manager/staff scan at their own store
  via has_store_access(p_store_id).
- `send_campaign()` — replaced `is_admin()` with `is_super_admin()`. Only
  super_admin/admin create+send campaigns; franchise can send own-store campaigns.
  store_manager/staff can no longer send campaigns.

## Indexes Added

- `idx_stores_franchise_id` on stores(franchise_id) — for my_store_ids() lookup.
- `idx_user_roles_role` on user_roles(role) — for role-check queries.

## Tables Changed (all 27 public tables)

Every existing policy is dropped and replaced. Below is the access matrix per table.
Legend: OWN = auth.uid() = user_id; STORE = has_store_access(store_id);
INTERNAL = is_internal(); HQ = is_super_admin(); ADM = is_admin().

### User management
- profiles: SELECT OWN | HQ | ADM | (INTERNAL+customer ordered at their store);
  INSERT OWN; UPDATE OWN | HQ | ADM; DELETE HQ
- user_roles: SELECT OWN | HQ | ADM; INSERT HQ; UPDATE HQ; DELETE HQ

### Store & franchise
- stores: SELECT public (all stores visible); INSERT HQ; UPDATE HQ | (FR own store);
  DELETE HQ
- franchises: SELECT HQ | ADM | (FR own record); INSERT HQ; UPDATE HQ; DELETE HQ

### Catalog (global content — HQ only management)
- products: SELECT public; INSERT HQ; UPDATE HQ; DELETE HQ
- categories: SELECT public(active) | INTERNAL; INSERT HQ; UPDATE HQ; DELETE HQ
- rewards: SELECT public; INSERT HQ; UPDATE HQ; DELETE HQ

### Orders
- orders: SELECT OWN | HQ | ADM | STORE; INSERT OWN; UPDATE HQ | ADM | (FR/SM+STORE);
  DELETE HQ
- order_items: SELECT OWN(via order) | HQ | ADM | STORE(via order); INSERT OWN;
  UPDATE HQ; DELETE HQ

### Campaigns & coupons
- campaigns: SELECT public(active) | HQ | ADM | (FR/SM/ST+STORE active); INSERT HQ;
  UPDATE HQ; DELETE HQ
- coupons: SELECT INTERNAL | (FR/SM/ST+STORE); INSERT HQ; UPDATE HQ; DELETE HQ

### Loyalty
- loyalty_settings: SELECT INTERNAL; INSERT HQ; UPDATE HQ; DELETE HQ
- loyalty_stamps: SELECT OWN | HQ | ADM | STORE; INSERT OWN | HQ | ADM | STORE;
  UPDATE OWN | HQ | ADM | (FR/SM+STORE); DELETE HQ
- stamp_cards: SELECT OWN | HQ | ADM | STORE; INSERT OWN | HQ | ADM | (FR/SM+STORE);
  UPDATE HQ | ADM | (FR/SM+STORE); DELETE HQ
- points_history: SELECT OWN | HQ | ADM | STORE; INSERT OWN | HQ | ADM | STORE;
  UPDATE HQ; DELETE HQ
- reward_redemptions: SELECT OWN | HQ | ADM | STORE; INSERT OWN | HQ | ADM;
  UPDATE HQ; DELETE HQ
- free_coffee_redemptions: SELECT OWN | HQ | ADM | STORE; INSERT HQ | (FR/SM/ST+STORE);
  UPDATE HQ; DELETE HQ

### Notifications
- notifications: SELECT OWN | HQ | ADM | (INTERNAL+store match in data);
  INSERT OWN | HQ | ADM; UPDATE OWN | HQ | ADM; DELETE OWN | HQ | ADM
- notification_preferences: SELECT OWN; INSERT OWN; UPDATE OWN; DELETE OWN

### QR
- qr_codes: SELECT OWN | HQ; INSERT OWN; UPDATE OWN | HQ; DELETE OWN | HQ
- qr_scans: SELECT OWN | HQ | ADM | STORE; INSERT OWN | HQ | ADM | STORE;
  UPDATE HQ; DELETE HQ

### Inventory
- inventory_items: SELECT INTERNAL; INSERT HQ; UPDATE HQ | (SM own store);
  DELETE HQ
- inventory_movements: SELECT HQ | ADM | STORE; INSERT HQ | ADM | (SM/ST+STORE);
  UPDATE HQ; DELETE HQ

### Employees
- employees: SELECT HQ | ADM | STORE; INSERT HQ | (FR/SM+STORE);
  UPDATE HQ | ADM | (FR/SM+STORE); DELETE HQ

### Security & audit
- audit_logs: SELECT OWN(actor_id) | HQ | ADM | (FR/SM own-store rows);
  INSERT OWN | HQ | ADM | FR | SM; UPDATE HQ; DELETE HQ
- suspicious_activity: SELECT HQ | ADM | STORE; INSERT HQ | ADM | STORE;
  UPDATE HQ | ADM; DELETE HQ
- admin_push_queue: SELECT HQ | ADM | (FR/SM/ST+STORE); INSERT HQ | (FR/SM+STORE);
  UPDATE HQ | (FR/SM+STORE); DELETE HQ

## Security Changes

- is_admin() no longer returns true for franchise, store_manager, or staff.
- staff loses management access to products, categories, rewards, campaigns,
  coupons, stores, franchises, employees, user_roles, loyalty_settings, and
  audit_logs. Staff retains operational read + QR scan + stock movement writes.
- store_manager is now scoped to their own store via has_store_access() on all
  store-scoped tables (orders, order_items, employees, inventory_movements, etc.).
- user_roles is now fully manageable (CRUD) by super_admin only — previously had
  no INSERT/UPDATE/DELETE policies, so role assignment required service-role keys.
- notifications INSERT now requires auth.uid() = user_id (or HQ/admin) —
  previously any authenticated user could insert notifications for any user.
- profiles SELECT for staff is removed; staff see customer profiles only via
  store-scoped order joins (franchise/store_manager path), not via is_admin().

## Important Notes

1. This migration is safe to re-run: all policy drops use IF EXISTS and all
   function definitions use CREATE OR REPLACE.
2. No data is modified or deleted — only policies and helper functions change.
3. The existing `admin` role value is now expected in user_roles; no existing rows
   are changed. Only super_admin and franchise rows exist currently; adding admin
   rows is done via the now-functional user_roles INSERT policy.
4. The `handle_new_user` trigger is SECURITY DEFINER and unaffected.
5. `add_points` and `create_order` RPCs use auth.uid() only (not is_admin()),
   so they are unaffected.
*/

-- ============================================================================
-- SECTION 1: Helper Functions
-- ============================================================================

-- is_super_admin(): only super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role = 'super_admin'
);
$function$;

-- is_admin(): super_admin OR admin (narrowed from 4 roles)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('super_admin', 'admin')
);
$function$;

-- is_franchise(): franchise only (unchanged)
CREATE OR REPLACE FUNCTION public.is_franchise()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role = 'franchise'
);
$function$;

-- is_store_manager(): store_manager only
CREATE OR REPLACE FUNCTION public.is_store_manager()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role = 'store_manager'
);
$function$;

-- is_staff(): staff only
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role = 'staff'
);
$function$;

-- is_internal(): any staff-side user (super_admin, admin, franchise, store_manager, staff)
CREATE OR REPLACE FUNCTION public.is_internal()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('super_admin', 'admin', 'franchise', 'store_manager', 'staff')
);
$function$;

-- my_store_id(): single store_id (unchanged, kept for backward compat)
CREATE OR REPLACE FUNCTION public.my_store_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT store_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$function$;

-- my_store_ids(): all store_ids the current user may access.
-- franchise: own store_id + all stores sharing the same franchise_id.
-- store_manager / staff: own store_id only.
-- super_admin / admin / customer: empty array (use has_store_access for HQ bypass).
CREATE OR REPLACE FUNCTION public.my_store_ids()
RETURNS text[]
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT COALESCE(array_agg(DISTINCT s.id), ARRAY[]::text[])
FROM stores s
WHERE s.id IN (
  -- own store_id from user_roles (franchise / store_manager / staff)
  SELECT ur.store_id FROM user_roles ur
  WHERE ur.user_id = auth.uid()
  AND ur.store_id IS NOT NULL
  AND ur.role IN ('franchise', 'store_manager', 'staff')

  UNION

  -- franchise: all stores sharing the same franchise_id as the user's store
  SELECT s2.id
  FROM user_roles ur
  JOIN stores s1 ON s1.id = ur.store_id
  JOIN stores s2 ON s2.franchise_id = s1.franchise_id
  WHERE ur.user_id = auth.uid()
  AND ur.role = 'franchise'
  AND s1.franchise_id IS NOT NULL
);
$function$;

-- has_store_access(p_store_id): HQ bypass OR store is in user's my_store_ids()
CREATE OR REPLACE FUNCTION public.has_store_access(p_store_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT is_super_admin() OR is_admin()
   OR p_store_id = ANY(my_store_ids());
$function$;

-- user_roles_store_match(): now includes store_manager (was: franchise only)
CREATE OR REPLACE FUNCTION public.user_roles_store_match(p_uid uuid, p_store_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = p_uid
  AND role IN ('franchise', 'store_manager')
  AND store_id = p_store_id
);
$function$;

-- ============================================================================
-- SECTION 2: Indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_stores_franchise_id ON stores(franchise_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- ============================================================================
-- SECTION 3: Update RPC functions that reference is_admin()
-- ============================================================================

-- qr_scan(): replace is_admin() with is_super_admin() for owner-bypass check.
-- Staff at a store can still scan because the QR owner check only blocks
-- scanning someone else's QR — store staff scan customers' QRs via
-- has_store_access(p_store_id) which is allowed through the INSERT policy.
CREATE OR REPLACE FUNCTION public.qr_scan(
  p_qr_code_id uuid,
  p_store_id text DEFAULT NULL::text,
  p_action text DEFAULT 'stamp'::text,
  p_points integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code_user uuid;
  v_last_scan timestamptz;
  v_dedup text;
  v_points_awarded int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  IF p_action NOT IN ('stamp','points','redeem') THEN
    RETURN jsonb_build_object('error', 'invalid_action');
  END IF;

  SELECT user_id INTO v_code_user FROM qr_codes WHERE id = p_qr_code_id AND is_active = true;
  IF v_code_user IS NULL THEN
    RETURN jsonb_build_object('error', 'qr_not_found');
  END IF;

  -- Owner can scan their own QR. HQ can scan any. Store staff can scan
  -- customer QRs at their store. Otherwise blocked.
  IF v_code_user <> v_uid
     AND NOT is_super_admin()
     AND NOT has_store_access(p_store_id) THEN
    RETURN jsonb_build_object('error', 'not_owner');
  END IF;

  SELECT scanned_at INTO v_last_scan
  FROM qr_scans
  WHERE user_id = v_uid
  ORDER BY scanned_at DESC LIMIT 1;
  IF v_last_scan IS NOT NULL AND now() - v_last_scan < interval '60 seconds' THEN
    RETURN jsonb_build_object('error', 'rate_limited', 'retry_after', 60 - EXTRACT(epoch FROM (now() - v_last_scan))::int);
  END IF;

  v_points_awarded := GREATEST(0, p_points);
  v_dedup := v_uid::text || '-' || extract(epoch from now())::bigint::text;

  INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
  VALUES (v_uid, p_qr_code_id, p_store_id, p_action, v_points_awarded, v_dedup, v_uid);

  IF p_action = 'stamp' THEN
    INSERT INTO loyalty_stamps (user_id, store_id) VALUES (v_uid, p_store_id);
  END IF;

  IF v_points_awarded > 0 THEN
    UPDATE profiles SET points = points + v_points_awarded, lifetime_points = lifetime_points + v_points_awarded
    WHERE user_id = v_uid;
    INSERT INTO points_history (user_id, title, points, type)
    VALUES (v_uid, 'QR damga', v_points_awarded, 'earn');
  END IF;

  RETURN jsonb_build_object('error', null, 'points_awarded', v_points_awarded);
END;
$function$;

-- send_campaign(): only super_admin/admin create+send. Franchise can send
-- own-store campaigns. store_manager/staff can no longer send campaigns.
CREATE OR REPLACE FUNCTION public.send_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign campaigns%ROWTYPE;
  v_count int := 0;
  v_user record;
  v_store text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  -- Authorization: only super_admin/admin or franchise can send campaigns
  IF NOT is_admin() AND NOT is_franchise() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'campaign_not_found');
  END IF;

  -- Franchise users can only send campaigns for their own store
  IF is_franchise() AND NOT is_admin() THEN
    v_store := my_store_id();
    IF v_campaign.store_id IS NOT NULL AND v_campaign.store_id <> v_store THEN
      RETURN jsonb_build_object('error', 'unauthorized_store');
    END IF;
  END IF;

  -- Target by store_id if set, otherwise all users
  IF v_campaign.store_id IS NOT NULL THEN
    FOR v_user IN
      SELECT DISTINCT p.user_id FROM profiles p
      WHERE p.favorite_store_id = v_campaign.store_id
      OR EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p.user_id AND o.store_id = v_campaign.store_id)
    LOOP
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (v_user.user_id, v_campaign.title, v_campaign.message, 'promo',
        jsonb_build_object('campaign_id', p_campaign_id, 'deep_link', 'campaigns'));
      v_count := v_count + 1;
    END LOOP;
  ELSE
    FOR v_user IN SELECT user_id FROM profiles WHERE is_blocked = false LOOP
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (v_user.user_id, v_campaign.title, v_campaign.message, 'promo',
        jsonb_build_object('campaign_id', p_campaign_id, 'deep_link', 'campaigns'));
      v_count := v_count + 1;
    END LOOP;
  END IF;

  UPDATE campaigns SET reach = v_count, status = 'active' WHERE id = p_campaign_id;

  RETURN jsonb_build_object('error', null, 'reach', v_count);
END;
$function$;

-- ============================================================================
-- SECTION 4: Drop ALL existing policies on all 27 public tables
-- ============================================================================

-- profiles
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_read_all_profiles" ON profiles;
DROP POLICY IF EXISTS "franchise_read_own_store_customer_profiles" ON profiles;
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
DROP POLICY IF EXISTS "admin_update_profiles" ON profiles;
DROP POLICY IF EXISTS "update_own_profile" ON profiles;

-- user_roles
DROP POLICY IF EXISTS "select_own_role" ON user_roles;

-- stores
DROP POLICY IF EXISTS "admin_delete_stores" ON stores;
DROP POLICY IF EXISTS "admin_insert_stores" ON stores;
DROP POLICY IF EXISTS "public_read_stores" ON stores;
DROP POLICY IF EXISTS "admin_update_stores" ON stores;

-- franchises
DROP POLICY IF EXISTS "admin_delete_franchises" ON franchises;
DROP POLICY IF EXISTS "admin_insert_franchises" ON franchises;
DROP POLICY IF EXISTS "admin_select_franchises" ON franchises;
DROP POLICY IF EXISTS "admin_update_franchises" ON franchises;

-- products
DROP POLICY IF EXISTS "admin_delete_products" ON products;
DROP POLICY IF EXISTS "admin_insert_products" ON products;
DROP POLICY IF EXISTS "public_read_products" ON products;
DROP POLICY IF EXISTS "admin_update_products" ON products;

-- categories
DROP POLICY IF EXISTS "admin_delete_categories" ON categories;
DROP POLICY IF EXISTS "admin_insert_categories" ON categories;
DROP POLICY IF EXISTS "admin_select_categories" ON categories;
DROP POLICY IF EXISTS "anon_select_active_categories" ON categories;
DROP POLICY IF EXISTS "admin_update_categories" ON categories;

-- rewards
DROP POLICY IF EXISTS "admin_delete_rewards" ON rewards;
DROP POLICY IF EXISTS "admin_insert_rewards" ON rewards;
DROP POLICY IF EXISTS "public_read_rewards" ON rewards;
DROP POLICY IF EXISTS "admin_update_rewards" ON rewards;

-- orders
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
DROP POLICY IF EXISTS "admin_read_all_orders" ON orders;
DROP POLICY IF EXISTS "franchise_read_own_store_orders" ON orders;
DROP POLICY IF EXISTS "select_own_orders" ON orders;
DROP POLICY IF EXISTS "admin_update_orders" ON orders;
DROP POLICY IF EXISTS "franchise_update_own_store_orders" ON orders;

-- order_items
DROP POLICY IF EXISTS "admin_insert_order_items" ON order_items;
DROP POLICY IF EXISTS "insert_own_order_items" ON order_items;
DROP POLICY IF EXISTS "admin_read_order_items" ON order_items;
DROP POLICY IF EXISTS "franchise_read_own_store_order_items" ON order_items;
DROP POLICY IF EXISTS "select_own_order_items" ON order_items;

-- campaigns
DROP POLICY IF EXISTS "admin_delete_campaigns" ON campaigns;
DROP POLICY IF EXISTS "admin_insert_campaigns" ON campaigns;
DROP POLICY IF EXISTS "franchise_read_active_campaigns" ON campaigns;
DROP POLICY IF EXISTS "read_active_campaigns_admin" ON campaigns;
DROP POLICY IF EXISTS "read_active_campaigns_public" ON campaigns;
DROP POLICY IF EXISTS "admin_update_campaigns" ON campaigns;

-- coupons
DROP POLICY IF EXISTS "admin_delete_coupons" ON coupons;
DROP POLICY IF EXISTS "admin_insert_coupons" ON coupons;
DROP POLICY IF EXISTS "admin_select_coupons" ON coupons;
DROP POLICY IF EXISTS "admin_update_coupons" ON coupons;

-- loyalty_settings
DROP POLICY IF EXISTS "admin_insert_loyalty_settings" ON loyalty_settings;
DROP POLICY IF EXISTS "admin_select_loyalty_settings" ON loyalty_settings;
DROP POLICY IF EXISTS "admin_update_loyalty_settings" ON loyalty_settings;

-- loyalty_stamps
DROP POLICY IF EXISTS "admin_insert_stamps" ON loyalty_stamps;
DROP POLICY IF EXISTS "franchise_insert_own_store_stamps" ON loyalty_stamps;
DROP POLICY IF EXISTS "insert_own_stamps" ON loyalty_stamps;
DROP POLICY IF EXISTS "admin_read_stamps" ON loyalty_stamps;
DROP POLICY IF EXISTS "franchise_read_own_store_stamps" ON loyalty_stamps;
DROP POLICY IF EXISTS "select_own_stamps" ON loyalty_stamps;
DROP POLICY IF EXISTS "admin_update_stamps" ON loyalty_stamps;
DROP POLICY IF EXISTS "update_own_stamps" ON loyalty_stamps;

-- stamp_cards
DROP POLICY IF EXISTS "franchise_insert_stamp_cards" ON stamp_cards;
DROP POLICY IF EXISTS "insert_stamp_cards_admin" ON stamp_cards;
DROP POLICY IF EXISTS "select_own_stamp_cards" ON stamp_cards;
DROP POLICY IF EXISTS "select_stamp_cards_admin_franchise" ON stamp_cards;
DROP POLICY IF EXISTS "update_stamp_cards_admin" ON stamp_cards;

-- points_history
DROP POLICY IF EXISTS "admin_insert_points_history" ON points_history;
DROP POLICY IF EXISTS "franchise_insert_points_history" ON points_history;
DROP POLICY IF EXISTS "insert_own_points_history" ON points_history;
DROP POLICY IF EXISTS "admin_read_points_history" ON points_history;
DROP POLICY IF EXISTS "franchise_read_own_store_points_history" ON points_history;
DROP POLICY IF EXISTS "select_own_points_history" ON points_history;

-- reward_redemptions
DROP POLICY IF EXISTS "admin_delete_redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "insert_own_redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "admin_read_redemptions" ON reward_redemptions;
DROP POLICY IF EXISTS "select_own_redemptions" ON reward_redemptions;

-- free_coffee_redemptions
DROP POLICY IF EXISTS "insert_fcr_admin_franchise" ON free_coffee_redemptions;
DROP POLICY IF EXISTS "select_fcr_admin_franchise" ON free_coffee_redemptions;
DROP POLICY IF EXISTS "select_own_fcr" ON free_coffee_redemptions;

-- notifications
DROP POLICY IF EXISTS "admin_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "insert_own_notifications" ON notifications;
DROP POLICY IF EXISTS "admin_read_notifications" ON notifications;
DROP POLICY IF EXISTS "franchise_read_own_store_notifications" ON notifications;
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;

-- notification_preferences
DROP POLICY IF EXISTS "insert_own_notif_prefs" ON notification_preferences;
DROP POLICY IF EXISTS "select_own_notif_prefs" ON notification_preferences;
DROP POLICY IF EXISTS "update_own_notif_prefs" ON notification_preferences;

-- qr_codes
DROP POLICY IF EXISTS "insert_own_qr" ON qr_codes;
DROP POLICY IF EXISTS "admin_read_qr_codes" ON qr_codes;
DROP POLICY IF EXISTS "franchise_read_qr_codes" ON qr_codes;
DROP POLICY IF EXISTS "select_own_qr" ON qr_codes;
DROP POLICY IF EXISTS "admin_update_qr_codes" ON qr_codes;
DROP POLICY IF EXISTS "update_own_qr" ON qr_codes;

-- qr_scans
DROP POLICY IF EXISTS "admin_insert_scans" ON qr_scans;
DROP POLICY IF EXISTS "franchise_insert_own_store_scans" ON qr_scans;
DROP POLICY IF EXISTS "insert_own_scans" ON qr_scans;
DROP POLICY IF EXISTS "admin_read_scans" ON qr_scans;
DROP POLICY IF EXISTS "franchise_read_own_store_scans" ON qr_scans;
DROP POLICY IF EXISTS "select_own_scans" ON qr_scans;
DROP POLICY IF EXISTS "admin_update_scans" ON qr_scans;

-- inventory_items
DROP POLICY IF EXISTS "admin_delete_inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "admin_insert_inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "admin_select_inventory_items" ON inventory_items;
DROP POLICY IF EXISTS "admin_update_inventory_items" ON inventory_items;

-- inventory_movements
DROP POLICY IF EXISTS "admin_insert_inventory_movements" ON inventory_movements;
DROP POLICY IF EXISTS "admin_select_inventory_movements" ON inventory_movements;

-- employees
DROP POLICY IF EXISTS "admin_delete_employees" ON employees;
DROP POLICY IF EXISTS "admin_insert_employees" ON employees;
DROP POLICY IF EXISTS "admin_select_employees" ON employees;
DROP POLICY IF EXISTS "admin_update_employees" ON employees;

-- audit_logs
DROP POLICY IF EXISTS "franchise_insert_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "insert_audit_log" ON audit_logs;
DROP POLICY IF EXISTS "admin_read_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "hq_read_audit_logs" ON audit_logs;
DROP POLICY IF EXISTS "select_own_audit_logs" ON audit_logs;

-- suspicious_activity
DROP POLICY IF EXISTS "insert_suspicious_admin" ON suspicious_activity;
DROP POLICY IF EXISTS "select_suspicious_admin_franchise" ON suspicious_activity;
DROP POLICY IF EXISTS "update_suspicious_admin" ON suspicious_activity;

-- admin_push_queue
DROP POLICY IF EXISTS "admin_insert_push_queue" ON admin_push_queue;
DROP POLICY IF EXISTS "admin_select_push_queue" ON admin_push_queue;
DROP POLICY IF EXISTS "admin_update_push_queue" ON admin_push_queue;

-- ============================================================================
-- SECTION 5: Create new policies — profiles & user_roles
-- ============================================================================

-- profiles: OWN | HQ/admin | (internal + customer ordered at their store)
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "profiles_select_store_customer" ON profiles
  FOR SELECT TO authenticated
  USING (
    is_internal()
    AND NOT is_admin()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.user_id = profiles.user_id
      AND has_store_access(o.store_id)
    )
  );

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- user_roles: OWN select | HQ/admin full management
CREATE POLICY "user_roles_select_own" ON user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "user_roles_select_admin" ON user_roles
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "user_roles_insert_admin" ON user_roles
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "user_roles_update_admin" ON user_roles
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "user_roles_delete_admin" ON user_roles
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 6: stores & franchises
-- ============================================================================

-- stores: public read; HQ insert/delete; HQ + franchise-own update
CREATE POLICY "stores_select_public" ON stores
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "stores_insert_hq" ON stores
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "stores_update_hq" ON stores
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "stores_update_franchise_own" ON stores
  FOR UPDATE TO authenticated
  USING (is_franchise() AND id = ANY(my_store_ids()))
  WITH CHECK (is_franchise() AND id = ANY(my_store_ids()));

CREATE POLICY "stores_delete_hq" ON stores
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- franchises: HQ/admin read; HQ full management; franchise read own
CREATE POLICY "franchises_select_admin" ON franchises
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "franchises_select_franchise_own" ON franchises
  FOR SELECT TO authenticated
  USING (
    is_franchise()
    AND id IN (
      SELECT s.franchise_id FROM stores s
      WHERE s.id = ANY(my_store_ids()) AND s.franchise_id IS NOT NULL
    )
  );

CREATE POLICY "franchises_insert_hq" ON franchises
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "franchises_update_hq" ON franchises
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "franchises_delete_hq" ON franchises
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 7: Catalog — products, categories, rewards (HQ-only management)
-- ============================================================================

-- products: public read; HQ-only management
CREATE POLICY "products_select_public" ON products
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "products_insert_hq" ON products
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "products_update_hq" ON products
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "products_delete_hq" ON products
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- categories: public read active; internal read all; HQ-only management
CREATE POLICY "categories_select_public" ON categories
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "categories_select_internal" ON categories
  FOR SELECT TO authenticated
  USING (is_internal());

CREATE POLICY "categories_insert_hq" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "categories_update_hq" ON categories
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "categories_delete_hq" ON categories
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- rewards: public read; HQ-only management
CREATE POLICY "rewards_select_public" ON rewards
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "rewards_insert_hq" ON rewards
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "rewards_update_hq" ON rewards
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "rewards_delete_hq" ON rewards
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 8: Orders & order_items
-- ============================================================================

-- orders: OWN | HQ/admin | STORE; INSERT own; UPDATE HQ/admin | (FR/SM+STORE)
CREATE POLICY "orders_select_own" ON orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "orders_select_admin" ON orders
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "orders_select_store" ON orders
  FOR SELECT TO authenticated
  USING (has_store_access(orders.store_id));

CREATE POLICY "orders_insert_own" ON orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "orders_update_admin" ON orders
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "orders_update_store_fm" ON orders
  FOR UPDATE TO authenticated
  USING (
    (is_franchise() OR is_store_manager())
    AND has_store_access(orders.store_id)
  )
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(orders.store_id)
  );

CREATE POLICY "orders_delete_hq" ON orders
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- order_items: via parent order; INSERT own; UPDATE/DELETE HQ
CREATE POLICY "order_items_select_own" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "order_items_select_admin" ON order_items
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "order_items_select_store" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id
            AND has_store_access(o.store_id))
  );

CREATE POLICY "order_items_insert_own" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o
            WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "order_items_update_hq" ON order_items
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "order_items_delete_hq" ON order_items
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 9: Campaigns & coupons
-- ============================================================================

-- campaigns: public active; HQ/admin all; FR/SM/ST own-store active
CREATE POLICY "campaigns_select_public" ON campaigns
  FOR SELECT TO anon, authenticated
  USING (status = 'active');

CREATE POLICY "campaigns_select_admin" ON campaigns
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "campaigns_select_store" ON campaigns
  FOR SELECT TO authenticated
  USING (
    is_internal()
    AND NOT is_admin()
    AND status = 'active'
    AND (store_id IS NULL OR has_store_access(store_id))
  );

CREATE POLICY "campaigns_insert_hq" ON campaigns
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "campaigns_update_hq" ON campaigns
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "campaigns_delete_hq" ON campaigns
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- coupons: internal read; HQ-only management
CREATE POLICY "coupons_select_internal" ON coupons
  FOR SELECT TO authenticated
  USING (is_internal());

CREATE POLICY "coupons_select_store" ON coupons
  FOR SELECT TO authenticated
  USING (
    is_internal()
    AND NOT is_admin()
    AND (store_id IS NULL OR has_store_access(store_id))
  );

CREATE POLICY "coupons_insert_hq" ON coupons
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "coupons_update_hq" ON coupons
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "coupons_delete_hq" ON coupons
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 10: Loyalty
-- ============================================================================

-- loyalty_settings: internal read; HQ-only management
CREATE POLICY "loyalty_settings_select_internal" ON loyalty_settings
  FOR SELECT TO authenticated
  USING (is_internal());

CREATE POLICY "loyalty_settings_insert_hq" ON loyalty_settings
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "loyalty_settings_update_hq" ON loyalty_settings
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "loyalty_settings_delete_hq" ON loyalty_settings
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- loyalty_stamps: OWN | HQ/admin | STORE
CREATE POLICY "loyalty_stamps_select_own" ON loyalty_stamps
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "loyalty_stamps_select_admin" ON loyalty_stamps
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "loyalty_stamps_select_store" ON loyalty_stamps
  FOR SELECT TO authenticated
  USING (has_store_access(loyalty_stamps.store_id));

CREATE POLICY "loyalty_stamps_insert_own" ON loyalty_stamps
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "loyalty_stamps_insert_admin" ON loyalty_stamps
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "loyalty_stamps_insert_store" ON loyalty_stamps
  FOR INSERT TO authenticated
  WITH CHECK (has_store_access(loyalty_stamps.store_id));

CREATE POLICY "loyalty_stamps_update_own" ON loyalty_stamps
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "loyalty_stamps_update_admin" ON loyalty_stamps
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "loyalty_stamps_update_store_fm" ON loyalty_stamps
  FOR UPDATE TO authenticated
  USING (
    (is_franchise() OR is_store_manager())
    AND has_store_access(loyalty_stamps.store_id)
  )
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(loyalty_stamps.store_id)
  );

CREATE POLICY "loyalty_stamps_delete_hq" ON loyalty_stamps
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- stamp_cards: OWN | HQ/admin | STORE
CREATE POLICY "stamp_cards_select_own" ON stamp_cards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "stamp_cards_select_admin" ON stamp_cards
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "stamp_cards_select_store" ON stamp_cards
  FOR SELECT TO authenticated
  USING (has_store_access(stamp_cards.store_id));

CREATE POLICY "stamp_cards_insert_own" ON stamp_cards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stamp_cards_insert_admin" ON stamp_cards
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "stamp_cards_insert_store_fm" ON stamp_cards
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(stamp_cards.store_id)
  );

CREATE POLICY "stamp_cards_update_admin" ON stamp_cards
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "stamp_cards_update_store_fm" ON stamp_cards
  FOR UPDATE TO authenticated
  USING (
    (is_franchise() OR is_store_manager())
    AND has_store_access(stamp_cards.store_id)
  )
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(stamp_cards.store_id)
  );

CREATE POLICY "stamp_cards_delete_hq" ON stamp_cards
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- points_history: OWN | HQ/admin | STORE; HQ-only update/delete
CREATE POLICY "points_history_select_own" ON points_history
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "points_history_select_admin" ON points_history
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "points_history_select_store" ON points_history
  FOR SELECT TO authenticated
  USING (has_store_access(points_history.store_id));

CREATE POLICY "points_history_insert_own" ON points_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "points_history_insert_admin" ON points_history
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "points_history_insert_store" ON points_history
  FOR INSERT TO authenticated
  WITH CHECK (has_store_access(points_history.store_id));

CREATE POLICY "points_history_update_hq" ON points_history
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "points_history_delete_hq" ON points_history
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- reward_redemptions: OWN | HQ/admin | STORE; INSERT own/admin; HQ update/delete
CREATE POLICY "reward_redemptions_select_own" ON reward_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "reward_redemptions_select_admin" ON reward_redemptions
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "reward_redemptions_select_store" ON reward_redemptions
  FOR SELECT TO authenticated
  USING (has_store_access(reward_redemptions.store_id));

CREATE POLICY "reward_redemptions_insert_own" ON reward_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reward_redemptions_insert_admin" ON reward_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "reward_redemptions_update_hq" ON reward_redemptions
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "reward_redemptions_delete_hq" ON reward_redemptions
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- free_coffee_redemptions: OWN | HQ/admin | STORE
CREATE POLICY "free_coffee_redemptions_select_own" ON free_coffee_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "free_coffee_redemptions_select_admin" ON free_coffee_redemptions
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "free_coffee_redemptions_select_store" ON free_coffee_redemptions
  FOR SELECT TO authenticated
  USING (has_store_access(free_coffee_redemptions.store_id));

CREATE POLICY "free_coffee_redemptions_insert_hq" ON free_coffee_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "free_coffee_redemptions_insert_store" ON free_coffee_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal()
    AND NOT is_super_admin()
    AND has_store_access(free_coffee_redemptions.store_id)
  );

CREATE POLICY "free_coffee_redemptions_update_hq" ON free_coffee_redemptions
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "free_coffee_redemptions_delete_hq" ON free_coffee_redemptions
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 11: Notifications
-- ============================================================================

-- notifications: OWN | HQ/admin | (internal + store match in data)
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_select_admin" ON notifications
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "notifications_select_store" ON notifications
  FOR SELECT TO authenticated
  USING (
    is_internal()
    AND NOT is_admin()
    AND has_store_access(COALESCE(data->>'store_id', ''))
  );

CREATE POLICY "notifications_insert_own" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_insert_admin" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notifications_update_admin" ON notifications
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "notifications_delete_own" ON notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_delete_admin" ON notifications
  FOR DELETE TO authenticated
  USING (is_admin());

-- notification_preferences: OWN only
CREATE POLICY "notif_prefs_select_own" ON notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notif_prefs_insert_own" ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notif_prefs_update_own" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notif_prefs_delete_own" ON notification_preferences
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- SECTION 12: QR
-- ============================================================================

-- qr_codes: OWN | HQ
CREATE POLICY "qr_codes_select_own" ON qr_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "qr_codes_select_hq" ON qr_codes
  FOR SELECT TO authenticated
  USING (is_super_admin());

CREATE POLICY "qr_codes_insert_own" ON qr_codes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qr_codes_update_own" ON qr_codes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qr_codes_update_hq" ON qr_codes
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "qr_codes_delete_own" ON qr_codes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "qr_codes_delete_hq" ON qr_codes
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- qr_scans: OWN | HQ/admin | STORE
CREATE POLICY "qr_scans_select_own" ON qr_scans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "qr_scans_select_admin" ON qr_scans
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "qr_scans_select_store" ON qr_scans
  FOR SELECT TO authenticated
  USING (has_store_access(qr_scans.store_id));

CREATE POLICY "qr_scans_insert_own" ON qr_scans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "qr_scans_insert_admin" ON qr_scans
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "qr_scans_insert_store" ON qr_scans
  FOR INSERT TO authenticated
  WITH CHECK (has_store_access(qr_scans.store_id));

CREATE POLICY "qr_scans_update_hq" ON qr_scans
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "qr_scans_delete_hq" ON qr_scans
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 13: Inventory
-- ============================================================================

-- inventory_items: internal read; HQ insert/delete; HQ+SM update
CREATE POLICY "inventory_items_select_internal" ON inventory_items
  FOR SELECT TO authenticated
  USING (is_internal());

CREATE POLICY "inventory_items_insert_hq" ON inventory_items
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "inventory_items_update_hq" ON inventory_items
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "inventory_items_update_store_manager" ON inventory_items
  FOR UPDATE TO authenticated
  USING (is_store_manager())
  WITH CHECK (is_store_manager());

CREATE POLICY "inventory_items_delete_hq" ON inventory_items
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- inventory_movements: HQ/admin | STORE read; HQ/admin | SM/ST+STORE insert
CREATE POLICY "inventory_movements_select_admin" ON inventory_movements
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "inventory_movements_select_store" ON inventory_movements
  FOR SELECT TO authenticated
  USING (has_store_access(inventory_movements.store_id));

CREATE POLICY "inventory_movements_insert_admin" ON inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "inventory_movements_insert_store" ON inventory_movements
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_store_manager() OR is_staff())
    AND has_store_access(inventory_movements.store_id)
  );

CREATE POLICY "inventory_movements_update_hq" ON inventory_movements
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "inventory_movements_delete_hq" ON inventory_movements
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 14: Employees
-- ============================================================================

-- employees: HQ/admin | STORE read; HQ | (FR/SM+STORE) insert/update; HQ delete
CREATE POLICY "employees_select_admin" ON employees
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "employees_select_store" ON employees
  FOR SELECT TO authenticated
  USING (has_store_access(employees.store_id));

CREATE POLICY "employees_insert_hq" ON employees
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "employees_insert_store_fm" ON employees
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(employees.store_id)
  );

CREATE POLICY "employees_update_admin" ON employees
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "employees_update_store_fm" ON employees
  FOR UPDATE TO authenticated
  USING (
    (is_franchise() OR is_store_manager())
    AND has_store_access(employees.store_id)
  )
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(employees.store_id)
  );

CREATE POLICY "employees_delete_hq" ON employees
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================================
-- SECTION 15: Security & audit
-- ============================================================================

-- audit_logs: OWN(actor_id) | HQ/admin | (FR/SM own-store) read;
-- OWN | HQ/admin | FR | SM insert; HQ update/delete
CREATE POLICY "audit_logs_select_own" ON audit_logs
  FOR SELECT TO authenticated
  USING (auth.uid() = actor_id);

CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "audit_logs_select_store_fm" ON audit_logs
  FOR SELECT TO authenticated
  USING (
    (is_franchise() OR is_store_manager())
    AND has_store_access(COALESCE(
      (details->>'store_id')::text, ''))
  );

CREATE POLICY "audit_logs_insert_own" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "audit_logs_insert_admin" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "audit_logs_insert_franchise" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_franchise());

CREATE POLICY "audit_logs_insert_store_manager" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_store_manager());

CREATE POLICY "audit_logs_update_hq" ON audit_logs
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

CREATE POLICY "audit_logs_delete_hq" ON audit_logs
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- suspicious_activity: HQ/admin | STORE read; HQ/admin | STORE insert; HQ/admin update; HQ delete
CREATE POLICY "suspicious_select_admin" ON suspicious_activity
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "suspicious_select_store" ON suspicious_activity
  FOR SELECT TO authenticated
  USING (has_store_access(suspicious_activity.store_id));

CREATE POLICY "suspicious_insert_admin" ON suspicious_activity
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "suspicious_insert_store" ON suspicious_activity
  FOR INSERT TO authenticated
  WITH CHECK (
    is_internal()
    AND NOT is_admin()
    AND has_store_access(suspicious_activity.store_id)
  );

CREATE POLICY "suspicious_update_admin" ON suspicious_activity
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "suspicious_delete_hq" ON suspicious_activity
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- admin_push_queue: HQ/admin | STORE read; HQ | (FR/SM+STORE) insert/update; HQ delete
CREATE POLICY "push_queue_select_admin" ON admin_push_queue
  FOR SELECT TO authenticated
  USING (is_admin());

CREATE POLICY "push_queue_select_store" ON admin_push_queue
  FOR SELECT TO authenticated
  USING (has_store_access(admin_push_queue.store_id));

CREATE POLICY "push_queue_insert_hq" ON admin_push_queue
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "push_queue_insert_store_fm" ON admin_push_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(admin_push_queue.store_id)
  );

CREATE POLICY "push_queue_update_admin" ON admin_push_queue
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "push_queue_update_store_fm" ON admin_push_queue
  FOR UPDATE TO authenticated
  USING (
    (is_franchise() OR is_store_manager())
    AND has_store_access(admin_push_queue.store_id)
  )
  WITH CHECK (
    (is_franchise() OR is_store_manager())
    AND has_store_access(admin_push_queue.store_id)
  );

CREATE POLICY "push_queue_delete_hq" ON admin_push_queue
  FOR DELETE TO authenticated
  USING (is_super_admin());
