/*
# Checkout — size upgrade rewards, tier perk, campaign discounts

- _calc_size_upgrade_discount: partial discount for Büyük boy (+10) lines
- preview_checkout: r6 / tier Gümüş+ boy yükseltme; r3 %25; not full-order for size upgrade
- get_checkout_benefits: discount_type hints for UI
*/

ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_category_check;
ALTER TABLE rewards ADD CONSTRAINT rewards_category_check CHECK (
  category IN ('coffee','dessert','discount','exclusive','birthday','size_upgrade','points_boost','vip')
);

UPDATE rewards SET category = 'size_upgrade' WHERE id = 'r6';

CREATE OR REPLACE FUNCTION public._calc_size_upgrade_discount(
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
  v_name text;
  v_qty int;
  v_sizes jsonb;
  v_size_label text;
  v_base_modifier numeric := 0;
  v_item_modifier numeric := 0;
  v_discount numeric := 0;
  v_lines int := 0;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    EXIT WHEN v_lines >= GREATEST(p_max_lines, 1);
    v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
    v_qty := GREATEST(COALESCE((v_item->>'qty')::int, 1), 1);
    v_name := COALESCE(v_item->>'name', '');
    v_item_modifier := 0;

    IF v_item ? 'sizeModifier' AND (v_item->>'sizeModifier') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
      v_item_modifier := GREATEST((v_item->>'sizeModifier')::numeric, 0);
    ELSIF v_product_id IS NOT NULL THEN
      SELECT sizes INTO v_sizes FROM products WHERE id = v_product_id;
      IF v_sizes IS NOT NULL THEN
        SELECT COALESCE(MIN((s->>'priceModifier')::numeric), 0) INTO v_base_modifier
        FROM jsonb_array_elements(v_sizes) s;
        v_size_label := TRIM(split_part(split_part(v_name, ' — ', 2), ',', 1));
        SELECT COALESCE((s->>'priceModifier')::numeric, 0) INTO v_item_modifier
        FROM jsonb_array_elements(v_sizes) s
        WHERE TRIM(s->>'label') = v_size_label
        LIMIT 1;
        v_item_modifier := GREATEST(v_item_modifier - v_base_modifier, 0);
      END IF;
    END IF;

    IF v_item_modifier > 0 THEN
      v_discount := v_discount + v_item_modifier * LEAST(v_qty, 1);
      v_lines := v_lines + 1;
    END IF;
  END LOOP;

  RETURN ROUND(v_discount, 2);
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
      WHEN v_r.category = 'discount' AND v_r.reward_id = 'r3' THEN 'percent_25'
      WHEN v_r.category = 'discount' THEN 'percent'
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
    v_discount := v_subtotal;
    v_benefit_title := 'Ücretsiz Kahve';
  ELSIF p_benefit_type IN ('reward','birthday') AND p_benefit_id IS NOT NULL THEN
    SELECT r.id, r.title, r.category INTO v_reward_id, v_benefit_title, v_reward_category
    FROM reward_redemptions rr
    JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id = p_benefit_id::uuid AND rr.user_id = v_uid AND rr.order_id IS NULL;
    IF v_reward_id IS NOT NULL THEN
      IF v_reward_id = 'r6' OR v_reward_category = 'size_upgrade'
         OR lower(v_benefit_title) LIKE '%boy yükselt%' THEN
        v_discount := GREATEST(v_discount, _calc_size_upgrade_discount(p_items, 1));
      ELSIF v_reward_id = 'r3' OR (v_reward_category = 'discount' AND lower(v_benefit_title) LIKE '%25%') THEN
        v_discount := GREATEST(v_discount, ROUND(v_subtotal * 0.25, 2));
      ELSIF v_reward_category = 'discount' THEN
        v_discount := GREATEST(v_discount, ROUND(v_subtotal * 0.10, 2));
      ELSE
        v_discount := GREATEST(v_discount, v_subtotal);
      END IF;
    END IF;
  ELSIF p_benefit_type = 'vip_benefit' AND p_benefit_id IS NOT NULL THEN
    v_benefit_title := 'VIP Avantajı';
    v_discount := v_subtotal;
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

GRANT EXECUTE ON FUNCTION public._calc_size_upgrade_discount(jsonb, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_checkout_benefits(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_checkout(jsonb, text, text, text, text) TO authenticated;
