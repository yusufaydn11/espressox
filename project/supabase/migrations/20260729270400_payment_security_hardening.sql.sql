/*
# FAZ 0 — Payment Security Hardening (Retail)
- create_order: card/wallet/cash → payment_pending until server confirmation
- Revoke client access to record_order_payment
- confirm_cash_payment: staff-only cash confirmation
- confirm_order_payment_webhook: service-role webhook RPC (idempotent, amount check)
- order_payments RLS: customer INSERT/UPDATE removed
*/

-- ─── 1. create_order — payment pending for all non-zero totals ─────────────

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
      IF NOT EXISTS (SELECT 1 FROM free_coffee_redemptions WHERE id = p_benefit_id::uuid AND user_id = v_uid AND order_id IS NULL) THEN
        RETURN jsonb_build_object('error', 'free_coffee_not_available');
      END IF;
    END IF;
  ELSIF p_benefit_type IN ('reward','birthday') AND p_benefit_id IS NOT NULL THEN
    SELECT rr.reward_id, r.title, r.points_cost INTO v_reward_id, v_benefit_title, v_points_spent
    FROM reward_redemptions rr JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id = p_benefit_id::uuid AND rr.user_id = v_uid AND rr.order_id IS NULL;
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

  -- FAZ 0: require server-side confirmation for any non-zero payment
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
    SELECT price INTO v_db_price FROM products WHERE id = v_product_id;
    IF v_client_price IS NULL OR v_client_price < v_db_price THEN
      v_unit_price := v_db_price;
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

-- ─── 2. Revoke client access to record_order_payment ─────────────────────────

