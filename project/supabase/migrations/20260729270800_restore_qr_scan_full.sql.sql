/*
# Restore full qr_scan behavior after 70401 regression

70401 reintroduced security hardening (self_scan_forbidden, store checks) but
dropped stamp-card redeem, QR expiry, duplicate_scan guard, and remaining_stamps
response fields from V3 / stamp_card migrations.

This migration merges 70401 security with V3 loyalty scan semantics.
*/

CREATE OR REPLACE FUNCTION public.qr_scan(
  p_qr_code_id uuid,
  p_store_id text DEFAULT NULL::text,
  p_action text DEFAULT 'stamp'::text,
  p_points integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_customer uuid;
  v_qr_expires timestamptz;
  v_last_scan timestamptz;
  v_dedup text;
  v_points_awarded int;
  v_blocked boolean;
  v_points_per_stamp int;
  v_max_qr_points int;
  v_stamps_required int;
  v_active_stamps int;
  v_same_qr_scan int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  IF p_action NOT IN ('stamp','points','redeem') THEN
    RETURN jsonb_build_object('error', 'invalid_action');
  END IF;

  SELECT COALESCE(points_per_stamp, 10) INTO v_points_per_stamp FROM loyalty_settings LIMIT 1;
  IF v_points_per_stamp IS NULL OR v_points_per_stamp < 1 THEN
    v_points_per_stamp := 10;
  END IF;
  v_max_qr_points := v_points_per_stamp;
  v_stamps_required := 5;

  IF p_qr_code_id IS NULL THEN
    RETURN jsonb_build_object('error', 'qr_not_found');
  END IF;

  SELECT user_id, expires_at INTO v_customer, v_qr_expires
  FROM qr_codes
  WHERE id = p_qr_code_id AND is_active = true;

  IF v_customer IS NULL THEN
    RETURN jsonb_build_object('error', 'qr_not_found');
  END IF;

  IF v_qr_expires IS NOT NULL AND v_qr_expires < now() THEN
    RETURN jsonb_build_object('error', 'qr_expired');
  END IF;

  -- 70401: block self-scan point farming
  IF v_customer = v_uid AND NOT is_admin() AND NOT is_super_admin() THEN
    RETURN jsonb_build_object('error', 'self_scan_forbidden');
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_customer;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  IF v_customer <> v_uid
     AND NOT is_super_admin()
     AND NOT is_admin()
     AND NOT has_store_access(p_store_id) THEN
    RETURN jsonb_build_object('error', 'not_owner');
  END IF;

  IF v_customer <> v_uid AND (p_store_id IS NULL OR TRIM(p_store_id) = '') THEN
    RETURN jsonb_build_object('error', 'store_required');
  END IF;

  IF p_store_id IS NOT NULL AND TRIM(p_store_id) <> '' THEN
    IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id) THEN
      RETURN jsonb_build_object('error', 'store_not_found');
    END IF;
  END IF;

  -- Duplicate scan same QR within 5 min by same scanner (staff)
  IF v_customer <> v_uid THEN
    SELECT count(*) INTO v_same_qr_scan
    FROM qr_scans
    WHERE qr_code_id = p_qr_code_id
      AND scanned_by = v_uid::text
      AND scanned_at > now() - interval '5 minutes';
    IF v_same_qr_scan > 0 THEN
      RETURN jsonb_build_object('error', 'duplicate_scan');
    END IF;
  END IF;

  SELECT scanned_at INTO v_last_scan
  FROM qr_scans
  WHERE scanned_by = v_uid::text
  ORDER BY scanned_at DESC
  LIMIT 1;
  IF v_last_scan IS NOT NULL AND now() - v_last_scan < interval '60 seconds' THEN
    RETURN jsonb_build_object(
      'error', 'rate_limited',
      'retry_after', 60 - EXTRACT(epoch FROM (now() - v_last_scan))::int
    );
  END IF;

  SELECT count(*) INTO v_active_stamps
  FROM loyalty_stamps
  WHERE user_id = v_customer AND redeemed = false;

  -- 5+ stamps → redeem free coffee
  IF p_action = 'stamp' AND v_active_stamps >= v_stamps_required THEN
    UPDATE loyalty_stamps SET redeemed = true
    WHERE id IN (
      SELECT id FROM loyalty_stamps
      WHERE user_id = v_customer AND redeemed = false
      ORDER BY stamped_at ASC
      LIMIT v_stamps_required
    );

    v_dedup := v_customer::text || '-redeem-' || extract(epoch FROM now())::bigint::text;

    INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
    VALUES (v_customer, p_qr_code_id, p_store_id, 'redeem', 0, v_dedup, v_uid::text);

    INSERT INTO free_coffee_redemptions (user_id, store_id, product_name, redeemed_by)
    VALUES (v_customer, p_store_id, 'Ücretsiz Kahve (Damga Kartı)', v_uid);

    SELECT count(*) INTO v_active_stamps
    FROM loyalty_stamps
    WHERE user_id = v_customer AND redeemed = false;

    RETURN jsonb_build_object(
      'error', null,
      'redeemed', true,
      'stamps_redeemed', v_stamps_required,
      'points_awarded', 0,
      'customer_id', v_customer,
      'remaining_stamps', v_active_stamps
    );
  END IF;

  IF p_action = 'stamp' THEN
    v_points_awarded := v_points_per_stamp;
  ELSIF p_action = 'points' THEN
    v_points_awarded := LEAST(GREATEST(0, COALESCE(p_points, 0)), v_max_qr_points);
  ELSE
    v_points_awarded := 0;
  END IF;

  v_dedup := v_customer::text || '-' || extract(epoch FROM now())::bigint::text;

  INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
  VALUES (v_customer, p_qr_code_id, p_store_id, p_action, v_points_awarded, v_dedup, v_uid::text);

  IF p_action = 'stamp' THEN
    INSERT INTO loyalty_stamps (user_id, store_id) VALUES (v_customer, p_store_id);
  END IF;

  IF v_points_awarded > 0 THEN
    UPDATE profiles
    SET points = points + v_points_awarded,
        lifetime_points = lifetime_points + v_points_awarded
    WHERE user_id = v_customer;
    INSERT INTO points_history (user_id, title, points, type, store_id)
    VALUES (v_customer, 'QR damga', v_points_awarded, 'earn', p_store_id);
    IF EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'recalc_profile_tier' AND pronamespace = 'public'::regnamespace
    ) THEN
      PERFORM recalc_profile_tier(v_customer);
    END IF;
  END IF;

  SELECT count(*) INTO v_active_stamps
  FROM loyalty_stamps
  WHERE user_id = v_customer AND redeemed = false;

  RETURN jsonb_build_object(
    'error', null,
    'redeemed', false,
    'points_awarded', v_points_awarded,
    'customer_id', v_customer,
    'remaining_stamps', v_active_stamps
  );
END;
$function$;

-- Concurrency-safe reward redemption (prevent double-spend under parallel requests)
CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cost int;
  v_current int;
  v_title text;
  v_blocked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  SELECT points_cost, title INTO v_cost, v_title
  FROM rewards
  WHERE id = p_reward_id AND is_active = true;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('error', 'reward_not_found');
  END IF;

  SELECT points INTO v_current
  FROM profiles
  WHERE user_id = v_uid
  FOR UPDATE;
  IF v_current IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;
  IF v_current < v_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_points', 'needed', v_cost - v_current);
  END IF;

  INSERT INTO reward_redemptions (user_id, reward_id, points_spent)
  VALUES (v_uid, p_reward_id, v_cost);

  UPDATE profiles SET points = GREATEST(0, points - v_cost) WHERE user_id = v_uid;

  INSERT INTO points_history (user_id, title, points, type)
  VALUES (v_uid, v_title, -v_cost, 'redeem');

  INSERT INTO notifications (user_id, title, body, type)
  VALUES (v_uid, 'Odul kullanildi', v_title || ' odulunu kullandin.', 'reward');

  RETURN jsonb_build_object('error', null, 'title', v_title);
END;
$function$;
