/*
# preview_checkout — normalize empty params, safe UUID, SQL errors → JSON (fix HTTP 400)
*/

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
  v_benefit_type text := NULLIF(TRIM(COALESCE(p_benefit_type, '')), '');
  v_benefit_id text := NULLIF(TRIM(COALESCE(p_benefit_id, '')), '');
  v_coupon_code text := NULLIF(TRIM(COALESCE(p_coupon_code, '')), '');
  v_benefit_uuid uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RETURN jsonb_build_object('error', 'empty_cart'); END IF;

  BEGIN v_subtotal := _compute_cart_subtotal(p_items);
  EXCEPTION WHEN OTHERS THEN RETURN jsonb_build_object('error', 'price_tamper'); END;

  IF v_subtotal <= 0 THEN
    RETURN jsonb_build_object('error', 'product_unavailable');
  END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = v_uid;
  v_discount := 0;
  v_benefit_title := NULL;

  IF v_benefit_type = 'free_coffee' THEN
    v_benefit_title := 'Ücretsiz Kahve';
    v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 1));
  ELSIF v_benefit_type IN ('reward','birthday') AND v_benefit_id IS NOT NULL THEN
    v_benefit_uuid := safe_text_uuid(v_benefit_id);
    IF v_benefit_uuid IS NOT NULL THEN
      SELECT r.id, r.title, r.category INTO v_reward_id, v_benefit_title, v_reward_category
      FROM reward_redemptions rr
      JOIN rewards r ON r.id = rr.reward_id
      WHERE rr.id = v_benefit_uuid AND rr.user_id = v_uid AND rr.order_id IS NULL;
      IF v_reward_id IS NOT NULL THEN
        v_discount := _apply_reward_discount(v_reward_id, v_reward_category, v_benefit_title, p_items, v_subtotal, v_discount);
      END IF;
    END IF;
  ELSIF v_benefit_type = 'vip_benefit' AND v_benefit_id IS NOT NULL THEN
    IF v_benefit_id = 'tier_monthly' THEN
      IF normalize_tier_name(v_profile.tier) IN ('Altın','Siyah','VIP') THEN
        v_benefit_title := 'Aylık Ücretsiz İçecek';
        v_discount := GREATEST(v_discount, _calc_single_item_discount(p_items, 1));
      END IF;
    ELSE
      v_benefit_uuid := safe_text_uuid(v_benefit_id);
      IF v_benefit_uuid IS NOT NULL THEN
        SELECT r.id, r.title, r.category INTO v_reward_id, v_benefit_title, v_reward_category
        FROM reward_redemptions rr
        JOIN rewards r ON r.id = rr.reward_id
        WHERE rr.id = v_benefit_uuid AND rr.user_id = v_uid AND rr.order_id IS NULL;
        IF v_reward_id IS NOT NULL THEN
          v_discount := _apply_reward_discount(v_reward_id, v_reward_category, v_benefit_title, p_items, v_subtotal, v_discount);
        END IF;
      END IF;
    END IF;
  ELSIF v_benefit_type = 'tier_perk' AND v_benefit_id = 'tier_size_upgrade' THEN
    IF normalize_tier_name(v_profile.tier) IN ('Gümüş','Altın','Siyah','VIP') THEN
      v_benefit_title := 'Ücretsiz Boy Yükseltme';
      v_discount := GREATEST(v_discount, _calc_size_upgrade_discount(p_items, 1));
    END IF;
  END IF;

  IF v_coupon_code IS NOT NULL THEN
    SELECT * INTO v_coupon FROM coupons WHERE UPPER(code) = UPPER(v_coupon_code);
    IF NOT FOUND THEN RETURN jsonb_build_object('error', 'coupon_not_found'); END IF;
    v_err := _validate_coupon_rules(v_coupon, v_uid, p_store_id, v_subtotal, p_items);
    IF (v_err->>'error') IS NOT NULL THEN RETURN v_err; END IF;
    v_discount := GREATEST(v_discount, _calc_coupon_discount(v_coupon, v_subtotal));
    v_benefit_title := COALESCE(v_benefit_title, v_coupon.title);
  END IF;

  IF v_benefit_type = 'campaign' AND v_benefit_id IS NOT NULL THEN
    v_benefit_uuid := safe_text_uuid(v_benefit_id);
    IF v_benefit_uuid IS NOT NULL THEN
      SELECT * INTO v_campaign FROM campaigns WHERE id = v_benefit_uuid AND status = 'active';
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
    END IF;
  ELSIF v_benefit_type IS NULL OR v_benefit_type = 'none' THEN
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
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'preview_failed', 'detail', SQLERRM, 'sqlstate', SQLSTATE);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.preview_checkout(jsonb, text, text, text, text) TO authenticated;
