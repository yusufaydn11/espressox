/*
# Checkout benefit discount fixes

- _calc_single_item_discount: one free item (stamp, coffee reward, tier monthly)
- _find_best_campaign: happy_hour percent + bogo 50%
- preview_checkout: partial free items, r7 no discount, vip_benefit split
- create_order: tier_perk + vip_benefit reward redemption
- rewards r7 category points_boost (extends category check)
*/

UPDATE rewards SET category = 'points_boost' WHERE id = 'r7';

CREATE OR REPLACE FUNCTION public._calc_single_item_discount(
  p_items jsonb,
  p_max_lines int DEFAULT 1
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  v_item jsonb;
  v_product_id text;
  v_qty int;
  v_client_price numeric;
  v_db_price numeric;
  v_unit_price numeric;
  v_max_modifier numeric := 100;
  v_prices numeric[] := ARRAY[]::numeric[];
  v_discount numeric := 0;
  v_i int;
  v_limit int := GREATEST(COALESCE(p_max_lines, 1), 1);
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
    v_qty := GREATEST(COALESCE((v_item->>'qty')::int, 1), 1);
    v_client_price := (v_item->>'price')::numeric;
    v_unit_price := NULL;

    IF v_product_id IS NOT NULL THEN
      SELECT price INTO v_db_price FROM products WHERE id = v_product_id AND COALESCE(in_stock, true) = true;
      IF FOUND THEN
        IF v_client_price IS NULL OR v_client_price < v_db_price THEN
          v_unit_price := v_db_price;
        ELSIF v_client_price > v_db_price + v_max_modifier THEN
          v_unit_price := v_db_price;
        ELSE
          v_unit_price := v_client_price;
        END IF;
      END IF;
    END IF;

    IF v_unit_price IS NULL AND v_client_price IS NOT NULL THEN
      v_unit_price := v_client_price;
    END IF;

    IF v_unit_price IS NOT NULL AND v_unit_price > 0 THEN
      v_prices := array_append(v_prices, v_unit_price);
      IF v_qty > 1 THEN
        FOR v_i IN 2..LEAST(v_qty, v_limit) LOOP
          v_prices := array_append(v_prices, v_unit_price);
        END LOOP;
      END IF;
    END IF;
  END LOOP;

  IF COALESCE(array_length(v_prices, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(x), 0) INTO v_discount
  FROM (
    SELECT unnest(v_prices) AS x
    ORDER BY x DESC
    LIMIT v_limit
  ) s;

  RETURN ROUND(v_discount, 2);
END;
$function$;

CREATE OR REPLACE FUNCTION public._find_best_campaign(
  p_user_id uuid,
  p_store_id text,
  p_subtotal numeric,
  p_items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  v_c campaigns;
  v_best uuid;
  v_best_discount numeric := 0;
  v_discount numeric;
  v_profile profiles;
  v_dow int := EXTRACT(DOW FROM now())::int;
  v_hour int := EXTRACT(HOUR FROM now())::int;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  FOR v_c IN
    SELECT * FROM campaigns WHERE status = 'active'
      AND (start_date IS NULL OR start_date <= CURRENT_DATE)
      AND (end_date IS NULL OR end_date >= CURRENT_DATE)
      AND (store_id IS NULL OR store_id = p_store_id)
    ORDER BY discount_value DESC NULLS LAST
  LOOP
    IF COALESCE(array_length(v_c.days_of_week, 1), 0) > 0 AND NOT (v_dow = ANY(v_c.days_of_week)) THEN CONTINUE; END IF;
    IF v_c.hour_start IS NOT NULL AND v_hour < v_c.hour_start THEN CONTINUE; END IF;
    IF v_c.hour_end IS NOT NULL AND v_hour >= v_c.hour_end THEN CONTINUE; END IF;
    IF p_subtotal < COALESCE(v_c.min_order, 0) THEN CONTINUE; END IF;
    IF v_c.target_segment = 'vip' AND normalize_tier_name(v_profile.tier) NOT IN ('VIP','Siyah','Altın') THEN CONTINUE; END IF;
    IF v_c.target_segment = 'birthday' AND (v_profile.birthday IS NULL OR to_char(v_profile.birthday::date, 'MM-DD') <> to_char(CURRENT_DATE, 'MM-DD')) THEN CONTINUE; END IF;

    IF v_c.discount_type IN ('percent','happy_hour') THEN
      v_discount := ROUND(p_subtotal * COALESCE(v_c.discount_value,0) / 100, 2);
    ELSIF v_c.discount_type = 'fixed' THEN
      v_discount := LEAST(COALESCE(v_c.discount_value,0), p_subtotal);
    ELSIF v_c.discount_type = 'bogo' THEN
      v_discount := ROUND(p_subtotal * 0.5, 2);
    ELSE
      v_discount := LEAST(COALESCE(v_c.discount_value,0), p_subtotal);
    END IF;

    IF v_discount > v_best_discount THEN
      v_best_discount := v_discount;
      v_best := v_c.id;
    END IF;
  END LOOP;
  RETURN v_best;
END;
$function$;

CREATE OR REPLACE FUNCTION public._apply_reward_discount(
  p_reward_id text,
  p_reward_category text,
  p_benefit_title text,
  p_items jsonb,
  p_subtotal numeric,
  p_current_discount numeric
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $function$
DECLARE
  v_discount numeric := p_current_discount;
BEGIN
  IF p_reward_id IS NULL THEN RETURN v_discount; END IF;

  IF p_reward_id = 'r6' OR p_reward_category = 'size_upgrade'
     OR lower(COALESCE(p_benefit_title, '')) LIKE '%boy yükselt%' THEN
    v_discount := GREATEST(v_discount, _calc_size_upgrade_discount(p_items, 1));
  ELSIF p_reward_id = 'r7' OR p_reward_category = 'points_boost'
     OR lower(COALESCE(p_benefit_title, '')) LIKE '%puan%' THEN
    NULL;
  ELSIF p_reward_id = 'r3'
     OR (p_reward_category = 'discount' AND lower(COALESCE(p_benefit_title, '')) LIKE '%25%') THEN
    v_discount := GREATEST(v_discount, ROUND(p_subtotal * 0.25, 2));
  ELSIF p_reward_category = 'discount' THEN
    v_discount := GREATEST(v_discount, ROUND(p_subtotal * 0.10, 2));
  ELSIF p_reward_category = 'birthday' THEN
    v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 2));
  ELSIF p_reward_category IN ('coffee','dessert') THEN
    v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 1));
  ELSIF p_reward_category IN ('exclusive','vip') THEN
    v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 1));
  ELSE
    v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 1));
  END IF;

  RETURN v_discount;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_checkout_benefits(p_store_id text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_benefits jsonb := '[]'::jsonb;
  v_stamps int;
  v_profile profiles;
  v_r record;
  v_fcr record;
  v_c campaigns;
  v_discount_type text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  SELECT * INTO v_profile FROM profiles WHERE user_id = v_uid;

  SELECT count(*) INTO v_stamps FROM loyalty_stamps WHERE user_id = v_uid AND redeemed = false;
  IF v_stamps >= 5 THEN
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', 'free_coffee', 'id', 'stamp_card', 'title', 'Ücretsiz Kahve (5 Damga)',
      'detail', v_stamps || ' damga mevcut', 'discount_type', 'free_item'
    ));
  END IF;

  FOR v_fcr IN
    SELECT id, product_name, redeemed_at FROM free_coffee_redemptions
    WHERE user_id = v_uid AND order_id IS NULL ORDER BY redeemed_at DESC LIMIT 3
  LOOP
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', 'free_coffee', 'id', v_fcr.id::text, 'title', COALESCE(v_fcr.product_name, 'Ücretsiz Kahve'),
      'detail', 'Mağazada kazanıldı', 'discount_type', 'free_item'
    ));
  END LOOP;

  FOR v_r IN
    SELECT rr.id AS redemption_id, r.id AS reward_id, r.title, r.points_cost, r.category
    FROM reward_redemptions rr
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.user_id = v_uid AND rr.order_id IS NULL
    ORDER BY rr.redeemed_at DESC LIMIT 5
  LOOP
    v_discount_type := CASE
      WHEN v_r.reward_id = 'r6' OR v_r.category = 'size_upgrade' THEN 'size_upgrade'
      WHEN v_r.reward_id = 'r7' OR v_r.category = 'points_boost' THEN 'points_boost'
      WHEN v_r.category = 'discount' AND v_r.reward_id = 'r3' THEN 'percent_25'
      WHEN v_r.category = 'discount' THEN 'percent'
      WHEN v_r.category = 'birthday' THEN 'free_item'
      ELSE 'free_item'
    END;
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', CASE WHEN v_r.category = 'birthday' THEN 'birthday' WHEN v_r.category IN ('vip','exclusive') THEN 'vip_benefit' ELSE 'reward' END,
      'id', v_r.redemption_id::text,
      'reward_id', v_r.reward_id,
      'title', v_r.title,
      'detail', CASE WHEN v_r.points_cost > 0 THEN v_r.points_cost || ' puan' ELSE 'Ücretsiz ödül' END,
      'discount_type', v_discount_type
    ));
  END LOOP;

  IF normalize_tier_name(v_profile.tier) IN ('Altın','Siyah','VIP') THEN
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', 'vip_benefit', 'id', 'tier_monthly', 'title', 'Aylık Ücretsiz İçecek (' || v_profile.tier || ')',
      'detail', 'VIP avantajı', 'discount_type', 'free_item'
    ));
  END IF;

  IF normalize_tier_name(v_profile.tier) IN ('Gümüş','Altın','Siyah','VIP') THEN
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', 'tier_perk', 'id', 'tier_size_upgrade', 'title', 'Ücretsiz Boy Yükseltme (' || v_profile.tier || ')',
      'detail', 'Seviye avantajı — Büyük boy farkı indirilir', 'discount_type', 'size_upgrade'
    ));
  END IF;

  SELECT * INTO v_c FROM campaigns WHERE status = 'active'
    AND (store_id IS NULL OR store_id = p_store_id)
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  ORDER BY discount_value DESC NULLS LAST LIMIT 1;
  IF v_c.id IS NOT NULL THEN
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', 'campaign', 'id', v_c.id::text, 'title', COALESCE(v_c.title, v_c.name),
      'detail', COALESCE(v_c.discount_type, 'percent') || ' kampanyası', 'discount_type', v_c.discount_type
    ));
  END IF;

  RETURN jsonb_build_object('error', null, 'benefits', v_benefits, 'tier', v_profile.tier, 'points', v_profile.points);
