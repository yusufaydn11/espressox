/*
# Production QA Fixes

- Add store_manager to user_roles CHECK constraint
- create_order uses loyalty_settings.earn_rate
- qr_scan applies stamp/points to QR owner (customer), not scanner
- B2B audit_logs include store_id for franchise timeline RLS
- HQ admin role can execute B2B management RPCs (is_admin OR is_super_admin)
*/

-- ─── 1. store_manager in user_roles CHECK ───────────────────
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('customer', 'staff', 'admin', 'super_admin', 'franchise', 'store_manager'));

-- ─── 2. create_order — dynamic earn_rate ────────────────────
CREATE OR REPLACE FUNCTION public.create_order(
  p_items jsonb,
  p_total numeric,
  p_store_id text DEFAULT NULL::text,
  p_store_name text DEFAULT ''::text,
  p_order_type text DEFAULT 'pickup'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_points int;
  v_item jsonb;
  v_blocked boolean;
  v_earn_rate numeric;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  IF p_order_type NOT IN ('pickup','table','delivery','scheduled') THEN
    RETURN jsonb_build_object('error', 'invalid_order_type');
  END IF;

  SELECT COALESCE(earn_rate, 0.2) INTO v_earn_rate FROM loyalty_settings LIMIT 1;
  IF v_earn_rate IS NULL THEN v_earn_rate := 0.2; END IF;

  v_order_number := 'EX-' || nextval('order_number_seq')::text;
  v_points := GREATEST(0, ROUND(p_total * v_earn_rate))::int;

  INSERT INTO orders (order_number, user_id, status, order_type, store_id, store_name, total, points_earned)
  VALUES (v_order_number, v_uid, 'preparing', p_order_type, p_store_id, p_store_name, p_total, v_points)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, product_id, name, quantity, unit_price)
    VALUES (
      v_order_id,
      v_item->>'productId',
      v_item->>'name',
      (v_item->>'qty')::int,
      (v_item->>'price')::numeric
    );
  END LOOP;

  UPDATE profiles SET points = points + v_points, lifetime_points = lifetime_points + v_points
  WHERE user_id = v_uid;
  INSERT INTO points_history (user_id, title, points, type)
  VALUES (v_uid, 'Siparis ' || v_order_number, v_points, 'earn');

  INSERT INTO notifications (user_id, title, body, type)
  VALUES (v_uid, 'Siparisiniz alindi', v_order_number || ' numarali siparisiniz hazirlaniyor.', 'order');

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'points_earned', v_points,
    'error', null
  );
END;
$function$;

