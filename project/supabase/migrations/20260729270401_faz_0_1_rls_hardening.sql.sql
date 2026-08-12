/*
# FAZ 0.1 — RLS & Client Write Hardening
- Remove direct customer INSERT on orders / order_items (force create_order RPC)
- Block client manipulation of profiles.points, orders.payment_status, etc. via triggers
- Revoke customer write on loyalty_stamps, reward_redemptions, points_history, free_coffee_redemptions
- Narrow coupons / QR / inventory read policies for store isolation
- Harden lookup_qr_for_scan + block self-scan abuse in qr_scan
- Revoke spend_points from authenticated clients
- create_order: reward redemption FOR UPDATE + reject out-of-stock line items
*/

-- ─── 1. Guard triggers (column-level protection) ─────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_profiles_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF CURRENT_USER NOT IN ('authenticated', 'anon') THEN
      RETURN NEW;
    END IF;
    IF NOT is_admin() THEN
      IF NEW.points IS DISTINCT FROM OLD.points
         OR NEW.lifetime_points IS DISTINCT FROM OLD.lifetime_points
         OR NEW.tier IS DISTINCT FROM OLD.tier
         OR NEW.reward_wallet IS DISTINCT FROM OLD.reward_wallet
         OR NEW.wallet_credits IS DISTINCT FROM OLD.wallet_credits
         OR NEW.streak IS DISTINCT FROM OLD.streak
         OR NEW.is_blocked IS DISTINCT FROM OLD.is_blocked
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
      THEN
        RAISE EXCEPTION 'profiles_sensitive_update_forbidden' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_guard_profiles_sensitive ON profiles;
CREATE TRIGGER tr_guard_profiles_sensitive
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profiles_sensitive_columns();

CREATE OR REPLACE FUNCTION public.guard_orders_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF CURRENT_USER NOT IN ('authenticated', 'anon') THEN
      RETURN NEW;
    END IF;

    IF NOT is_admin() THEN
      IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
         OR NEW.total IS DISTINCT FROM OLD.total
         OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
         OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
         OR NEW.points_earned IS DISTINCT FROM OLD.points_earned
         OR NEW.points_spent IS DISTINCT FROM OLD.points_spent
         OR NEW.user_id IS DISTINCT FROM OLD.user_id
         OR NEW.store_id IS DISTINCT FROM OLD.store_id
         OR NEW.transaction_id IS DISTINCT FROM OLD.transaction_id
         OR NEW.payment_gateway IS DISTINCT FROM OLD.payment_gateway
      THEN
        RAISE EXCEPTION 'orders_sensitive_update_forbidden' USING ERRCODE = '42501';
      END IF;
    END IF;

    IF (is_franchise() OR is_store_manager() OR is_staff()) AND NOT is_admin() THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
      THEN
        RAISE EXCEPTION 'orders_use_rpc_for_status' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS tr_guard_orders_sensitive ON orders;
CREATE TRIGGER tr_guard_orders_sensitive
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION guard_orders_sensitive_columns();

-- ─── 2. Orders — no direct client INSERT / staff direct UPDATE ───────────────

DROP POLICY IF EXISTS "orders_insert_own" ON orders;
DROP POLICY IF EXISTS "orders_update_store_fm" ON orders;

DROP POLICY IF EXISTS "order_items_insert_own" ON order_items;

-- ─── 3. Loyalty — customer cannot write balances / stamps / redemptions ─────

DROP POLICY IF EXISTS "loyalty_stamps_insert_own" ON loyalty_stamps;
DROP POLICY IF EXISTS "loyalty_stamps_update_own" ON loyalty_stamps;

DROP POLICY IF EXISTS "points_history_insert_own" ON points_history;

DROP POLICY IF EXISTS "reward_redemptions_insert_own" ON reward_redemptions;
DROP POLICY IF EXISTS "reward_redemptions_update_own" ON reward_redemptions;

