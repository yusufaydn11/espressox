-- qr_scans.scanned_by is text; compare/insert as text to avoid text = uuid errors
CREATE OR REPLACE FUNCTION public.qr_scan(
  p_qr_code_id uuid,
  p_store_id text DEFAULT NULL::text,
  p_action text DEFAULT 'stamp'::text,
  p_points integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_customer uuid;
  v_last_scan timestamptz;
  v_dedup text;
  v_points_awarded int;
  v_blocked boolean;
  v_points_per_stamp int;
  v_max_qr_points int;
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

  IF p_qr_code_id IS NULL THEN
    RETURN jsonb_build_object('error', 'qr_not_found');
  END IF;

  SELECT user_id INTO v_customer FROM qr_codes WHERE id = p_qr_code_id AND is_active = true;
  IF v_customer IS NULL THEN
    RETURN jsonb_build_object('error', 'qr_not_found');
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

  SELECT scanned_at INTO v_last_scan
  FROM qr_scans
  WHERE scanned_by = v_uid::text
  ORDER BY scanned_at DESC LIMIT 1;
  IF v_last_scan IS NOT NULL AND now() - v_last_scan < interval '60 seconds' THEN
    RETURN jsonb_build_object('error', 'rate_limited', 'retry_after', 60 - EXTRACT(epoch FROM (now() - v_last_scan))::int);
  END IF;

  IF p_action = 'stamp' THEN
    v_points_awarded := v_points_per_stamp;
  ELSIF p_action = 'points' THEN
    v_points_awarded := LEAST(GREATEST(0, COALESCE(p_points, 0)), v_max_qr_points);
  ELSE
    v_points_awarded := 0;
  END IF;

  v_dedup := v_customer::text || '-' || extract(epoch from now())::bigint::text;

  INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
  VALUES (v_customer, p_qr_code_id, p_store_id, p_action, v_points_awarded, v_dedup, v_uid::text);

  IF p_action = 'stamp' THEN
    INSERT INTO loyalty_stamps (user_id, store_id) VALUES (v_customer, p_store_id);
  END IF;

  IF v_points_awarded > 0 THEN
    UPDATE profiles SET points = points + v_points_awarded, lifetime_points = lifetime_points + v_points_awarded
    WHERE user_id = v_customer;
    INSERT INTO points_history (user_id, title, points, type, store_id)
    VALUES (v_customer, 'QR damga', v_points_awarded, 'earn', p_store_id);
  END IF;

  RETURN jsonb_build_object('error', null, 'points_awarded', v_points_awarded, 'customer_id', v_customer);
END;
$function$;
