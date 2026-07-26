/*
# Franchise Yönetim ve Raporlama Modülü — Schema

Adds the data layer for professional franchise reporting:

1. stamp_cards       — completed stamp-card records (1 per 5 stamps).
2. free_coffee_redemptions — immutable log of every free coffee given.
3. suspicious_activity — flagged anomalies (rapid scans, self-stamp, etc.).
4. points_history.store_id + reward_redemptions.store_id (nullable, additive).
5. Helper user_roles_store_match() for franchise-scoped RLS.
6. Trigger: auto-create stamp_cards when loyalty_stamps marked redeemed.

Data safety: only ADD tables + ADD nullable columns. No DROP, no renames,
no type changes. Existing rows get NULL store_id (fine).
*/

-- ============================================================
-- 0. HELPER FUNCTION (must exist before RLS policies reference it)
-- ============================================================
CREATE OR REPLACE FUNCTION user_roles_store_match(p_uid uuid, p_store_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_uid
      AND role = 'franchise'
      AND store_id = p_store_id
  );
$$;

-- ============================================================
-- 1. STAMP_CARDS — completed stamp cards
-- ============================================================
CREATE TABLE IF NOT EXISTS stamp_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id text REFERENCES stores(id),
  stamps_required integer NOT NULL DEFAULT 5,
  completed_at timestamptz NOT NULL DEFAULT now(),
  redeemed_at timestamptz,
  reward_claimed boolean NOT NULL DEFAULT false
);

ALTER TABLE stamp_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_stamp_cards_admin_franchise" ON stamp_cards
  FOR SELECT TO authenticated
  USING (is_admin() OR user_roles_store_match(auth.uid(), store_id));

CREATE POLICY "select_own_stamp_cards" ON stamp_cards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_stamp_cards_admin" ON stamp_cards
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "update_stamp_cards_admin" ON stamp_cards
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_stamp_cards_user_id ON stamp_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_stamp_cards_store_id ON stamp_cards(store_id);
CREATE INDEX IF NOT EXISTS idx_stamp_cards_completed_at ON stamp_cards(completed_at DESC);

-- ============================================================
-- 2. FREE_COFFEE_REDEMPTIONS — immutable log
-- ============================================================
CREATE TABLE IF NOT EXISTS free_coffee_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id text REFERENCES stores(id),
  product_id text REFERENCES products(id),
  product_name text NOT NULL DEFAULT '',
  stamp_card_id uuid REFERENCES stamp_cards(id),
  redeemed_by uuid,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE free_coffee_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_fcr_admin_franchise" ON free_coffee_redemptions
  FOR SELECT TO authenticated
  USING (is_admin() OR user_roles_store_match(auth.uid(), store_id));

CREATE POLICY "select_own_fcr" ON free_coffee_redemptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "insert_fcr_admin_franchise" ON free_coffee_redemptions
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR user_roles_store_match(auth.uid(), store_id));

CREATE INDEX IF NOT EXISTS idx_fcr_store_id ON free_coffee_redemptions(store_id);
CREATE INDEX IF NOT EXISTS idx_fcr_user_id ON free_coffee_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_fcr_redeemed_at ON free_coffee_redemptions(redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_fcr_product_id ON free_coffee_redemptions(product_id);

-- ============================================================
-- 3. SUSPICIOUS_ACTIVITY — flagged anomalies
-- ============================================================
CREATE TABLE IF NOT EXISTS suspicious_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('rapid_repeat_scan','self_stamp','self_points','unusual_redemption','duplicate_qr')),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  store_id text REFERENCES stores(id),
  actor_id uuid,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  description text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz
);

ALTER TABLE suspicious_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_suspicious_admin_franchise" ON suspicious_activity
  FOR SELECT TO authenticated
  USING (is_admin() OR user_roles_store_match(auth.uid(), store_id));

CREATE POLICY "insert_suspicious_admin" ON suspicious_activity
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "update_suspicious_admin" ON suspicious_activity
  FOR UPDATE TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_suspicious_store_id ON suspicious_activity(store_id);
CREATE INDEX IF NOT EXISTS idx_suspicious_detected_at ON suspicious_activity(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_suspicious_resolved ON suspicious_activity(resolved);

-- ============================================================
-- 4. ADD store_id TO points_history + reward_redemptions (nullable)
-- ============================================================
ALTER TABLE points_history ADD COLUMN IF NOT EXISTS store_id text REFERENCES stores(id);
ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS store_id text REFERENCES stores(id);

CREATE INDEX IF NOT EXISTS idx_points_history_store_id ON points_history(store_id);
CREATE INDEX IF NOT EXISTS idx_redemptions_store_id ON reward_redemptions(store_id);

-- ============================================================
-- 5. TRIGGER: auto-create stamp_cards when loyalty_stamps redeemed
-- ============================================================
CREATE OR REPLACE FUNCTION create_stamp_card_on_redeem()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_completed_count integer;
  v_existing_cards integer;
  v_new_cards_needed integer;
BEGIN
  IF NEW.redeemed = true AND (OLD.redeemed = false OR OLD.redeemed IS NULL) THEN
    SELECT count(*) INTO v_completed_count
    FROM loyalty_stamps
    WHERE user_id = NEW.user_id AND redeemed = true;

    SELECT count(*) INTO v_existing_cards
    FROM stamp_cards
    WHERE user_id = NEW.user_id;

    v_new_cards_needed := v_completed_count / 5 - v_existing_cards;

    IF v_new_cards_needed > 0 THEN
      INSERT INTO stamp_cards (user_id, store_id, stamps_required, completed_at, reward_claimed)
      SELECT NEW.user_id, NEW.store_id, 5, now(), false
      FROM generate_series(1, v_new_cards_needed);
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_stamp_redeemed ON loyalty_stamps;
CREATE TRIGGER on_stamp_redeemed
  AFTER UPDATE OF redeemed ON loyalty_stamps
  FOR EACH ROW EXECUTE FUNCTION create_stamp_card_on_redeem();

-- ============================================================
-- 6. BACKFILL stamp_cards from existing redeemed stamps
-- ============================================================
INSERT INTO stamp_cards (user_id, store_id, stamps_required, completed_at, reward_claimed)
SELECT
  ls.user_id,
  MAX(ls.store_id) AS store_id,
  5,
  MAX(ls.stamped_at) AS completed_at,
  false
FROM loyalty_stamps ls
WHERE ls.redeemed = true
GROUP BY ls.user_id
HAVING count(*) >= 5
ON CONFLICT DO NOTHING;

-- ============================================================
-- 7. SEED ONE SAMPLE suspicious_activity row for demo (idempotent)
-- ============================================================
INSERT INTO suspicious_activity (type, severity, description, metadata, detected_at)
SELECT 'rapid_repeat_scan', 'medium', 'Aynı QR kodu 2 dakika içinde 3 kez okutuldu',
       '{"scan_count":3,"interval_seconds":120}'::jsonb,
       now() - interval '3 hours'
WHERE NOT EXISTS (SELECT 1 FROM suspicious_activity LIMIT 1);
