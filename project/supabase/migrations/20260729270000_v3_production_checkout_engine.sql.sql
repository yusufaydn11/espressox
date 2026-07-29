/*
# V3 Production Checkout Engine
- Orders: billing_type, benefit fields, payment fields, extended statuses
- Coupons: extended rules + coupon_redemptions
- Campaigns: discount engine + campaign_applications
- Retail payments: order_payments
- Order lifecycle: advance_order_status, cancel_order with loyalty reversal
- QR: rotation + expiration
- Checkout RPCs: get_checkout_benefits, preview_checkout, create_order v4
*/

-- ═══════════════════════════════════════════════════════════════
-- 1. SCHEMA EXTENSIONS
-- ═══════════════════════════════════════════════════════════════

-- Orders: benefit + payment columns
ALTER TABLE orders ADD COLUMN IF NOT EXISTS billing_type text NOT NULL DEFAULT 'standard'
  CHECK (billing_type IN ('standard','free_coffee','reward','coupon','campaign','vip_benefit','birthday','points'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reward_id text REFERENCES rewards(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES coupons(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES campaigns(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS points_spent integer NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS benefit_source text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS benefit_title text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal numeric(10,2) NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'card'
  CHECK (payment_method IS NULL OR payment_method IN ('card','wallet','cash','apple_pay','google_pay'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'paid'
  CHECK (payment_status IN ('pending','authorized','paid','failed','refunded','partial_refund'));
ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_gateway text DEFAULT 'internal';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS franchise_id uuid REFERENCES franchises(id);

-- Extend order status lifecycle
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN (
  'created','payment_pending','confirmed','preparing','ready','courier',
  'picked-up','delivered','scheduled','cancelled','refunded','completed'
));

CREATE INDEX IF NOT EXISTS idx_orders_billing_type ON orders(billing_type);
CREATE INDEX IF NOT EXISTS idx_orders_coupon_id ON orders(coupon_id);
CREATE INDEX IF NOT EXISTS idx_orders_campaign_id ON orders(campaign_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

-- Link redemptions to orders
ALTER TABLE reward_redemptions ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id);
ALTER TABLE free_coffee_redemptions ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reward_redemptions_order_unique ON reward_redemptions(order_id) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_fcr_order_unique ON free_coffee_redemptions(order_id) WHERE order_id IS NOT NULL;

-- Coupons: extended rules
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS per_user_limit integer DEFAULT 1;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS product_ids text[] DEFAULT '{}';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS category_ids text[] DEFAULT '{}';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS franchise_id uuid REFERENCES franchises(id);
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS days_of_week integer[] DEFAULT '{}';
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS hour_start integer;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS hour_end integer;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS first_order_only boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS new_customer_only boolean NOT NULL DEFAULT false;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS tier_required text;

-- Campaigns: discount engine
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS discount_type text DEFAULT 'percent'
  CHECK (discount_type IS NULL OR discount_type IN ('percent','fixed','bogo','bxgy','happy_hour'));
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS discount_value numeric DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS min_order numeric DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS product_ids text[] DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category_ids text[] DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS franchise_id uuid REFERENCES franchises(id);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS days_of_week integer[] DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS hour_start integer;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS hour_end integer;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS rules jsonb DEFAULT '{}';

-- QR rotation
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS rotation_count integer NOT NULL DEFAULT 0;

-- Coupon redemptions log
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  store_id text REFERENCES stores(id),
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  redeemed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_coupon ON coupon_redemptions(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order ON coupon_redemptions(order_id);

-- Campaign applications log
CREATE TABLE IF NOT EXISTS campaign_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  store_id text REFERENCES stores(id),
  discount_amount numeric(10,2) NOT NULL DEFAULT 0,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE campaign_applications ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_campaign_applications_campaign ON campaign_applications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_applications_user ON campaign_applications(user_id);

-- Retail payments
CREATE TABLE IF NOT EXISTS order_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL,
  payment_method text NOT NULL DEFAULT 'card',
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending','authorized','paid','failed','refunded','partial_refund')),
  transaction_id text,
  gateway text DEFAULT 'internal',
  refund_amount numeric(10,2) DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_payments_order ON order_payments(order_id);

-- Order status history
CREATE TABLE IF NOT EXISTS order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

-- RLS for new tables
CREATE POLICY "coupon_redemptions_select_own" ON coupon_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin() OR has_store_access(store_id));
CREATE POLICY "coupon_redemptions_select_internal" ON coupon_redemptions FOR SELECT TO authenticated
  USING (is_internal());
CREATE POLICY "coupon_redemptions_insert_system" ON coupon_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "campaign_applications_select_own" ON campaign_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin() OR has_store_access(store_id));
CREATE POLICY "campaign_applications_select_internal" ON campaign_applications FOR SELECT TO authenticated
  USING (is_internal());
CREATE POLICY "campaign_applications_insert_system" ON campaign_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "order_payments_select_own" ON order_payments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_payments.order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_payments_select_internal" ON order_payments FOR SELECT TO authenticated
  USING (is_internal());
CREATE POLICY "order_payments_insert_own" ON order_payments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_payments.order_id AND o.user_id = auth.uid()));

CREATE POLICY "order_status_history_select_own" ON order_status_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_status_history.order_id AND o.user_id = auth.uid()));
CREATE POLICY "order_status_history_select_internal" ON order_status_history FOR SELECT TO authenticated
  USING (is_internal());

-- Customers can validate coupons via RPC only; allow read active coupons by code lookup in RPC (SECURITY DEFINER)
CREATE POLICY "coupons_select_active_by_code" ON coupons FOR SELECT TO authenticated
  USING (is_active = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at >= now()));