END;
$function$;

CREATE OR REPLACE FUNCTION public.preview_checkout(
  p_items jsonb,
  p_store_id text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_benefit_type text DEFAULT NULL,
  p_benefit_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_subtotal numeric;
  v_discount numeric := 0;
  v_total numeric;
  v_coupon coupons;
  v_campaign_id uuid;
  v_campaign campaigns;
  v_profile profiles;
  v_points int;
  v_earn_rate numeric;
  v_multiplier numeric;
  v_benefit_title text;
  v_err jsonb;
  v_reward_id text;
  v_reward_category text;
  v_size_disc numeric;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RETURN jsonb_build_object('error', 'empty_cart'); END IF;

  BEGIN v_subtotal := _compute_cart_subtotal(p_items);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', 'price_tamper'); END;

  SELECT * INTO v_profile FROM profiles WHERE user_id = v_uid;
  v_discount := 0;
  v_benefit_title := NULL;

  IF p_benefit_type = 'free_coffee' THEN
    v_benefit_title := 'Ücretsiz Kahve';
    v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 1));
  ELSIF p_benefit_type IN ('reward','birthday') AND p_benefit_id IS NOT NULL THEN
    SELECT r.id, r.title, r.category INTO v_reward_id, v_benefit_title, v_reward_category
    FROM reward_redemptions rr
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id = p_benefit_id::uuid AND rr.user_id = v_uid AND rr.order_id IS NULL;
    IF v_reward_id IS NOT NULL THEN
      v_discount := _apply_reward_discount(v_reward_id, v_reward_category, v_benefit_title, p_items, v_subtotal, v_discount);
    END IF;
  ELSIF p_benefit_type = 'vip_benefit' AND p_benefit_id IS NOT NULL THEN
    IF p_benefit_id = 'tier_monthly' THEN
      IF normalize_tier_name(v_profile.tier) IN ('Altın','Siyah','VIP') THEN
        v_benefit_title := 'Aylık Ücretsiz İçecek';
        v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 1));
      END IF;
    ELSE
      SELECT r.id, r.title, r.category INTO v_reward_id, v_benefit_title, v_reward_category
      FROM reward_redemptions rr
      JOIN rewards r ON r.id = rr.reward_id
      WHERE rr.id = p_benefit_id::uuid AND rr.user_id = v_uid AND rr.order_id IS NULL;
      IF v_reward_id IS NOT NULL THEN
        v_discount := _apply_reward_discount(v_reward_id, v_reward_category, v_benefit_title, p_items, v_subtotal, v_discount);
      END IF;
    END IF;
  ELSIF p_benefit_type = 'tier_perk' AND p_benefit_id = 'tier_size_upgrade' THEN
    IF normalize_tier_name(v_profile.tier) IN ('Gümüş','Altın','Siyah','VIP') THEN
      v_benefit_title := 'Ücretsiz Boy Yükseltme';
      v_discount := GREATEST(v_discount, _calc_size_upgrade_discount(p_items, 1));
    END IF;
  END IF;

  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) <> '' THEN
    SELECT * INTO v_coupon FROM coupons WHERE UPPER(code) = UPPER(TRIM(p_coupon_code));
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'coupon_not_found'); END IF;
    v_err := _validate_coupon_rules(v_coupon, v_uid, p_store_id, v_subtotal, p_items);
    IF (v_err->>'error') IS NOT NULL THEN RETURN v_err; END IF;
    v_discount := GREATEST(v_discount, _calc_coupon_discount(v_coupon, v_subtotal));
    v_benefit_title := COALESCE(v_benefit_title, v_coupon.title);
  END IF;

  IF p_benefit_type = 'campaign' AND p_benefit_id IS NOT NULL THEN
    SELECT * INTO v_campaign FROM campaigns WHERE id = p_benefit_id::uuid AND status = 'active';
    IF FOUND THEN
      IF v_campaign.discount_type IN ('percent','happy_hour') THEN
        v_discount := GREATEST(v_discount, ROUND(v_subtotal * COALESCE(v_campaign.discount_value,0)/100,2));
      ELSIF v_campaign.discount_type = 'bogo' THEN
        v_discount := GREATEST(v_discount, ROUND(v_subtotal * 0.5, 2));
      ELSE
        v_discount := GREATEST(v_discount, LEAST(COALESCE(v_campaign.discount_value,0), v_subtotal));
      END IF;
      v_benefit_title := COALESCE(v_benefit_title, v_campaign.title);
    END IF;
  ELSIF p_benefit_type IS NULL OR p_benefit_type = 'none' THEN
    v_campaign_id := _find_best_campaign(v_uid, p_store_id, v_subtotal, p_items);
    IF v_campaign_id IS NOT NULL THEN
      SELECT * INTO v_campaign FROM campaigns WHERE id = v_campaign_id;
      IF v_campaign.discount_type IN ('percent','happy_hour') THEN
        v_discount := GREATEST(v_discount, ROUND(v_subtotal * COALESCE(v_campaign.discount_value,0)/100,2));
      ELSIF v_campaign.discount_type = 'bogo' THEN
        v_discount := GREATEST(v_discount, ROUND(v_subtotal * 0.5, 2));
      ELSE
        v_discount := GREATEST(v_discount, LEAST(COALESCE(v_campaign.discount_value,0), v_subtotal));
      END IF;
      v_benefit_title := COALESCE(v_benefit_title, v_campaign.title);
    END IF;

    IF normalize_tier_name(v_profile.tier) IN ('Gümüş','Altın','Siyah','VIP') THEN
      v_size_disc := _calc_size_upgrade_discount(p_items, 1);
      IF v_size_disc > 0 THEN
        v_discount := GREATEST(v_discount, v_size_disc);
        v_benefit_title := COALESCE(v_benefit_title, 'Seviye avantajı: Ücretsiz boy yükseltme');
      END IF;
    END IF;
  END IF;

  v_discount := LEAST(v_discount, v_subtotal);
  v_total := GREATEST(0, v_subtotal - v_discount);

  SELECT COALESCE(earn_rate, 0.2) INTO v_earn_rate FROM loyalty_settings LIMIT 1;
  v_multiplier := get_tier_earn_multiplier(v_profile.tier);
  v_points := CASE WHEN v_total = 0 THEN 0 ELSE GREATEST(0, ROUND(v_total * v_earn_rate * v_multiplier))::int END;

  RETURN jsonb_build_object(
    'error', null, 'subtotal', v_subtotal, 'discount', v_discount, 'total', v_total,
    'points_earned', v_points, 'earn_multiplier', v_multiplier,
    'benefit_title', v_benefit_title,
    'campaign_id', v_campaign_id
  );