-- ─── 3. qr_scan — stamp/points go to QR owner ───────────────
CREATE OR REPLACE FUNCTION public.qr_scan(
  p_qr_code_id uuid,
  p_store_id text DEFAULT NULL::text,
  p_action text DEFAULT 'stamp'::text,
  p_points integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_customer uuid;
  v_last_scan timestamptz;
  v_dedup text;
  v_points_awarded int;
  v_blocked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  IF p_action NOT IN ('stamp','points','redeem') THEN
    RETURN jsonb_build_object('error', 'invalid_action');
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

  SELECT scanned_at INTO v_last_scan
  FROM qr_scans
  WHERE scanned_by = v_uid
  ORDER BY scanned_at DESC LIMIT 1;
  IF v_last_scan IS NOT NULL AND now() - v_last_scan < interval '60 seconds' THEN
    RETURN jsonb_build_object('error', 'rate_limited', 'retry_after', 60 - EXTRACT(epoch FROM (now() - v_last_scan))::int);
  END IF;

  v_points_awarded := GREATEST(0, p_points);
  v_dedup := v_customer::text || '-' || extract(epoch from now())::bigint::text;

  INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
  VALUES (v_customer, p_qr_code_id, p_store_id, p_action, v_points_awarded, v_dedup, v_uid);

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

-- ─── 4. B2B status notify — store_id in audit for RLS ───────
CREATE OR REPLACE FUNCTION public.b2b_notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_body text;
  v_from_label text;
  v_to_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_from_label := b2b_status_label(OLD.status);
    v_to_label := b2b_status_label(NEW.status);
    v_title := 'Sipariş: ' || v_to_label;
    v_body := NEW.order_number || ' — ' || v_from_label || ' → ' || v_to_label;

    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT ur.user_id, v_title, v_body, 'order',
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'status', NEW.status,
        'from_status', OLD.status,
        'to_status', NEW.status,
        'source', 'b2b',
        'store_id', NEW.store_id
      )
    FROM user_roles ur
    WHERE ur.store_id = NEW.store_id
      AND ur.role IN ('franchise', 'store_manager', 'staff');

    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'b2b_order_status_change',
      'b2b_order',
      NEW.id::text,
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'from_label', v_from_label,
        'to_label', v_to_label,
        'order_number', NEW.order_number,
        'store_id', NEW.store_id
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── 5. HQ RPCs — allow legacy admin role ───────────────────
CREATE OR REPLACE FUNCTION public.advance_b2b_order_status(
  p_order_id uuid,
  p_new_status text,
  p_tracking_no text DEFAULT '',
  p_carrier text DEFAULT '',
  p_eta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_valid_transitions text[];
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() AND NOT is_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  v_valid_transitions := ARRAY[
    ['paid','confirmed'], ['confirmed','preparing'],
    ['preparing','shipped'], ['shipped','delivered']
  ];

  IF NOT array[ARRAY[v_order.status, p_new_status]] <@ v_valid_transitions THEN
    RETURN jsonb_build_object('error', 'invalid_transition', 'from', v_order.status, 'to', p_new_status);
  END IF;

  IF p_new_status = 'shipped' AND COALESCE(NULLIF(TRIM(p_carrier), ''), NULLIF(TRIM(v_order.carrier_company), '')) IS NULL THEN
    RETURN jsonb_build_object('error', 'carrier_required');
  END IF;

  UPDATE b2b_orders
  SET status = p_new_status,
      tracking_number = CASE WHEN p_new_status = 'shipped' AND p_tracking_no <> '' THEN p_tracking_no ELSE tracking_number END,
      carrier_company = CASE WHEN p_new_status = 'shipped' AND p_carrier <> '' THEN p_carrier ELSE carrier_company END,
      tracking_url = CASE WHEN p_new_status = 'shipped' AND p_tracking_no <> '' THEN
        'https://www.google.com/search?q=' || COALESCE(NULLIF(p_carrier, ''), carrier_company) || '+' || p_tracking_no
      ELSE tracking_url END,
      estimated_delivery = CASE WHEN p_eta IS NOT NULL THEN p_eta ELSE estimated_delivery END,
      shipped_at = CASE WHEN p_new_status = 'shipped' THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
      confirmed_by = CASE WHEN p_new_status = 'confirmed' THEN v_uid ELSE confirmed_by END,
      confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'status', p_new_status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_b2b_order(
  p_order_id uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() AND NOT is_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF v_order.status NOT IN ('awaiting_payment', 'paid', 'confirmed', 'preparing') THEN
    RETURN jsonb_build_object('error', 'invalid_transition', 'from', v_order.status, 'to', 'cancelled');
  END IF;

  UPDATE b2b_orders
  SET status = 'cancelled',
      cancel_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Merkez tarafından iptal edildi'),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_order_rejected', 'b2b_order', p_order_id::text,
    jsonb_build_object('from', v_order.status, 'to', 'cancelled', 'reason', p_reason, 'order_number', v_order.order_number, 'store_id', v_order.store_id));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'status', 'cancelled');
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_b2b_shipping(
  p_order_id uuid,
  p_carrier text DEFAULT '',
  p_tracking_no text DEFAULT '',
  p_tracking_url text DEFAULT '',
  p_eta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_carrier text;
  v_tracking text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() AND NOT is_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  UPDATE b2b_orders
  SET carrier_company = CASE WHEN p_carrier <> '' THEN p_carrier ELSE carrier_company END,
      tracking_number = CASE WHEN p_tracking_no <> '' THEN p_tracking_no ELSE tracking_number END,
      tracking_url = CASE WHEN p_tracking_url <> '' THEN p_tracking_url
                          WHEN p_tracking_no <> '' THEN 'https://www.google.com/search?q=' || COALESCE(p_carrier, carrier_company) || '+' || p_tracking_no
                          ELSE tracking_url END,
      estimated_delivery = CASE WHEN p_eta IS NOT NULL THEN p_eta ELSE estimated_delivery END,
      updated_at = now()
  WHERE id = p_order_id;

  SELECT carrier_company, tracking_number INTO v_carrier, v_tracking
  FROM b2b_orders WHERE id = p_order_id;

  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Kargo Bilgisi Güncellendi',
         'Sipariş ' || v_order.order_number || ' kargo bilgileri güncellendi. Kargo: ' || COALESCE(v_carrier, '—') || ' Takip: ' || COALESCE(v_tracking, '—'),
         'order',
         jsonb_build_object('order_id', p_order_id, 'order_number', v_order.order_number, 'carrier', v_carrier, 'tracking_no', v_tracking, 'source', 'b2b_shipping', 'store_id', v_order.store_id)
  FROM user_roles ur
  WHERE ur.store_id = v_order.store_id
    AND ur.role IN ('franchise', 'store_manager', 'staff');

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_shipping_updated', 'b2b_order', p_order_id::text,
          jsonb_build_object('carrier', v_carrier, 'tracking_no', v_tracking, 'eta', p_eta, 'store_id', v_order.store_id));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_b2b_admin_note(
  p_order_id uuid,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_author text;
  v_entry text;
  v_ts text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() AND NOT is_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF COALESCE(NULLIF(TRIM(p_note), ''), '') = '' THEN
    RETURN jsonb_build_object('error', 'empty_note');
  END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Merkez') INTO v_author
  FROM profiles WHERE user_id = v_uid LIMIT 1;

  v_ts := to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI');
  v_entry := v_ts || ' · ' || v_author || E'\n' || TRIM(p_note);

  UPDATE b2b_orders
  SET admin_notes = CASE
    WHEN admin_notes = '' THEN v_entry
    ELSE admin_notes || E'\n\n---\n' || v_entry
  END,
  updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id,
    'Sipariş Notu — ' || v_order.order_number,
    v_author || ': ' || LEFT(TRIM(p_note), 120),
    'order',
    jsonb_build_object('order_id', p_order_id, 'order_number', v_order.order_number, 'source', 'b2b_admin_note', 'store_id', v_order.store_id)
  FROM user_roles ur
  WHERE ur.store_id = v_order.store_id
    AND ur.role IN ('franchise', 'store_manager');

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_admin_note_added', 'b2b_order', p_order_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'note', LEFT(TRIM(p_note), 200), 'store_id', v_order.store_id));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id);
END;
$function$;