-- ═══════════════════════════════════════════════════════════════
-- 2. HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.normalize_tier_name(p_tier text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_tier ILIKE '%gümüş%' OR p_tier ILIKE '%gumus%' OR p_tier ILIKE '%silver%' THEN 'Gümüş'
    WHEN p_tier ILIKE '%altın%' OR p_tier ILIKE '%altin%' OR p_tier ILIKE '%gold%' THEN 'Altın'
    WHEN p_tier ILIKE '%siyah%' OR p_tier ILIKE '%black%' OR p_tier ILIKE '%platinum%' THEN 'Siyah'
    WHEN p_tier ILIKE '%vip%' OR p_tier ILIKE '%premium%' THEN 'VIP'
    ELSE 'Bronz'
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_tier_earn_multiplier(p_tier text)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE v_tier text := normalize_tier_name(p_tier);
BEGIN
  IF v_tier = 'Gümüş' AND EXTRACT(DOW FROM now()) = 2 THEN RETURN 2.0; END IF;
  IF v_tier = 'Altın' THEN RETURN 1.5; END IF;
  IF v_tier = 'Siyah' THEN RETURN 2.0; END IF;
  IF v_tier = 'VIP' THEN RETURN 3.0; END IF;
  RETURN 1.0;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_profile_tier(p_user_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_lp int;
  v_old text;
  v_new text;
BEGIN
  SELECT lifetime_points, tier INTO v_lp, v_old FROM profiles WHERE user_id = p_user_id;
  v_new := CASE
    WHEN v_lp >= 15000 THEN 'VIP'
    WHEN v_lp >= 7000 THEN 'Siyah'
    WHEN v_lp >= 3000 THEN 'Altın'
    WHEN v_lp >= 1000 THEN 'Gümüş'
    ELSE 'Bronz'
  END;
  IF v_new <> COALESCE(v_old, 'Bronz') THEN
    UPDATE profiles SET tier = v_new WHERE user_id = p_user_id;
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (p_user_id, 'Seviye yükseldin!', 'Tebrikler! Yeni seviyen: ' || v_new, 'loyalty');
  END IF;
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public._compute_cart_subtotal(p_items jsonb)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_item jsonb;
  v_total numeric := 0;
  v_qty int;
  v_product_id text;
  v_client_price numeric;
  v_db_price numeric;
  v_unit_price numeric;
  v_max_modifier numeric := 100;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
    v_qty := (v_item->>'qty')::int;
    v_client_price := (v_item->>'price')::numeric;
    IF v_product_id IS NULL OR v_qty IS NULL OR v_qty < 1 THEN CONTINUE; END IF;
    SELECT price INTO v_db_price FROM products WHERE id = v_product_id AND in_stock = true;
    IF NOT FOUND THEN CONTINUE; END IF;
    IF v_client_price IS NULL OR v_client_price < v_db_price THEN
      v_unit_price := v_db_price;
    ELSIF v_client_price > v_db_price + v_max_modifier THEN
      RAISE EXCEPTION 'price_tamper';
    ELSE
      v_unit_price := v_client_price;
    END IF;
    v_total := v_total + v_unit_price * v_qty;
  END LOOP;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public._validate_coupon_rules(
  p_coupon coupons,
  p_user_id uuid,
  p_store_id text,
  p_subtotal numeric,
  p_items jsonb
)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_profile profiles;
  v_order_count int;
  v_user_uses int;
  v_dow int := EXTRACT(DOW FROM now())::int;
  v_hour int := EXTRACT(HOUR FROM now())::int;
  v_item jsonb;
  v_product_id text;
  v_cat text;
  v_match boolean := false;
BEGIN
  IF NOT p_coupon.is_active THEN RETURN jsonb_build_object('error', 'coupon_inactive'); END IF;
  IF p_coupon.starts_at IS NOT NULL AND p_coupon.starts_at > now() THEN RETURN jsonb_build_object('error', 'coupon_not_started'); END IF;
  IF p_coupon.ends_at IS NOT NULL AND p_coupon.ends_at < now() THEN RETURN jsonb_build_object('error', 'coupon_expired'); END IF;
  IF p_coupon.max_redemptions IS NOT NULL AND p_coupon.redemptions_count >= p_coupon.max_redemptions THEN
    RETURN jsonb_build_object('error', 'coupon_exhausted');
  END IF;
  IF p_subtotal < COALESCE(p_coupon.min_order, 0) THEN RETURN jsonb_build_object('error', 'coupon_min_order'); END IF;
  IF p_coupon.store_id IS NOT NULL AND p_coupon.store_id <> COALESCE(p_store_id, '') THEN
    RETURN jsonb_build_object('error', 'coupon_store_mismatch');
  END IF;
  IF COALESCE(array_length(p_coupon.days_of_week, 1), 0) > 0 AND NOT (v_dow = ANY(p_coupon.days_of_week)) THEN
    RETURN jsonb_build_object('error', 'coupon_day_invalid');
  END IF;
  IF p_coupon.hour_start IS NOT NULL AND v_hour < p_coupon.hour_start THEN RETURN jsonb_build_object('error', 'coupon_time_invalid'); END IF;
  IF p_coupon.hour_end IS NOT NULL AND v_hour >= p_coupon.hour_end THEN RETURN jsonb_build_object('error', 'coupon_time_invalid'); END IF;

  SELECT * INTO v_profile FROM profiles WHERE user_id = p_user_id;
  IF p_coupon.tier_required IS NOT NULL AND normalize_tier_name(v_profile.tier) <> normalize_tier_name(p_coupon.tier_required) THEN
    RETURN jsonb_build_object('error', 'coupon_tier_required');
  END IF;
  IF p_coupon.target_segment IS NOT NULL AND p_coupon.target_segment <> 'all' THEN
    IF p_coupon.target_segment = 'vip' AND normalize_tier_name(v_profile.tier) NOT IN ('VIP','Siyah') THEN
      RETURN jsonb_build_object('error', 'coupon_segment');
    END IF;
  END IF;

  SELECT count(*) INTO v_order_count FROM orders WHERE user_id = p_user_id AND status NOT IN ('cancelled','refunded');
  IF p_coupon.first_order_only AND v_order_count > 0 THEN RETURN jsonb_build_object('error', 'coupon_first_order_only'); END IF;
  IF p_coupon.new_customer_only AND v_profile.created_at < now() - interval '30 days' THEN
    RETURN jsonb_build_object('error', 'coupon_new_customer_only');
  END IF;

  SELECT count(*) INTO v_user_uses FROM coupon_redemptions WHERE coupon_id = p_coupon.id AND user_id = p_user_id;
  IF COALESCE(p_coupon.per_user_limit, 1) > 0 AND v_user_uses >= COALESCE(p_coupon.per_user_limit, 1) THEN
    RETURN jsonb_build_object('error', 'coupon_user_limit');
  END IF;

  IF COALESCE(array_length(p_coupon.product_ids, 1), 0) > 0 THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
      IF v_product_id = ANY(p_coupon.product_ids) THEN v_match := true; EXIT; END IF;
    END LOOP;
    IF NOT v_match THEN RETURN jsonb_build_object('error', 'coupon_product_mismatch'); END IF;
  END IF;

  IF COALESCE(array_length(p_coupon.category_ids, 1), 0) > 0 THEN
    v_match := false;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
      v_product_id := NULLIF(TRIM(v_item->>'productId'), '');
      SELECT category INTO v_cat FROM products WHERE id = v_product_id;
      IF v_cat = ANY(p_coupon.category_ids) THEN v_match := true; EXIT; END IF;
    END LOOP;
    IF NOT v_match THEN RETURN jsonb_build_object('error', 'coupon_category_mismatch'); END IF;
  END IF;

  RETURN jsonb_build_object('error', null);
END;
$$;

CREATE OR REPLACE FUNCTION public._calc_coupon_discount(p_coupon coupons, p_subtotal numeric)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF p_coupon.type = 'percent' THEN RETURN ROUND(p_subtotal * LEAST(p_coupon.value, 100) / 100, 2); END IF;
  IF p_coupon.type = 'fixed' THEN RETURN LEAST(p_coupon.value, p_subtotal); END IF;
  IF p_coupon.type IN ('free_item','bxgy') THEN RETURN LEAST(p_coupon.value, p_subtotal); END IF;
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public._find_best_campaign(
  p_user_id uuid,
  p_store_id text,
  p_subtotal numeric,
  p_items jsonb
)
RETURNS uuid LANGUAGE plpgsql STABLE AS $$
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

    IF v_c.discount_type = 'percent' THEN v_discount := ROUND(p_subtotal * COALESCE(v_c.discount_value,0) / 100, 2);
    ELSIF v_c.discount_type = 'fixed' THEN v_discount := LEAST(COALESCE(v_c.discount_value,0), p_subtotal);
    ELSIF v_c.discount_type = 'bogo' THEN v_discount := ROUND(p_subtotal * 0.5, 2);
    ELSE v_discount := COALESCE(v_c.discount_value, 0);
    END IF;

    IF v_discount > v_best_discount THEN v_best_discount := v_discount; v_best := v_c.id; END IF;
  END LOOP;
  RETURN v_best;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 3. CHECKOUT RPCs
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_checkout_benefits(p_store_id text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_benefits jsonb := '[]'::jsonb;
  v_stamps int;
  v_profile profiles;
  v_r record;
  v_fcr record;
  v_c campaigns;
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
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', CASE WHEN v_r.category = 'birthday' THEN 'birthday' WHEN v_r.category IN ('vip','exclusive') THEN 'vip_benefit' ELSE 'reward' END,
      'id', v_r.redemption_id::text, 'reward_id', v_r.reward_id, 'title', v_r.title,
      'detail', CASE WHEN v_r.points_cost > 0 THEN v_r.points_cost || ' puan' ELSE 'Ücretsiz ödül' END,
      'discount_type', 'free_item'
    ));
  END LOOP;

  IF normalize_tier_name(v_profile.tier) IN ('Altın','Siyah','VIP') THEN
    v_benefits := v_benefits || jsonb_build_array(jsonb_build_object(
      'type', 'vip_benefit', 'id', 'tier_monthly', 'title', 'Aylık Ücretsiz İçecek (' || v_profile.tier || ')',
      'detail', 'VIP avantajı', 'discount_type', 'free_item'
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
$$;

CREATE OR REPLACE FUNCTION public.preview_checkout(
  p_items jsonb,
  p_store_id text DEFAULT NULL,
  p_coupon_code text DEFAULT NULL,
  p_benefit_type text DEFAULT NULL,
  p_benefit_id text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
  ELSIF p_benefit_type IN ('reward','birthday','vip_benefit') AND p_benefit_id IS NOT NULL THEN
    SELECT r.title INTO v_benefit_title FROM reward_redemptions rr JOIN rewards r ON r.id = rr.reward_id
    WHERE rr.id = p_benefit_id::uuid AND rr.user_id = v_uid AND rr.order_id IS NULL;
    IF v_benefit_title IS NULL AND p_benefit_type = 'vip_benefit' THEN v_benefit_title := 'VIP Avantajı'; END IF;
    IF v_benefit_title IS NOT NULL THEN v_discount := v_subtotal; END IF;
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
      IF v_campaign.discount_type = 'percent' THEN v_discount := GREATEST(v_discount, ROUND(v_subtotal * COALESCE(v_campaign.discount_value,0)/100,2));
      ELSE v_discount := GREATEST(v_discount, LEAST(COALESCE(v_campaign.discount_value,0), v_subtotal)); END IF;
      v_benefit_title := COALESCE(v_benefit_title, v_campaign.title);
    END IF;
  ELSIF p_benefit_type IS NULL OR p_benefit_type = 'none' THEN
    v_campaign_id := _find_best_campaign(v_uid, p_store_id, v_subtotal, p_items);
    IF v_campaign_id IS NOT NULL THEN
      SELECT * INTO v_campaign FROM campaigns WHERE id = v_campaign_id;
      IF v_campaign.discount_type = 'percent' THEN v_discount := GREATEST(v_discount, ROUND(v_subtotal * COALESCE(v_campaign.discount_value,0)/100,2));
      ELSE v_discount := GREATEST(v_discount, LEAST(COALESCE(v_campaign.discount_value,0), v_subtotal)); END IF;
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
$$;

-- ═══════════════════════════════════════════════════════════════
-- 4. create_order v4
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.create_order(jsonb, numeric, text, text, text);

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
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_points int;
  v_item jsonb;
  v_blocked boolean;
  v_earn_rate numeric;
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
  v_campaign campaigns;
  v_payment_status text;
  v_initial_status text;
  v_franchise_id uuid;
  v_stamps int;
  v_multiplier numeric;
  v_profile profiles;
  v_qty int;
  v_product_id text;
  v_client_price numeric;
  v_db_price numeric;
  v_unit_price numeric;
  v_max_modifier numeric := 100;
  v_items jsonb;
  v_item_count int;
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

  -- Apply benefit side-effects
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

  IF p_payment_method = 'cash' THEN
    v_payment_status := 'pending';
    v_initial_status := 'payment_pending';
  ELSE
    v_payment_status := 'paid';
    v_initial_status := 'confirmed';
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

  -- Link redemptions
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

  INSERT INTO notifications (user_id, title, body, type)
  VALUES (v_uid, 'Siparisiniz alindi', v_order_number || ' numarali siparisiniz onaylandi.', 'order');

  RETURN jsonb_build_object(
    'order_id', v_order_id, 'order_number', v_order_number,
    'subtotal', v_subtotal, 'discount', v_discount, 'total', v_computed_total,
    'points_earned', v_points, 'billing_type', v_billing_type,
    'benefit_title', v_benefit_title, 'payment_status', v_payment_status,
    'error', null
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 5. cancel_order + advance_order_status
-- ═══════════════════════════════════════════════════════════════

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

  -- Reverse points earned
  IF v_order.points_earned > 0 THEN
    UPDATE profiles SET points = GREATEST(0, points - v_order.points_earned),
      lifetime_points = GREATEST(0, lifetime_points - v_order.points_earned)
    WHERE user_id = v_order.user_id;
    INSERT INTO points_history (user_id, title, points, type, store_id)
    VALUES (v_order.user_id, 'Iptal: ' || v_order.order_number, -v_order.points_earned, 'refund', v_order.store_id);
  END IF;

  -- Reverse points spent
  IF v_order.points_spent > 0 THEN
    UPDATE profiles SET points = points + v_order.points_spent WHERE user_id = v_order.user_id;
    INSERT INTO points_history (user_id, title, points, type, store_id)
    VALUES (v_order.user_id, 'Iade: ' || v_order.order_number, v_order.points_spent, 'refund', v_order.store_id);
  END IF;

  -- Unlink reward redemption
  UPDATE reward_redemptions SET order_id = NULL WHERE order_id = v_order.id;

  -- Unlink free coffee
  UPDATE free_coffee_redemptions SET order_id = NULL WHERE order_id = v_order.id;

  -- Restore stamps if stamp card order
  IF v_order.billing_type = 'free_coffee' AND v_order.benefit_source = 'stamp_card' THEN
    UPDATE loyalty_stamps SET redeemed = false WHERE id IN (
      SELECT id FROM loyalty_stamps WHERE user_id = v_order.user_id
        AND redeemed = true AND stamped_at >= v_order.created_at - interval '5 minutes'
      ORDER BY stamped_at DESC LIMIT 5
    );
  END IF;

  -- Restore coupon
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

-- ═══════════════════════════════════════════════════════════════
-- 6. QR rotation
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.rotate_qr_code()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_qr qr_codes;
  v_new_code text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  SELECT * INTO v_qr FROM qr_codes WHERE user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'qr_not_found'); END IF;

  IF v_qr.rotated_at IS NOT NULL AND now() - v_qr.rotated_at < interval '30 seconds' THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  v_new_code := 'EX-' || upper(substr(md5(v_uid::text || now()::text), 1, 8)) || '-' || upper(to_hex(floor(random()*16777215)::int));
  UPDATE qr_codes SET
    code = v_new_code,
    rotated_at = now(),
    expires_at = now() + interval '24 hours',
    rotation_count = rotation_count + 1
  WHERE user_id = v_uid
  RETURNING code INTO v_new_code;

  RETURN jsonb_build_object('error', null, 'code', v_new_code, 'expires_at', now() + interval '24 hours');
END;
$$;

-- Update qr_scan to check expiration
CREATE OR REPLACE FUNCTION public.qr_scan(
  p_qr_code_id uuid,
  p_store_id text DEFAULT NULL::text,
  p_action text DEFAULT 'stamp'::text,
  p_points integer DEFAULT 0
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
  v_redeem_batch int;
  v_same_qr_scan int;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF p_action NOT IN ('stamp','points','redeem') THEN RETURN jsonb_build_object('error', 'invalid_action'); END IF;

  SELECT COALESCE(points_per_stamp, 10) INTO v_points_per_stamp FROM loyalty_settings LIMIT 1;
  v_stamps_required := 5;
  v_max_qr_points := COALESCE(v_points_per_stamp, 10);

  SELECT user_id, expires_at INTO v_customer, v_qr_expires
  FROM qr_codes WHERE id = p_qr_code_id AND is_active = true;
  IF v_customer IS NULL THEN RETURN jsonb_build_object('error', 'qr_not_found'); END IF;
  IF v_qr_expires IS NOT NULL AND v_qr_expires < now() THEN RETURN jsonb_build_object('error', 'qr_expired'); END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_customer;
  IF v_blocked THEN RETURN jsonb_build_object('error', 'account_blocked'); END IF;

  IF v_customer <> v_uid AND NOT is_super_admin() AND NOT is_admin() AND NOT has_store_access(p_store_id) THEN
    RETURN jsonb_build_object('error', 'not_owner');
  END IF;
  IF v_customer <> v_uid AND (p_store_id IS NULL OR TRIM(p_store_id) = '') THEN
    RETURN jsonb_build_object('error', 'store_required');
  END IF;

  -- Duplicate scan same QR within 5 min by same scanner
  SELECT count(*) INTO v_same_qr_scan FROM qr_scans
  WHERE qr_code_id = p_qr_code_id AND scanned_by = v_uid::text AND scanned_at > now() - interval '5 minutes';
  IF v_same_qr_scan > 0 AND v_customer <> v_uid THEN
    RETURN jsonb_build_object('error', 'duplicate_scan');
  END IF;

  SELECT scanned_at INTO v_last_scan FROM qr_scans WHERE scanned_by = v_uid::text ORDER BY scanned_at DESC LIMIT 1;
  IF v_last_scan IS NOT NULL AND now() - v_last_scan < interval '60 seconds' THEN
    RETURN jsonb_build_object('error', 'rate_limited');
  END IF;

  SELECT count(*) INTO v_active_stamps FROM loyalty_stamps WHERE user_id = v_customer AND redeemed = false;

  IF p_action = 'stamp' AND v_active_stamps >= v_stamps_required THEN
    UPDATE loyalty_stamps SET redeemed = true WHERE id IN (
      SELECT id FROM loyalty_stamps WHERE user_id = v_customer AND redeemed = false ORDER BY stamped_at ASC LIMIT v_stamps_required
    );
    v_dedup := v_customer::text || '-redeem-' || extract(epoch from now())::bigint::text;
    INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
    VALUES (v_customer, p_qr_code_id, p_store_id, 'redeem', 0, v_dedup, v_uid::text);
    INSERT INTO free_coffee_redemptions (user_id, store_id, product_name, redeemed_by)
    VALUES (v_customer, p_store_id, 'Ücretsiz Kahve (Damga Kartı)', v_uid);
    SELECT count(*) INTO v_active_stamps FROM loyalty_stamps WHERE user_id = v_customer AND redeemed = false;
    RETURN jsonb_build_object('error', null, 'redeemed', true, 'stamps_redeemed', v_stamps_required,
      'points_awarded', 0, 'customer_id', v_customer, 'remaining_stamps', v_active_stamps);
  END IF;

  IF p_action = 'stamp' THEN v_points_awarded := v_points_per_stamp;
  ELSIF p_action = 'points' THEN v_points_awarded := LEAST(GREATEST(0, COALESCE(p_points,0)), v_max_qr_points);
  ELSE v_points_awarded := 0; END IF;

  v_dedup := v_customer::text || '-' || extract(epoch from now())::bigint::text;
  INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
  VALUES (v_customer, p_qr_code_id, p_store_id, p_action, v_points_awarded, v_dedup, v_uid::text);

  IF p_action = 'stamp' THEN INSERT INTO loyalty_stamps (user_id, store_id) VALUES (v_customer, p_store_id); END IF;

  IF v_points_awarded > 0 THEN
    UPDATE profiles SET points = points + v_points_awarded, lifetime_points = lifetime_points + v_points_awarded WHERE user_id = v_customer;
    INSERT INTO points_history (user_id, title, points, type, store_id) VALUES (v_customer, 'QR damga', v_points_awarded, 'earn', p_store_id);
    PERFORM recalc_profile_tier(v_customer);
  END IF;

  SELECT count(*) INTO v_active_stamps FROM loyalty_stamps WHERE user_id = v_customer AND redeemed = false;
  RETURN jsonb_build_object('error', null, 'redeemed', false, 'points_awarded', v_points_awarded,
    'customer_id', v_customer, 'remaining_stamps', v_active_stamps);
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- 7. HQ Analytics RPC
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_hq_benefit_costs(p_days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_since timestamptz := now() - (p_days || ' days')::interval;
BEGIN
  IF NOT is_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  RETURN jsonb_build_object(
    'error', null,
    'free_coffee_cost', COALESCE((SELECT sum(subtotal) FROM orders WHERE billing_type = 'free_coffee' AND created_at >= v_since), 0),
    'reward_cost', COALESCE((SELECT sum(discount_amount) FROM orders WHERE billing_type IN ('reward','birthday','vip_benefit') AND created_at >= v_since), 0),
    'coupon_cost', COALESCE((SELECT sum(discount_amount) FROM orders WHERE billing_type = 'coupon' AND created_at >= v_since), 0),
    'campaign_cost', COALESCE((SELECT sum(discount_amount) FROM orders WHERE billing_type = 'campaign' AND created_at >= v_since), 0),
    'total_orders', (SELECT count(*) FROM orders WHERE created_at >= v_since AND status NOT IN ('cancelled')),
    'aov', COALESCE((SELECT avg(total) FROM orders WHERE created_at >= v_since AND status NOT IN ('cancelled','refunded')), 0),
    'repeat_rate', COALESCE((
      SELECT round(100.0 * count(DISTINCT user_id) FILTER (WHERE cnt > 1) / NULLIF(count(*),0), 2)
      FROM (SELECT user_id, count(*) cnt FROM orders WHERE created_at >= v_since GROUP BY user_id) s
    ), 0)
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_checkout_benefits(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_checkout(jsonb, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_order_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_qr_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hq_benefit_costs(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalc_profile_tier(uuid) TO authenticated;