END;
$function$;

-- create_order: tier_perk + vip reward redemption validation
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
    IF p_benefit_id = 'tier_monthly' THEN
      v_billing_type := 'vip_benefit';
      v_benefit_source := 'tier';
      v_benefit_title := COALESCE(v_benefit_title, 'Aylık Ücretsiz İçecek');
      IF normalize_tier_name(v_profile.tier) NOT IN ('Altın','Siyah','VIP') THEN
        RETURN jsonb_build_object('error', 'tier_benefit_not_available');
      END IF;
    ELSE
      SELECT rr.reward_id, r.title, r.points_cost INTO v_reward_id, v_benefit_title, v_points_spent
      FROM reward_redemptions rr JOIN rewards r ON r.id = rr.reward_id
      WHERE rr.id = p_benefit_id::uuid AND rr.user_id = v_uid AND rr.order_id IS NULL
      FOR UPDATE OF rr;
      IF v_reward_id IS NULL THEN RETURN jsonb_build_object('error', 'reward_not_available'); END IF;
      v_billing_type := 'vip_benefit';
      v_benefit_source := 'reward';
    END IF;
  ELSIF p_benefit_type = 'tier_perk' AND p_benefit_id = 'tier_size_upgrade' THEN
    IF normalize_tier_name(v_profile.tier) NOT IN ('Gümüş','Altın','Siyah','VIP') THEN
      RETURN jsonb_build_object('error', 'tier_benefit_not_available');
    END IF;
    v_billing_type := 'reward';
    v_benefit_source := 'tier';
    v_benefit_title := COALESCE(v_benefit_title, 'Ücretsiz Boy Yükseltme');
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
    v_benefit_source, v_benefit_title, p_payment_method, p_payment_status,
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
  ELSIF p_benefit_type = 'vip_benefit' AND p_benefit_id IS NOT NULL AND p_benefit_id <> 'tier_monthly' THEN
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

GRANT EXECUTE ON FUNCTION public._calc_single_item_discount(jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public._apply_reward_discount(text, text, text, jsonb, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public._find_best_campaign(uuid, text, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_benefits(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_checkout(jsonb, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, numeric, text, text, text, text, text, text, text) TO authenticated;
