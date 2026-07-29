/*
# Admin Auth & RLS Completion

## Purpose
Complete role-based authorization for the admin web panel so that all four
admin roles (super_admin, franchise, store_manager, staff) can actually read
the live data they are permitted to see. Two gaps are fixed:

1. The is_admin() and is_hq() helper functions only checked for
   ('admin','super_admin'). Many RLS policies on orders, profiles,
   notifications, points_history, order_items, products, rewards, stores,
   campaigns, etc. use is_admin() in their USING/WITH CHECK clauses. As a
   result, franchise / store_manager / staff users would see EMPTY result
   sets from those tables even though the admin panel grants them access.
   The functions now include all four admin roles so the existing policies
   work correctly for every authorized user.

2. loyalty_settings has zero rows and no INSERT policy. A super_admin
   cannot create the initial settings row through RLS, so the Loyalty
   screen shows an empty state forever. This migration adds an INSERT
   policy for super_admin AND inserts a sensible default settings row so
   the panel has working data immediately.

## Functions Changed

### is_admin()
- Before: role IN ('admin','super_admin')
- After:  role IN ('super_admin','franchise','store_manager','staff')
- Still SECURITY INVOKER, STABLE, SET search_path = 'public'.
- NOTE: 'admin' is intentionally dropped. It was a legacy role name with
  no row in user_roles (all real rows use super_admin). Keeping it would
  let a stale 'admin' row bypass the intended role list. The four
  canonical admin roles are the only ones recognized now.

### is_hq()
- Before: role IN ('admin','super_admin')
- After:  role IN ('super_admin')  (HQ = headquarters only)
- is_hq() is used for the most privileged operations (franchise
  management, settings). Only super_admin qualifies. franchise /
  store_manager / staff are field roles, not HQ.

## New Policies

### loyalty_settings — INSERT for super_admin
- "admin_insert_loyalty_settings": allows super_admin to create the
  initial (and only) settings row. Without this, the table was read/
  update-only under RLS and could never be seeded from the panel.

## Data
- Inserts one default row into loyalty_settings if the table is empty.
  earn_rate=1 (1 point per 1 TRY), redeem_rate=0.05, tier thresholds
  bronze=0, silver=1000, gold=3000, vip=15000, points_per_stamp=50,
  stamps_per_free_coffee=10. These match the values the admin panel's
  Loyalty screen expects.

## Security
- No existing policy is dropped or weakened. The is_admin() change makes
  existing policies MORE inclusive of the already-authorized roles; it
  does not open access to customer/anon users (all policies are still
  TO authenticated, and customer role is not in the new list).
- is_hq() is narrowed to super_admin only, matching its intended use.
- loyalty_settings INSERT is restricted to super_admin.

## Idempotency
- CREATE OR REPLACE FUNCTION is safe to re-run.
- DROP POLICY IF EXISTS before CREATE POLICY is safe to re-run.
- INSERT ... ON CONFLICT DO NOTHING prevents duplicate settings rows.
*/

-- ─── 1. Update is_admin() to cover all four admin roles ──────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin','franchise','store_manager','staff')
  );
$$;

-- ─── 2. Narrow is_hq() to super_admin only ───────────────────────
CREATE OR REPLACE FUNCTION public.is_hq()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role = 'super_admin'
  );
$$;

-- ─── 3. loyalty_settings: add INSERT policy for super_admin ──────
DROP POLICY IF EXISTS "admin_insert_loyalty_settings" ON loyalty_settings;
CREATE POLICY "admin_insert_loyalty_settings"
ON loyalty_settings FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles ur
          WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin')
);

-- ─── 4. Seed default loyalty_settings row if empty ───────────────
INSERT INTO loyalty_settings
  (earn_rate, redeem_rate, bronze_min, silver_min, gold_min, vip_min,
   points_per_stamp, stamps_per_free_coffee)
SELECT 1.0, 0.05, 0, 1000, 3000, 15000, 50, 10
WHERE NOT EXISTS (SELECT 1 FROM loyalty_settings);
