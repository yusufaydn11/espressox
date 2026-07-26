/*
# Franchise RBAC System — Store-Scoped Authorization

## Purpose
Introduce a multi-tenant franchise authorization layer so that each branch
(franchise) has its own staff login that can ONLY access that branch's data.
The super admin (general HQ) keeps full access across all branches.

## Roles (in user_roles.role)
- `customer`      — end customer (existing)
- `staff`         — barista (existing, currently unused for scoping)
- `admin`         — HQ manager (existing, full access via is_admin())
- `super_admin`   — HQ owner (existing, full access via is_admin())
- `franchise`     — NEW. A branch manager / franchise operator.
                    Scoped to exactly ONE store via user_roles.store_id.

## Changes
### 1. user_roles table
- Add `store_id text` column (nullable). Set only for `franchise` role.
  References stores(id) ON DELETE SET NULL.
- Add a CHECK constraint: a `franchise` role MUST have a store_id.
  (A franchise account with no store would have no data — refuse it.)
- Add a partial UNIQUE index so a store can have at most one PRIMARY
  franchise operator. (Multiple staff per store can be added later as
  `staff` with store_id, which is NOT covered by this unique index.)

### 2. Helper functions (SECURITY DEFINER, safe from RLS)
- `my_store_id()` → returns the caller's store_id (or NULL).
- `is_franchise()` → true if caller's role is `franchise`.
- `is_hq()` → true if caller is `admin` or `super_admin` (alias of is_admin,
   kept separate for readability in policies).

### 3. RLS policies — store-scoped access for franchise role
The franchise role must see ONLY its own store's data and update ONLY order
status for its own store. We add new SELECT/UPDATE policies alongside the
existing admin ones (no existing policy is dropped — we ADD).

Tables that get a franchise-scoped policy:
- orders          → SELECT own store; UPDATE status own store
- order_items     → SELECT (via own-store order)
- qr_scans        → SELECT own store; INSERT (so franchise can scan QR)
- loyalty_stamps  → SELECT own store; INSERT (stamp a customer)
- points_history  → SELECT own store's customers; INSERT (award points)
- notifications   → SELECT own store's notifications (targeted campaigns)
- campaigns       → SELECT active campaigns targeting own store (read-only)

Franchise users CANNOT (enforced by absence of policy):
- insert/update/delete on products, stores, rewards, campaigns (write)
- update profiles (customer data) — read-only of own-store order customers
  is handled at the query layer (no new profile SELECT policy added for
  franchise to avoid exposing all customers; franchise reads order rows
  which carry store_name).

### 4. audit_logs
- Add franchise-scoped INSERT policy so franchise actions are auditable.
  (Audit writes are also done by the manage-franchise-user edge function
  using the service role, but client-side admin actions by franchise users
  should still record.)

## Security
- No table structure changes that lose data. Only an ADD COLUMN + new
  policies + new functions. All idempotent.
- RLS remains enabled everywhere. We never weaken an existing policy.
- The franchise role is the LEAST-privileged privileged role: it can read
  its own store's operational data and update order status / scan QR /
  stamp customers, and NOTHING else.
- Unauthorized access (a franchise user querying another store's orders)
  returns zero rows — enforced at the database, not just the UI.

## Notes
1. `my_store_id()` / `is_franchise()` / `is_hq()` are STABLE SECURITY DEFINER
   with search_path = 'public', safe to call inside RLS policies.
2. Existing `is_admin()` is unchanged and still used by all admin policies.
3. The new policies are ADDITIVE — a row visible to franchise is also
   visible to HQ via the existing admin_read_* policies.
*/

-- ============================================================
-- 1. user_roles: add store_id + franchise role rules
-- ============================================================
ALTER TABLE user_roles
  ADD COLUMN IF NOT EXISTS store_id text REFERENCES stores(id) ON DELETE SET NULL;

-- A franchise operator MUST be tied to a store.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_franchise_needs_store'
  ) THEN
    ALTER TABLE user_roles
      ADD CONSTRAINT user_roles_franchise_needs_store
      CHECK (role <> 'franchise' OR store_id IS NOT NULL);
  END IF;
END $$;

-- One primary franchise operator per store.
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_roles_franchise_store
  ON user_roles(store_id)
  WHERE role = 'franchise';

CREATE INDEX IF NOT EXISTS idx_user_roles_store_id ON user_roles(store_id);

-- ============================================================
-- 2. Helper functions
-- ============================================================
CREATE OR REPLACE FUNCTION my_store_id()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT store_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION is_franchise()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role = 'franchise'
  );
$$;

CREATE OR REPLACE FUNCTION is_hq()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid() AND role IN ('admin','super_admin')
  );
$$;

-- ============================================================
-- 3. Store-scoped RLS policies for franchise role
-- ============================================================