DROP POLICY IF EXISTS "free_coffee_redemptions_insert_own" ON free_coffee_redemptions;
DROP POLICY IF EXISTS "free_coffee_redemptions_update_own" ON free_coffee_redemptions;

-- ─── 4. Coupons — store-scoped read for internal roles ───────────────────────

DROP POLICY IF EXISTS "coupons_select_internal" ON coupons;

DROP POLICY IF EXISTS "coupons_select_admin" ON coupons;
CREATE POLICY "coupons_select_admin" ON coupons
  FOR SELECT TO authenticated
  USING (is_admin());

-- coupons_select_store (from RBAC migration) remains for franchise/store roles

-- ─── 5. QR codes — no network-wide table scan for staff ─────────────────────

DROP POLICY IF EXISTS "qr_codes_select_scanner" ON qr_codes;

-- Staff resolve codes via lookup_qr_for_scan (SECURITY DEFINER) only.

-- ─── 6. Inventory — HQ admin read; store roles via store_stock ───────────────

DROP POLICY IF EXISTS "inventory_items_select_internal" ON inventory_items;

DROP POLICY IF EXISTS "inventory_items_select_admin" ON inventory_items;
CREATE POLICY "inventory_items_select_admin" ON inventory_items
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "inventory_items_select_store" ON inventory_items;
CREATE POLICY "inventory_items_select_store" ON inventory_items
  FOR SELECT TO authenticated
  USING (
    is_internal()
    AND NOT is_admin()
    AND EXISTS (
      SELECT 1 FROM store_stock ss
      WHERE ss.item_id = inventory_items.id
        AND has_store_access(ss.store_id)
    )
  );

-- ─── 7. Revoke client spend_points (add_points already revoked in C-03) ────

REVOKE EXECUTE ON FUNCTION public.spend_points(integer, text) FROM anon, authenticated;

-- ─── 8. lookup_qr_for_scan — require store access for non-HQ ─────────────────

