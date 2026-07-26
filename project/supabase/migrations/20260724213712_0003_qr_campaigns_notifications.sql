/*
# Espresso X — QR System, Campaigns, Notifications

1. New Tables:
   - qr_codes: Unique per-user QR codes (one active per user)
   - qr_scans: Scan log with dedup_token to prevent double-processing
   - campaigns: Marketing campaigns with targeting
   - notifications: Push notification log + user inbox
   - notification_preferences: Per-user granular notification toggles
2. Security:
   - QR codes: owner-scoped + admin read
   - QR scans: owner-scoped read, admin insert (employee scans customer QR)
   - Campaigns: users read active, admin full CRUD
   - Notifications: owner-scoped, admin insert
   - Notification preferences: owner-scoped CRUD
*/

-- ============================================================
-- QR CODES (unique per user)
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz
);

ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_qr" ON qr_codes;
CREATE POLICY "select_own_qr" ON qr_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_qr" ON qr_codes;
CREATE POLICY "insert_own_qr" ON qr_codes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_qr" ON qr_codes;
CREATE POLICY "update_own_qr" ON qr_codes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_qr_codes" ON qr_codes;
CREATE POLICY "admin_read_qr_codes" ON qr_codes
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);

-- ============================================================
-- QR SCANS (with dedup to prevent double-processing)
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  qr_code_id uuid REFERENCES qr_codes(id),
  store_id text,
  action text NOT NULL DEFAULT 'stamp' CHECK (action IN ('stamp','points','redeem')),
  points_awarded integer NOT NULL DEFAULT 0,
  dedup_token text NOT NULL UNIQUE,
  scanned_at timestamptz NOT NULL DEFAULT now(),
  scanned_by text
);

ALTER TABLE qr_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_scans" ON qr_scans;
CREATE POLICY "select_own_scans" ON qr_scans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_scans" ON qr_scans;
CREATE POLICY "admin_read_scans" ON qr_scans
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_insert_scans" ON qr_scans;
CREATE POLICY "admin_insert_scans" ON qr_scans
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_qr_scans_user_id ON qr_scans(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_scans_scanned_at ON qr_scans(scanned_at DESC);

-- ============================================================
-- CAMPAIGNS
-- ============================================================
CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'push' CHECK (type IN ('push','email','sms','birthday','location')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','scheduled','draft','ended')),
  target_segment text NOT NULL DEFAULT 'all',
  store_id text REFERENCES stores(id),
  message text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  reach integer NOT NULL DEFAULT 0,
  conversion numeric(5,2) NOT NULL DEFAULT 0,
  revenue numeric(10,2) NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_active_campaigns" ON campaigns;
CREATE POLICY "read_active_campaigns" ON campaigns
  FOR SELECT TO authenticated
  USING (status = 'active' OR (auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_insert_campaigns" ON campaigns;
CREATE POLICY "admin_insert_campaigns" ON campaigns
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_update_campaigns" ON campaigns;
CREATE POLICY "admin_update_campaigns" ON campaigns
  FOR UPDATE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_delete_campaigns" ON campaigns;
CREATE POLICY "admin_delete_campaigns" ON campaigns
  FOR DELETE TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('order','promo','reward','challenge','general','admin')),
  is_read boolean NOT NULL DEFAULT false,
  data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_read_notifications" ON notifications;
CREATE POLICY "admin_read_notifications" ON notifications
  FOR SELECT TO authenticated
  USING ((auth.jwt() ->> 'role') = 'admin');

DROP POLICY IF EXISTS "admin_insert_notifications" ON notifications;
CREATE POLICY "admin_insert_notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  master_enabled boolean NOT NULL DEFAULT true,
  order_updates boolean NOT NULL DEFAULT true,
  promotions boolean NOT NULL DEFAULT true,
  rewards boolean NOT NULL DEFAULT true,
  challenges boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notif_prefs" ON notification_preferences;
CREATE POLICY "select_own_notif_prefs" ON notification_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_notif_prefs" ON notification_preferences;
CREATE POLICY "insert_own_notif_prefs" ON notification_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_notif_prefs" ON notification_preferences;
CREATE POLICY "update_own_notif_prefs" ON notification_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user_id ON notification_preferences(user_id);

-- ============================================================
-- updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at_profiles ON profiles;
CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_orders ON orders;
CREATE TRIGGER set_updated_at_orders BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_campaigns ON campaigns;
CREATE TRIGGER set_updated_at_campaigns BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_notif_prefs ON notification_preferences;
CREATE TRIGGER set_updated_at_notif_prefs BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