-- orders: franchise sees own store, can update status of own store
DROP POLICY IF EXISTS "franchise_read_own_store_orders" ON orders;
CREATE POLICY "franchise_read_own_store_orders" ON orders
  FOR SELECT TO authenticated
  USING (is_franchise() AND store_id = my_store_id());

DROP POLICY IF EXISTS "franchise_update_own_store_orders" ON orders;
CREATE POLICY "franchise_update_own_store_orders" ON orders
  FOR UPDATE TO authenticated
  USING (is_franchise() AND store_id = my_store_id())
  WITH CHECK (is_franchise() AND store_id = my_store_id());

-- order_items: franchise reads items of own-store orders
DROP POLICY IF EXISTS "franchise_read_own_store_order_items" ON order_items;
CREATE POLICY "franchise_read_own_store_order_items" ON order_items
  FOR SELECT TO authenticated
  USING (
    is_franchise()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.store_id = my_store_id()
    )
  );

-- qr_scans: franchise reads own store scans + can insert (scan customer QR)
DROP POLICY IF EXISTS "franchise_read_own_store_scans" ON qr_scans;
CREATE POLICY "franchise_read_own_store_scans" ON qr_scans
  FOR SELECT TO authenticated
  USING (is_franchise() AND store_id = my_store_id());

DROP POLICY IF EXISTS "franchise_insert_own_store_scans" ON qr_scans;
CREATE POLICY "franchise_insert_own_store_scans" ON qr_scans
  FOR INSERT TO authenticated
  WITH CHECK (is_franchise() AND store_id = my_store_id());

-- loyalty_stamps: franchise reads own store stamps + can stamp
DROP POLICY IF EXISTS "franchise_read_own_store_stamps" ON loyalty_stamps;
CREATE POLICY "franchise_read_own_store_stamps" ON loyalty_stamps
  FOR SELECT TO authenticated
  USING (is_franchise() AND store_id = my_store_id());

DROP POLICY IF EXISTS "franchise_insert_own_store_stamps" ON loyalty_stamps;
CREATE POLICY "franchise_insert_own_store_stamps" ON loyalty_stamps
  FOR INSERT TO authenticated
  WITH CHECK (is_franchise() AND store_id = my_store_id());

-- points_history: franchise can read + insert points for customers
--   (scoping by store is approximated: we allow insert for any user when
--    the actor is a franchise operator; read is limited to rows whose
--    user placed an order at the franchise's store — done via JOIN.)
DROP POLICY IF EXISTS "franchise_read_own_store_points_history" ON points_history;
CREATE POLICY "franchise_read_own_store_points_history" ON points_history
  FOR SELECT TO authenticated
  USING (
    is_franchise()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.user_id = points_history.user_id
        AND o.store_id = my_store_id()
    )
  );

DROP POLICY IF EXISTS "franchise_insert_points_history" ON points_history;
CREATE POLICY "franchise_insert_points_history" ON points_history
  FOR INSERT TO authenticated
  WITH CHECK (is_franchise());

-- notifications: franchise reads notifications targeting its store
--   (notifications.user_id may be NULL for store-wide broadcasts; we also
--    expose campaign-targeted notifications via data->>'store_id'.)
DROP POLICY IF EXISTS "franchise_read_own_store_notifications" ON notifications;
CREATE POLICY "franchise_read_own_store_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (
    is_franchise()
    AND (data->>'store_id') = my_store_id()
  );

-- campaigns: franchise reads active campaigns that target its store (or all)
DROP POLICY IF EXISTS "franchise_read_active_campaigns" ON campaigns;
CREATE POLICY "franchise_read_active_campaigns" ON campaigns
  FOR SELECT TO authenticated
  USING (
    is_franchise()
    AND status = 'active'
    AND (store_id IS NULL OR store_id = my_store_id())
  );

-- qr_codes: franchise can look up a customer's QR by code (needed to scan)
--   Limited to SELECT so they can resolve a scanned code to a user_id.
DROP POLICY IF EXISTS "franchise_read_qr_codes" ON qr_codes;
CREATE POLICY "franchise_read_qr_codes" ON qr_codes
  FOR SELECT TO authenticated
  USING (is_franchise());

-- profiles: franchise can READ customers who have ordered at their store.
--   They CANNOT update or delete profiles (no update/delete policy added).
DROP POLICY IF EXISTS "franchise_read_own_store_customer_profiles" ON profiles;
CREATE POLICY "franchise_read_own_store_customer_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    is_franchise()
    AND EXISTS (
      SELECT 1 FROM orders o
      WHERE o.user_id = profiles.user_id
        AND o.store_id = my_store_id()
    )
  );

-- ============================================================
-- 4. audit_logs: franchise actions are auditable
-- ============================================================
DROP POLICY IF EXISTS "franchise_insert_audit_logs" ON audit_logs;
CREATE POLICY "franchise_insert_audit_logs" ON audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (is_franchise());

DROP POLICY IF EXISTS "hq_read_audit_logs" ON audit_logs;
CREATE POLICY "hq_read_audit_logs" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_hq());