CREATE OR REPLACE FUNCTION public.lookup_qr_for_scan(
  p_code text,
  p_store_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
  v_row qr_codes%ROWTYPE;
  v_code text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  IF NOT is_internal() THEN
    RETURN jsonb_build_object('error', 'not_owner');
  END IF;

  IF NOT is_admin() AND NOT is_super_admin() THEN
    IF p_store_id IS NULL OR TRIM(p_store_id) = '' THEN
      RETURN jsonb_build_object('error', 'store_required');
    END IF;
    IF NOT has_store_access(p_store_id) THEN
      RETURN jsonb_build_object('error', 'unauthorized');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM stores WHERE id = p_store_id) THEN
      RETURN jsonb_build_object('error', 'store_not_found');
    END IF;
  END IF;

  v_code := upper(trim(p_code));
  IF v_code = '' OR v_code NOT LIKE 'EX-%' THEN
    RETURN jsonb_build_object('error', 'invalid_code');
  END IF;

  SELECT * INTO v_row
  FROM qr_codes
  WHERE code = v_code AND is_active = true
  LIMIT 1;

  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('error', 'qr_not_found');
  END IF;

  RETURN jsonb_build_object(
    'error', null,
    'id', v_row.id,
    'user_id', v_row.user_id,
    'code', v_row.code
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.lookup_qr_for_scan(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_qr_for_scan(text, text) TO authenticated;

-- Drop old single-arg signature if present
DROP FUNCTION IF EXISTS public.lookup_qr_for_scan(text);

-- ─── 9. qr_scan — block self-scan point farming ──────────────────────────────

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

-- ─── 10. create_order — reward lock + out-of-stock guard ─────────────────────

CREATE OR REPLACE FUNCTION public.create_order(
  p_items jsonb,
  p_total numeric,
  p_store_id text DEFAULT NULL::text,
  p_store_name text DEFAULT ''::text,
  p_order_type text DEFAULT 'pickup'::text,
  p_payment_method text DEFAULT 'card'::text,
  p_coupon_code text DEFAULT NULL::text,
  p_benefit_type text DEFAULT NULL::text,
  p_benefit_id text DEFAULT NULL::text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_points int;
  v_item jsonb;
  v_blocked boolean;
  v_subtotal numeric;
  v_discount numeric := 0;
  v_computed_total numeric;
  v_preview jsonb;
  v_billing_type text := 'standard';
  v_benefit_source text := NULL;
  v_benefit_title text := NULL;
  v_reward_id text := NULL;
  v_coupon_id uuid := NULL;
  v_campaign_id uuid := NULL;
  v_points_spent int := 0;
  v_coupon coupons;
  v_payment_status text;
  v_initial_status text;
  v_franchise_id uuid;
  v_stamps int;
  v_profile profiles;
  v_qty int;
  v_product_id text;
  v_client_price numeric;
  v_db_price numeric;
  v_unit_price numeric;
  v_max_modifier numeric := 100;
  v_items jsonb;
  v_in_stock boolean;
  v_free_coffee_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;

  v_items := p_items;
  IF jsonb_typeof(v_items) = 'string' THEN
    BEGIN v_items := (v_items #>> '{}')::jsonb;
    EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', 'empty_cart'); END;
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN RETURN jsonb_build_object('error', 'account_blocked'); END IF;
  IF p_order_type NOT IN ('pickup','table','delivery','scheduled') THEN RETURN jsonb_build_object('error', 'invalid_order_type'); END IF;
  IF v_items IS NULL OR jsonb_typeof(v_items) <> 'array' OR jsonb_array_length(v_items) = 0 THEN
    RETURN jsonb_build_object('error', 'empty_cart');
  END IF;
  IF jsonb_array_length(v_items) > 50 THEN RETURN jsonb_build_object('error', 'cart_too_large'); END IF;

  BEGIN v_subtotal := _compute_cart_subtotal(v_items);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', 'price_tamper'); END;
  IF v_subtotal <= 0 OR v_subtotal > 100000 THEN RETURN jsonb_build_object('error', 'invalid_total'); END IF;

  v_preview := preview_checkout(v_items, p_store_id, p_coupon_code, p_benefit_type, p_benefit_id);
  IF (v_preview->>'error') IS NOT NULL THEN RETURN v_preview; END IF;

  v_subtotal := (v_preview->>'subtotal')::numeric;
  v_discount := (v_preview->>'discount')::numeric;
  v_computed_total := (v_preview->>'total')::numeric;
  v_points := (v_preview->>'points_earned')::int;
  v_benefit_title := v_preview->>'benefit_title';
  v_campaign_id := NULLIF(v_preview->>'campaign_id', '')::uuid;

  SELECT * INTO v_profile FROM profiles WHERE user_id = v_uid;

  IF p_benefit_type = 'free_coffee' THEN
    v_billing_type := 'free_coffee';
    v_benefit_source := 'stamp_card';
    v_benefit_title := COALESCE(v_benefit_title, 'Ücretsiz Kahve');
    IF p_benefit_id = 'stamp_card' OR p_benefit_id IS NULL THEN
      SELECT count(*) INTO v_stamps FROM loyalty_stamps WHERE user_id = v_uid AND redeemed = false;
      IF v_stamps < 5 THEN RETURN jsonb_build_object('error', 'insufficient_stamps'); END IF;
      UPDATE loyalty_stamps SET redeemed = true WHERE id IN (
        SELECT id FROM loyalty_stamps WHERE user_id = v_uid AND redeemed = false ORDER BY stamped_at ASC LIMIT 5
      );
    ELSE
      SELECT id INTO v_free_coffee_id FROM free_coffee_redemptions
      WHERE id = p_benefit_id::uuid AND user_id = v_uid AND order_id IS NULL
      FOR UPDATE;
      IF v_free_coffee_id IS NULL THEN
        RETURN jsonb_build_object('error', 'free_coffee_not_available');
      END IF;
    END IF;
  ELSIF p_benefit_type IN ('reward','birthday') AND p_benefit_id IS NOT NULL THEN
    SELECT rr.reward_id, r.title, r.points_cost INTO v_reward_id, v_benefit_title, v_points_spent
    FROM reward_redemptions rr JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id = p_benefit_id::uuid AND rr.user_id = v_uid AND rr.order_id IS NULL
    FOR UPDATE OF rr;
    IF v_reward_id IS NULL THEN RETURN jsonb_build_object('error', 'reward_not_available'); END IF;
    v_billing_type := CASE WHEN p_benefit_type = 'birthday' THEN 'birthday' ELSE 'reward' END;
    v_benefit_source := 'reward';
  ELSIF p_benefit_type = 'vip_benefit' THEN
    v_billing_type := 'vip_benefit';
    v_benefit_source := 'tier';
    v_benefit_title := COALESCE(v_benefit_title, 'VIP Avantajı');
    IF normalize_tier_name(v_profile.tier) NOT IN ('Altın','Siyah','VIP') THEN
      RETURN jsonb_build_object('error', 'tier_benefit_not_available');
    END IF;
  ELSIF p_benefit_type = 'campaign' AND p_benefit_id IS NOT NULL THEN
    v_campaign_id := p_benefit_id::uuid;
    v_billing_type := 'campaign';
    v_benefit_source := 'campaign';
  END IF;

  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_coupon_code)) FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'coupon_not_found'); END IF;
    IF (_validate_coupon_rules(v_coupon, v_uid, p_store_id, v_subtotal, v_items)->>'error') IS NOT NULL THEN
      RETURN _validate_coupon_rules(v_coupon, v_uid, p_store_id, v_subtotal, v_items);
    END IF;
    v_coupon_id := v_coupon.id;
    IF v_billing_type = 'standard' THEN v_billing_type := 'coupon'; v_benefit_source := 'coupon'; END IF;
    v_benefit_title := COALESCE(v_benefit_title, v_coupon.title);
  END IF;

  IF v_campaign_id IS NOT NULL AND v_billing_type = 'standard' THEN
    v_billing_type := 'campaign';
    v_benefit_source := 'campaign';
    SELECT title INTO v_benefit_title FROM campaigns WHERE id = v_campaign_id;
  END IF;

  IF v_discount > 0 AND v_computed_total = 0 AND v_billing_type = 'standard' THEN
    v_billing_type := 'campaign';
    v_benefit_source := 'campaign';
  END IF;

  IF p_payment_method NOT IN ('card','wallet','cash','apple_pay','google_pay') THEN
    RETURN jsonb_build_object('error', 'invalid_payment_method');
  END IF;

  IF v_computed_total = 0 THEN
    v_payment_status := 'paid';
    v_initial_status := 'confirmed';
  ELSE
    v_payment_status := 'pending';
    v_initial_status := 'payment_pending';
  END IF;

  SELECT franchise_id INTO v_franchise_id FROM stores WHERE id = p_store_id;
  v_order_number := 'EX-' || nextval('order_number_seq')::text;

  INSERT INTO orders (
    order_number, user_id, status, order_type, store_id, store_name,
    subtotal, discount_amount, total, points_earned, points_spent,
    billing_type, reward_id, coupon_id, campaign_id,
    benefit_source, benefit_title, payment_method, payment_status,
    payment_gateway, franchise_id
  ) VALUES (
    v_order_number, v_uid, v_initial_status, p_order_type, p_store_id, p_store_name,
    v_subtotal, v_discount, v_computed_total, v_points, v_points_spent,
    v_billing_type, v_reward_id, v_coupon_id, v_campaign_id,
    v_benefit_source, v_benefit_title, p_payment_method, v_payment_status,
    'internal', v_franchise_id
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
    v_qty := (v_item->>'qty')::int;
    v_client_price := (v_item->>'price')::numeric;
    IF v_product_id IS NOT NULL THEN
      SELECT price, COALESCE(in_stock, true) INTO v_db_price, v_in_stock
      FROM products WHERE id = v_product_id;
      IF NOT FOUND OR NOT v_in_stock THEN
        RETURN jsonb_build_object('error', 'product_unavailable');
      END IF;
    ELSE
      v_db_price := NULL;
    END IF;
    IF v_client_price IS NULL OR v_db_price IS NULL OR v_client_price < v_db_price THEN
      v_unit_price := COALESCE(v_db_price, v_client_price);
    ELSIF v_client_price > v_db_price + v_max_modifier THEN
      v_unit_price := v_db_price;
    ELSE
      v_unit_price := v_client_price;
    END IF;
    INSERT INTO order_items (order_id, product_id, name, quantity, unit_price)
    VALUES (v_order_id, v_product_id, v_item->>'name', v_qty, v_unit_price);
  END LOOP;

  IF p_benefit_type = 'free_coffee' AND p_benefit_id IS NOT NULL AND p_benefit_id <> 'stamp_card' THEN
    UPDATE free_coffee_redemptions SET order_id = v_order_id WHERE id = p_benefit_id::uuid AND user_id = v_uid;
  ELSIF p_benefit_type IN ('reward','birthday') AND p_benefit_id IS NOT NULL THEN
    UPDATE reward_redemptions SET order_id = v_order_id WHERE id = p_benefit_id::uuid AND user_id = v_uid;
  ELSIF p_benefit_type = 'free_coffee' AND (p_benefit_id = 'stamp_card' OR p_benefit_id IS NULL) THEN
    INSERT INTO free_coffee_redemptions (user_id, store_id, product_name, redeemed_by, order_id)
    VALUES (v_uid, p_store_id, 'Ücretsiz Kahve (Checkout)', v_uid, v_order_id);
  END IF;

  IF v_coupon_id IS NOT NULL THEN
    UPDATE coupons SET redemptions_count = redemptions_count + 1 WHERE id = v_coupon_id;
    INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, store_id, discount_amount)
    VALUES (v_coupon_id, v_uid, v_order_id, p_store_id, v_discount);
  END IF;

  IF v_campaign_id IS NOT NULL AND v_discount > 0 THEN
    INSERT INTO campaign_applications (campaign_id, user_id, order_id, store_id, discount_amount)
    VALUES (v_campaign_id, v_uid, v_order_id, p_store_id, v_discount);
  END IF;

  IF v_points > 0 THEN
    UPDATE profiles SET points = points + v_points, lifetime_points = lifetime_points + v_points WHERE user_id = v_uid;
    INSERT INTO points_history (user_id, title, points, type, store_id)
    VALUES (v_uid, 'Siparis ' || v_order_number, v_points, 'earn', p_store_id);
    PERFORM recalc_profile_tier(v_uid);
  END IF;

  INSERT INTO order_payments (order_id, amount, payment_method, payment_status, gateway)
  VALUES (v_order_id, v_computed_total, p_payment_method, v_payment_status, 'internal');

  INSERT INTO order_status_history (order_id, from_status, to_status, changed_by)
  VALUES (v_order_id, NULL, v_initial_status, v_uid);

  IF v_initial_status = 'payment_pending' THEN
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (v_uid, 'Siparisiniz olusturuldu',
      v_order_number || ' numarali siparisiniz olusturuldu. Odeme onayi bekleniyor.', 'order');
  ELSE
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (v_uid, 'Siparisiniz alindi',
      v_order_number || ' numarali siparisiniz onaylandi.', 'order');
  END IF;

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'subtotal', v_subtotal, 'discount', v_discount, 'total', v_computed_total,
    'points_earned', v_points, 'billing_type', v_billing_type,
    'benefit_title', v_benefit_title, 'payment_status', v_payment_status,
    'status', v_initial_status,
    'error', null
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(jsonb, numeric, text, text, text, text, text, text, text) TO authenticated;
