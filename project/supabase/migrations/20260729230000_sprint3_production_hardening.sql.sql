/*
# Sprint 3 — Production Hardening

- create_order: compute total server-side from products table; ignore client p_total for billing/points
- qr_scan: enforce points cap from loyalty_settings; store validation; stamp uses config points
*/

-- ─── create_order — server-side total ─────────────────────────
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
  v_computed_total numeric := 0;
  v_qty int;
  v_product_id text;
  v_client_price numeric;
  v_db_price numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_max_modifier numeric := 100;
  v_item_count int;
  v_items jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  v_items := p_items;
  IF jsonb_typeof(v_items) = 'string' THEN
    BEGIN
      v_items := (v_items #>> '{}')::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RETURN jsonb_build_object('error', 'empty_cart');
    END;
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  IF p_order_type NOT IN ('pickup','table','delivery','scheduled') THEN
    RETURN jsonb_build_object('error', 'invalid_order_type');
  END IF;

  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' THEN
    RETURN jsonb_build_object('error', 'empty_cart');
  END IF;

  v_item_count := jsonb_array_length(v_items);
  IF v_item_count = 0 THEN
    RETURN jsonb_build_object('error', 'empty_cart');
  END IF;
  IF v_item_count > 50 THEN
    RETURN jsonb_build_object('error', 'cart_too_large');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
    v_qty := (v_item->>'qty')::int;
    v_client_price := (v_item->>'price')::numeric;

    IF v_product_id IS NULL THEN
      RETURN jsonb_build_object('error', 'missing_product_id');
    END IF;
    IF v_qty IS NULL OR v_qty < 1 OR v_qty > 99 THEN
      RETURN jsonb_build_object('error', 'invalid_quantity', 'product_id', v_product_id);
    END IF;

    SELECT price INTO v_db_price
    FROM products
    WHERE id = v_product_id AND in_stock = true;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'product_unavailable', 'product_id', v_product_id);
    END IF;

    IF v_client_price IS NULL OR v_client_price < v_db_price THEN
      v_unit_price := v_db_price;
    ELSIF v_client_price > v_db_price + v_max_modifier THEN
      RETURN jsonb_build_object('error', 'price_tamper', 'product_id', v_product_id);
    ELSE
      v_unit_price := v_client_price;
    END IF;

    v_line_total := v_unit_price * v_qty;
    v_computed_total := v_computed_total + v_line_total;
  END LOOP;

  IF v_computed_total <= 0 OR v_computed_total > 100000 THEN
    RETURN jsonb_build_object('error', 'invalid_total');
  END IF;

  SELECT COALESCE(earn_rate, 0.2) INTO v_earn_rate FROM loyalty_settings LIMIT 1;
  IF v_earn_rate IS NULL THEN v_earn_rate := 0.2; END IF;

  v_order_number := 'EX-' || nextval('order_number_seq')::text;
  v_points := GREATEST(0, ROUND(v_computed_total * v_earn_rate))::int;

  INSERT INTO orders (order_number, user_id, status, order_type, store_id, store_name, total, points_earned)
  VALUES (v_order_number, v_uid, 'preparing', p_order_type, p_store_id, p_store_name, v_computed_total, v_points)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
    v_qty := (v_item->>'qty')::int;
    v_client_price := (v_item->>'price')::numeric;

    SELECT price INTO v_db_price FROM products WHERE id = v_product_id;
    IF v_client_price IS NULL OR v_client_price < v_db_price THEN
      v_unit_price := v_db_price;
    ELSIF v_client_price > v_db_price + v_max_modifier THEN
      v_unit_price := v_db_price;
    ELSE
      v_unit_price := v_client_price;
    END IF;

    INSERT INTO order_items (order_id, product_id, name, quantity, unit_price)
    VALUES (
      v_order_id,
      v_product_id,
      v_item->>'name',
      v_qty,
      v_unit_price
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
    'total', v_computed_total,
    'points_earned', v_points,
    'error', null
  );
END;
$function$;

-- ─── qr_scan — point cap + validations ──────────────────────
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
  WHERE scanned_by = v_uid
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
