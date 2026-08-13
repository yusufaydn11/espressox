/*
# Defer loyalty points until store/payment confirmation (not at order placement)
*/

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS points_credited boolean NOT NULL DEFAULT false;

-- Backfill: orders that already received points at checkout
UPDATE orders o
SET points_credited = true
WHERE COALESCE(o.points_earned, 0) > 0
  AND EXISTS (
    SELECT 1 FROM points_history ph
    WHERE ph.user_id = o.user_id
      AND ph.title = 'Siparis ' || o.order_number
      AND ph.type = 'earn'
      AND ph.points > 0
  );

CREATE OR REPLACE FUNCTION public.credit_order_loyalty_points(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND OR v_order.points_credited OR COALESCE(v_order.points_earned, 0) <= 0 THEN
    RETURN;
  END IF;
  IF v_order.user_id IS NULL THEN RETURN; END IF;

  UPDATE profiles SET
    points = points + v_order.points_earned,
    lifetime_points = lifetime_points + v_order.points_earned
  WHERE user_id = v_order.user_id;

  INSERT INTO points_history (user_id, title, points, type, store_id)
  VALUES (v_order.user_id, 'Siparis ' || v_order.order_number, v_order.points_earned, 'earn', v_order.store_id);

  UPDATE orders SET points_credited = true, updated_at = now() WHERE id = p_order_id;
  PERFORM recalc_profile_tier(v_order.user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_order_loyalty_points(uuid) TO authenticated;

-- create_order: store points_earned on order row only; do not credit profile yet
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
  v_max_modifier numeric := 1000;
  v_items jsonb;
  v_in_stock boolean;
  v_free_coffee_id uuid;
  v_benefit_type text := NULLIF(TRIM(p_benefit_type), '');
  v_benefit_id text := NULLIF(TRIM(p_benefit_id), '');
  v_coupon_code text := NULLIF(TRIM(p_coupon_code), '');
  v_benefit_uuid uuid;
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

  v_preview := preview_checkout(v_items, p_store_id, v_coupon_code, v_benefit_type, v_benefit_id);
  IF (v_preview->>'error') IS NOT NULL THEN RETURN v_preview; END IF;

  v_subtotal := (v_preview->>'subtotal')::numeric;
  v_discount := (v_preview->>'discount')::numeric;
  v_computed_total := (v_preview->>'total')::numeric;
  v_points := (v_preview->>'points_earned')::int;
  v_benefit_title := v_preview->>'benefit_title';
  v_campaign_id := safe_text_uuid(v_preview->>'campaign_id');

  SELECT * INTO v_profile FROM profiles WHERE user_id = v_uid;

  IF v_benefit_type = 'free_coffee' THEN
    v_billing_type := 'free_coffee';
    v_benefit_source := 'stamp_card';
    v_benefit_title := COALESCE(v_benefit_title, 'Ücretsiz Kahve');
    IF v_benefit_id = 'stamp_card' OR v_benefit_id IS NULL THEN
      SELECT count(*) INTO v_stamps FROM loyalty_stamps WHERE user_id = v_uid AND redeemed = false;
      IF v_stamps < 5 THEN RETURN jsonb_build_object('error', 'insufficient_stamps'); END IF;
      UPDATE loyalty_stamps SET redeemed = true WHERE id IN (
        SELECT id FROM loyalty_stamps WHERE user_id = v_uid AND redeemed = false ORDER BY stamped_at ASC LIMIT 5
      );
    ELSE
      v_benefit_uuid := safe_text_uuid(v_benefit_id);
      IF v_benefit_uuid IS NULL THEN RETURN jsonb_build_object('error', 'free_coffee_not_available'); END IF;
      SELECT id INTO v_free_coffee_id FROM free_coffee_redemptions
      WHERE id = v_benefit_uuid AND user_id = v_uid AND order_id IS NULL
      FOR UPDATE;
      IF v_free_coffee_id IS NULL THEN
        RETURN jsonb_build_object('error', 'free_coffee_not_available');
      END IF;
    END IF;
  ELSIF v_benefit_type IN ('reward','birthday') AND v_benefit_id IS NOT NULL THEN
    v_benefit_uuid := safe_text_uuid(v_benefit_id);
    IF v_benefit_uuid IS NULL THEN RETURN jsonb_build_object('error', 'reward_not_available'); END IF;
    SELECT rr.reward_id, r.title, r.points_cost INTO v_reward_id, v_benefit_title, v_points_spent
    FROM reward_redemptions rr JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id = v_benefit_uuid AND rr.user_id = v_uid AND rr.order_id IS NULL
    FOR UPDATE OF rr;
    IF v_reward_id IS NULL THEN RETURN jsonb_build_object('error', 'reward_not_available'); END IF;
    v_billing_type := CASE WHEN v_benefit_type = 'birthday' THEN 'birthday' ELSE 'reward' END;
    v_benefit_source := 'reward';
  ELSIF v_benefit_type = 'vip_benefit' THEN
    IF v_benefit_id = 'tier_monthly' THEN
      v_billing_type := 'vip_benefit';
      v_benefit_source := 'tier';
      v_benefit_title := COALESCE(v_benefit_title, 'Aylık Ücretsiz İçecek');
      IF normalize_tier_name(v_profile.tier) NOT IN ('Altın','Siyah','VIP') THEN
        RETURN jsonb_build_object('error', 'tier_benefit_not_available');
      END IF;
    ELSE
      v_benefit_uuid := safe_text_uuid(v_benefit_id);
      IF v_benefit_uuid IS NULL THEN RETURN jsonb_build_object('error', 'reward_not_available'); END IF;
      SELECT rr.reward_id, r.title, r.points_cost INTO v_reward_id, v_benefit_title, v_points_spent
      FROM reward_redemptions rr JOIN rewards r ON r.id = rr.reward_id
      WHERE rr.id = v_benefit_uuid AND rr.user_id = v_uid AND rr.order_id IS NULL
      FOR UPDATE OF rr;
      IF v_reward_id IS NULL THEN RETURN jsonb_build_object('error', 'reward_not_available'); END IF;
      v_billing_type := 'vip_benefit';
      v_benefit_source := 'reward';
    END IF;
  ELSIF v_benefit_type = 'tier_perk' AND v_benefit_id = 'tier_size_upgrade' THEN
    IF normalize_tier_name(v_profile.tier) NOT IN ('Gümüş','Altın','Siyah','VIP') THEN
      RETURN jsonb_build_object('error', 'tier_benefit_not_available');
    END IF;
    v_billing_type := 'reward';
    v_benefit_source := 'tier';
    v_benefit_title := COALESCE(v_benefit_title, 'Ücretsiz Boy Yükseltme');
  ELSIF v_benefit_type = 'campaign' AND v_benefit_id IS NOT NULL THEN
    v_campaign_id := safe_text_uuid(v_benefit_id);
    IF v_campaign_id IS NULL THEN RETURN jsonb_build_object('error', 'campaign_not_available'); END IF;
    v_billing_type := 'campaign';
    v_benefit_source := 'campaign';
  END IF;

  IF v_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM coupons WHERE UPPER(code) = UPPER(v_coupon_code) FOR UPDATE;
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
    subtotal, discount_amount, total, points_earned, points_spent, points_credited,
    billing_type, reward_id, coupon_id, campaign_id,
    benefit_source, benefit_title, payment_method, payment_status,
    payment_gateway, franchise_id
  ) VALUES (
    v_order_number, v_uid, v_initial_status, p_order_type, p_store_id, p_store_name,
    v_subtotal, v_discount, v_computed_total, v_points, v_points_spent, false,
    v_billing_type, v_reward_id, v_coupon_id, v_campaign_id,
    v_benefit_source, v_benefit_title, p_payment_method, v_payment_status,
    'internal', v_franchise_id
  ) RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_items) LOOP
    v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
    v_qty := GREATEST(COALESCE((v_item->>'qty')::int, 1), 1);
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

  IF v_benefit_type = 'free_coffee' AND v_benefit_id IS NOT NULL AND v_benefit_id <> 'stamp_card' THEN
    UPDATE free_coffee_redemptions SET order_id = v_order_id WHERE id = safe_text_uuid(v_benefit_id) AND user_id = v_uid;
  ELSIF v_benefit_type IN ('reward','birthday') AND v_benefit_uuid IS NOT NULL THEN
    UPDATE reward_redemptions SET order_id = v_order_id WHERE id = v_benefit_uuid AND user_id = v_uid;
  ELSIF v_benefit_type = 'vip_benefit' AND v_benefit_id IS NOT NULL AND v_benefit_id <> 'tier_monthly' AND v_benefit_uuid IS NOT NULL THEN
    UPDATE reward_redemptions SET order_id = v_order_id WHERE id = v_benefit_uuid AND user_id = v_uid;
  ELSIF v_benefit_type = 'free_coffee' AND (v_benefit_id = 'stamp_card' OR v_benefit_id IS NULL) THEN
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
    'status', v_initial_status, 'points_credited', false,
    'error', null
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'order_failed', 'detail', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

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
    PERFORM credit_order_loyalty_points(v_order.id);
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

  PERFORM credit_order_loyalty_points(v_order.id);

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
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    RETURN jsonb_build_object('error', 'forbidden');
  END IF;

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

  IF v_order.payment_status = 'paid' THEN
    PERFORM credit_order_loyalty_points(v_order.id);
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

  PERFORM credit_order_loyalty_points(v_order.id);

  IF v_prev_status IN ('payment_pending','created') THEN
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
    VALUES (v_order.id, v_prev_status, 'confirmed', NULL, 'payment_webhook');

    IF v_order.user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, title, body, type)
      VALUES (v_order.user_id, 'Odeme onaylandi',
        v_order.order_number || ' numarali siparisiniz onaylandi.', 'order');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'error', null, 'order_number', p_order_number,
    'payment_status', 'paid', 'status', 'confirmed', 'payment_id', v_payment.id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_order_status(
  p_order_number text,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order orders;
  v_allowed boolean := false;
  v_notify_title text;
  v_notify_body text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF p_new_status NOT IN ('preparing','ready','courier','picked-up','delivered','completed','cancelled') THEN
    RETURN jsonb_build_object('error', 'invalid_status');
  END IF;

  SELECT * INTO v_order FROM orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  v_allowed := is_admin() OR has_store_access(v_order.store_id);
  IF NOT v_allowed THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
  VALUES (v_order.id, v_order.status, p_new_status, v_uid, p_note);

  UPDATE orders SET status = p_new_status, updated_at = now() WHERE id = v_order.id;

  IF p_new_status = 'preparing' THEN
    PERFORM credit_order_loyalty_points(v_order.id);
  END IF;

  v_notify_title := CASE p_new_status
    WHEN 'preparing' THEN 'Siparisiniz hazirlaniyor'
    WHEN 'ready' THEN 'Siparisiniz hazir!'
    WHEN 'courier' THEN 'Kurye yolda'
    WHEN 'delivered' THEN 'Teslim edildi'
    WHEN 'picked-up' THEN 'Teslim alindi'
    WHEN 'cancelled' THEN 'Siparis iptal edildi'
    ELSE 'Siparis guncellendi'
  END;
  v_notify_body := v_order.order_number || ' — ' || v_notify_title;

  INSERT INTO notifications (user_id, title, body, type)
  VALUES (v_order.user_id, v_notify_title, v_notify_body, 'order');

  RETURN jsonb_build_object('error', null, 'status', p_new_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_number text, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order orders;
  v_can_cancel boolean := false;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;

  SELECT * INTO v_order FROM orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  v_can_cancel := (v_order.user_id = v_uid AND v_order.status IN ('created','payment_pending','confirmed','preparing'))
    OR is_admin() OR has_store_access(v_order.store_id);
  IF NOT v_can_cancel THEN RETURN jsonb_build_object('error', 'cancel_not_allowed'); END IF;
  IF v_order.status IN ('cancelled','refunded','completed','delivered') THEN
    RETURN jsonb_build_object('error', 'already_finalized');
  END IF;

  IF v_order.points_credited AND COALESCE(v_order.points_earned, 0) > 0 THEN
    UPDATE profiles SET points = GREATEST(0, points - v_order.points_earned),
      lifetime_points = GREATEST(0, lifetime_points - v_order.points_earned)
    WHERE user_id = v_order.user_id;
    INSERT INTO points_history (user_id, title, points, type, store_id)
    VALUES (v_order.user_id, 'Iptal: ' || v_order.order_number, -v_order.points_earned, 'redeem', v_order.store_id);
    UPDATE orders SET points_credited = false WHERE id = v_order.id;
  END IF;

  IF v_order.points_spent > 0 THEN
    UPDATE profiles SET points = points + v_order.points_spent WHERE user_id = v_order.user_id;
    INSERT INTO points_history (user_id, title, points, type, store_id)
    VALUES (v_order.user_id, 'Iade: ' || v_order.order_number, v_order.points_spent, 'bonus', v_order.store_id);
  END IF;

  UPDATE reward_redemptions SET order_id = NULL WHERE order_id = v_order.id;
  UPDATE free_coffee_redemptions SET order_id = NULL WHERE order_id = v_order.id;

  IF v_order.billing_type = 'free_coffee' AND v_order.benefit_source = 'stamp_card' THEN
    UPDATE loyalty_stamps SET redeemed = false WHERE id IN (
      SELECT id FROM loyalty_stamps WHERE user_id = v_order.user_id
        AND redeemed = true AND stamped_at >= v_order.created_at - interval '5 minutes'
      ORDER BY stamped_at DESC LIMIT 5
    );
  END IF;

  IF v_order.coupon_id IS NOT NULL THEN
    UPDATE coupons SET redemptions_count = GREATEST(0, redemptions_count - 1) WHERE id = v_order.coupon_id;
    DELETE FROM coupon_redemptions WHERE order_id = v_order.id;
  END IF;

  DELETE FROM campaign_applications WHERE order_id = v_order.id;

  UPDATE orders SET status = 'cancelled', payment_status = CASE
    WHEN payment_status = 'paid' THEN 'refunded' ELSE payment_status END,
    updated_at = now()
  WHERE id = v_order.id;

  UPDATE order_payments SET payment_status = 'refunded', refund_amount = amount WHERE order_id = v_order.id;

  INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, note)
  VALUES (v_order.id, v_order.status, 'cancelled', v_uid, p_reason);

  INSERT INTO notifications (user_id, title, body, type)
  VALUES (v_order.user_id, 'Siparis iptal edildi', v_order.order_number || ' numarali siparisiniz iptal edildi.', 'order');

  RETURN jsonb_build_object('error', null, 'order_number', p_order_number);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_cash_payment(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_order_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(text, text) TO authenticated;