REVOKE ALL ON FUNCTION public.record_order_payment(text, text, text, text, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_order_payment(text, text, text, text, numeric) FROM anon, authenticated;

-- ─── 3. Staff-only cash payment confirmation ───────────────────────────────

CREATE OR REPLACE FUNCTION public.confirm_cash_payment(
  p_order_number text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order orders;
  v_payment order_payments;
  v_prev_status text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;

  SELECT * INTO v_order FROM orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  IF NOT is_admin() AND NOT has_store_access(v_order.store_id) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF v_order.payment_method <> 'cash' THEN
    RETURN jsonb_build_object('error', 'not_cash_order');
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'error', null, 'order_number', p_order_number,
      'payment_status', 'paid', 'status', v_order.status, 'idempotent', true
    );
  END IF;

  IF v_order.status IN ('cancelled','refunded','completed','delivered') THEN
    RETURN jsonb_build_object('error', 'order_finalized');
  END IF;

  v_prev_status := v_order.status;

  SELECT * INTO v_payment FROM order_payments WHERE order_id = v_order.id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'payment_not_found'); END IF;

  UPDATE order_payments SET payment_status = 'paid', updated_at = now() WHERE id = v_payment.id;

  UPDATE orders SET
    payment_status = 'paid',
    status = CASE WHEN status IN ('payment_pending','created') THEN 'confirmed' ELSE status END,
    updated_at = now()
  WHERE id = v_order.id;

  IF v_prev_status IN ('payment_pending','created') THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (v_order.id, v_prev_status, 'confirmed', v_uid, COALESCE(p_note, 'cash_payment_confirmed'));

    INSERT INTO notifications (user_id, title, body, type)
    VALUES (v_order.user_id, 'Odeme onaylandi',
      v_order.order_number || ' numarali siparisiniz onaylandi.', 'order');
  END IF;

  RETURN jsonb_build_object(
    'error', null, 'order_number', p_order_number,
    'payment_status', 'paid', 'status', 'confirmed'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.confirm_cash_payment(text, text) TO authenticated;

-- ─── 4. Server-side webhook confirmation (service-role only) ─────────────────

CREATE OR REPLACE FUNCTION public.confirm_order_payment_webhook(
  p_order_number text,
  p_amount numeric,
  p_transaction_id text DEFAULT NULL,
  p_currency text DEFAULT 'TRY',
  p_gateway text DEFAULT 'internal',
  p_payment_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_order orders;
  v_payment order_payments;
  v_prev_status text;
BEGIN
  IF p_order_number IS NULL OR TRIM(p_order_number) = '' THEN
    RETURN jsonb_build_object('error', 'order_number_required');
  END IF;
  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;
  IF p_currency IS NOT NULL AND TRIM(p_currency) <> '' AND upper(TRIM(p_currency)) NOT IN ('TRY','TL') THEN
    RETURN jsonb_build_object('error', 'unsupported_currency');
  END IF;

  SELECT * INTO v_order FROM orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  -- Idempotent: already confirmed and paid
  IF v_order.payment_status = 'paid' THEN
    RETURN jsonb_build_object(
      'error', null, 'order_number', p_order_number,
      'payment_status', 'paid', 'status', v_order.status, 'idempotent', true
    );
  END IF;

  IF v_order.status IN ('cancelled','refunded') THEN
    RETURN jsonb_build_object('error', 'order_cancelled');
  END IF;

  IF p_amount <> v_order.total THEN
    RETURN jsonb_build_object(
      'error', 'amount_mismatch', 'expected', v_order.total, 'received', p_amount
    );
  END IF;

  v_prev_status := v_order.status;

  IF p_payment_id IS NOT NULL THEN
    SELECT * INTO v_payment FROM order_payments WHERE id = p_payment_id AND order_id = v_order.id FOR UPDATE;
  ELSE
    SELECT * INTO v_payment FROM order_payments WHERE order_id = v_order.id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  END IF;

  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'payment_not_found'); END IF;

  IF p_amount <> v_payment.amount THEN
    RETURN jsonb_build_object(
      'error', 'amount_mismatch', 'expected', v_payment.amount, 'received', p_amount
    );
  END IF;

  UPDATE order_payments SET
    payment_status = 'paid',
    transaction_id = COALESCE(p_transaction_id, transaction_id),
    gateway = COALESCE(NULLIF(p_gateway, ''), gateway),
    updated_at = now()
  WHERE id = v_payment.id;

  UPDATE orders SET
    payment_status = 'paid',
    status = CASE WHEN status IN ('payment_pending','created') THEN 'confirmed' ELSE status END,
    transaction_id = COALESCE(p_transaction_id, transaction_id),
    payment_gateway = COALESCE(NULLIF(p_gateway, ''), payment_gateway),
    updated_at = now()
  WHERE id = v_order.id;

  IF v_prev_status IN ('payment_pending','created') THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (v_order.id, v_prev_status, 'confirmed', NULL, 'payment_webhook');

    INSERT INTO notifications (user_id, title, body, type)
    VALUES (v_order.user_id, 'Odeme onaylandi',
      v_order.order_number || ' numarali siparisiniz onaylandi.', 'order');
  END IF;

  RETURN jsonb_build_object(
    'error', null, 'order_number', p_order_number,
    'payment_status', 'paid', 'status', 'confirmed', 'payment_id', v_payment.id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.confirm_order_payment_webhook(text, numeric, text, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_order_payment_webhook(text, numeric, text, text, text, uuid) FROM anon, authenticated;

-- ─── 5. order_payments RLS — customer cannot mutate ──────────────────────────

DROP POLICY IF EXISTS "order_payments_insert_own" ON order_payments;

DROP POLICY IF EXISTS "order_payments_update_internal" ON order_payments;
CREATE POLICY "order_payments_update_internal" ON order_payments FOR UPDATE TO authenticated
  USING (is_internal())
  WITH CHECK (is_internal());

DROP POLICY IF EXISTS "order_payments_select_store" ON order_payments;
CREATE POLICY "order_payments_select_store" ON order_payments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = order_payments.order_id AND has_store_access(o.store_id)
  ));
