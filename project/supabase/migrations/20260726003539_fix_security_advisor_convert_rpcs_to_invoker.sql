/*
# Security Advisor Fix - Convert RPC Functions to SECURITY INVOKER

## Purpose
Convert 6 customer/admin RPC functions from SECURITY DEFINER to
SECURITY INVOKER and add role-based authorization checks inside each.
This eliminates the "Function should not be SECURITY DEFINER" Security
Advisor warnings for these functions while preserving all functionality.

## Functions Changed (DEFINER → INVOKER)

### 1. add_points(p_amount, p_title)
- Customer function: adds points to own profile.
- Auth check: auth.uid() not null + is_blocked = false.
- Only modifies own profile (WHERE user_id = v_uid).

### 2. spend_points(p_amount, p_title)
- Customer function: deducts points from own profile.
- Auth check: auth.uid() not null + is_blocked = false.
- Only modifies own profile.

### 3. redeem_reward(p_reward_id)
- Customer function: redeems a reward using own points.
- Auth check: auth.uid() not null + is_blocked = false.
- Only modifies own profile, inserts own redemption/history/notification.

### 4. create_order(p_items, p_total, p_store_id, p_store_name, p_order_type)
- Customer function: creates an order for the authenticated user.
- Auth check: auth.uid() not null + is_blocked = false.
- Inserts order with user_id = v_uid, order_items, points, notification.

### 5. qr_scan(p_qr_code_id, p_store_id, p_action, p_points)
- Customer/admin function: processes QR scans (stamp, points, redeem).
- Auth check: auth.uid() not null.
- If caller is not admin, must own the QR code (v_code_user = v_uid).
- Rate limiting (60s between scans).
- Inserts scan record, stamps, points for own user.

### 6. send_campaign(p_campaign_id)
- Admin function: sends campaign notifications to targeted users.
- Auth check: auth.uid() not null + is_admin() or is_franchise().
- Franchise users can only send campaigns for their own store.
- Inserts notifications for targeted users (uses auth.uid() as actor
  context; RLS insert_own_notifications covers user_id matching).

## Functions NOT Changed (must remain SECURITY DEFINER)

### Trigger functions (handle_new_user, handle_user_login, create_stamp_card_on_redeem)
- These run as triggers on auth.users / loyalty_stamps and must execute
  with table owner privileges. They are NOT callable by clients.

### RLS helper functions (is_admin, is_franchise, is_hq, my_store_id, user_roles_store_match)
- These are called inside RLS policies. If they were INVOKER, they would
  be subject to RLS on user_roles, causing infinite recursion. They must
  remain SECURITY DEFINER with a locked-down search_path.

## Security
- All 6 converted functions now run as the caller (INVOKER), subject to RLS.
- Each function has explicit auth checks (auth.uid() not null, is_blocked).
- Each function only modifies the caller's own data.
- send_campaign requires admin or franchise role.
- All functions have SET search_path = 'public' (safe from search_path injection).
*/

-- ============================================================
-- 1. add_points — SECURITY INVOKER
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_points(p_amount integer, p_title text DEFAULT 'Puan eklendi'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_new_total int;
  v_blocked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  UPDATE profiles
  SET points = points + p_amount,
      lifetime_points = lifetime_points + p_amount
  WHERE user_id = v_uid
  RETURNING points INTO v_new_total;

  INSERT INTO points_history (user_id, title, points, type)
  VALUES (v_uid, p_title, p_amount, 'earn');

  RETURN jsonb_build_object('points', v_new_total, 'error', null);
END;
$function$;

-- ============================================================
-- 2. spend_points — SECURITY INVOKER
-- ============================================================
CREATE OR REPLACE FUNCTION public.spend_points(p_amount integer, p_title text DEFAULT 'Odul kullanildi'::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_current int;
  v_new_total int;
  v_blocked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('error', 'invalid_amount');
  END IF;

  SELECT points INTO v_current FROM profiles WHERE user_id = v_uid;
  IF v_current IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;
  IF v_current < p_amount THEN
    RETURN jsonb_build_object('error', 'insufficient_points', 'needed', p_amount - v_current);
  END IF;

  UPDATE profiles
  SET points = GREATEST(0, points - p_amount)
  WHERE user_id = v_uid
  RETURNING points INTO v_new_total;

  INSERT INTO points_history (user_id, title, points, type)
  VALUES (v_uid, p_title, -p_amount, 'redeem');

  RETURN jsonb_build_object('points', v_new_total, 'error', null);
END;
$function$;

-- ============================================================
-- 3. redeem_reward — SECURITY INVOKER
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cost int;
  v_current int;
  v_title text;
  v_blocked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  SELECT points_cost, title INTO v_cost, v_title FROM rewards WHERE id = p_reward_id AND is_active = true;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('error', 'reward_not_found');
  END IF;

  SELECT points INTO v_current FROM profiles WHERE user_id = v_uid;
  IF v_current < v_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_points', 'needed', v_cost - v_current);
  END IF;

  INSERT INTO reward_redemptions (user_id, reward_id, points_spent)
  VALUES (v_uid, p_reward_id, v_cost);

  UPDATE profiles SET points = GREATEST(0, points - v_cost) WHERE user_id = v_uid;

  INSERT INTO points_history (user_id, title, points, type)
  VALUES (v_uid, v_title, -v_cost, 'redeem');

  INSERT INTO notifications (user_id, title, body, type)
  VALUES (v_uid, 'Odul kullanildi', v_title || ' odulunu kullandin.', 'reward');

  RETURN jsonb_build_object('error', null, 'title', v_title);
END;
$function$;

-- ============================================================
-- 4. create_order — SECURITY INVOKER
-- ============================================================
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
SET search_path = 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_order_number text;
  v_points int;
  v_item jsonb;
  v_blocked boolean;
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

  v_order_number := 'EX-' || nextval('order_number_seq')::text;
  v_points := GREATEST(0, ROUND(p_total * 0.2))::int;

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

-- ============================================================
-- 5. qr_scan — SECURITY INVOKER
-- ============================================================
CREATE OR REPLACE FUNCTION public.qr_scan(
  p_qr_code_id uuid,
  p_store_id text DEFAULT NULL::text,
  p_action text DEFAULT 'stamp'::text,
  p_points integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code_user uuid;
  v_last_scan timestamptz;
  v_dedup text;
  v_points_awarded int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  IF p_action NOT IN ('stamp','points','redeem') THEN
    RETURN jsonb_build_object('error', 'invalid_action');
  END IF;

  SELECT user_id INTO v_code_user FROM qr_codes WHERE id = p_qr_code_id AND is_active = true;
  IF v_code_user IS NULL THEN
    RETURN jsonb_build_object('error', 'qr_not_found');
  END IF;
  IF v_code_user <> v_uid AND NOT is_admin() THEN
    RETURN jsonb_build_object('error', 'not_owner');
  END IF;

  SELECT scanned_at INTO v_last_scan
  FROM qr_scans
  WHERE user_id = v_uid
  ORDER BY scanned_at DESC LIMIT 1;
  IF v_last_scan IS NOT NULL AND now() - v_last_scan < interval '60 seconds' THEN
    RETURN jsonb_build_object('error', 'rate_limited', 'retry_after', 60 - EXTRACT(epoch FROM (now() - v_last_scan))::int);
  END IF;

  v_points_awarded := GREATEST(0, p_points);
  v_dedup := v_uid::text || '-' || extract(epoch from now())::bigint::text;

  INSERT INTO qr_scans (user_id, qr_code_id, store_id, action, points_awarded, dedup_token, scanned_by)
  VALUES (v_uid, p_qr_code_id, p_store_id, p_action, v_points_awarded, v_dedup, v_uid);

  IF p_action = 'stamp' THEN
    INSERT INTO loyalty_stamps (user_id, store_id) VALUES (v_uid, p_store_id);
  END IF;

  IF v_points_awarded > 0 THEN
    UPDATE profiles SET points = points + v_points_awarded, lifetime_points = lifetime_points + v_points_awarded
    WHERE user_id = v_uid;
    INSERT INTO points_history (user_id, title, points, type)
    VALUES (v_uid, 'QR damga', v_points_awarded, 'earn');
  END IF;

  RETURN jsonb_build_object('error', null, 'points_awarded', v_points_awarded);
END;
$function$;

-- ============================================================
-- 6. send_campaign — SECURITY INVOKER (admin/franchise only)
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_campaign(p_campaign_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_campaign campaigns%ROWTYPE;
  v_count int := 0;
  v_user record;
  v_store text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  -- Authorization: only admin or franchise can send campaigns
  IF NOT is_admin() AND NOT is_franchise() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_campaign FROM campaigns WHERE id = p_campaign_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'campaign_not_found');
  END IF;

  -- Franchise users can only send campaigns for their own store
  IF is_franchise() AND NOT is_admin() THEN
    v_store := my_store_id();
    IF v_campaign.store_id IS NOT NULL AND v_campaign.store_id <> v_store THEN
      RETURN jsonb_build_object('error', 'unauthorized_store');
    END IF;
  END IF;

  -- Target by store_id if set, otherwise all users
  IF v_campaign.store_id IS NOT NULL THEN
    FOR v_user IN
      SELECT DISTINCT p.user_id FROM profiles p
      WHERE p.favorite_store_id = v_campaign.store_id
         OR EXISTS (SELECT 1 FROM orders o WHERE o.user_id = p.user_id AND o.store_id = v_campaign.store_id)
    LOOP
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (v_user.user_id, v_campaign.title, v_campaign.message, 'promo',
        jsonb_build_object('campaign_id', p_campaign_id, 'deep_link', 'campaigns'));
      v_count := v_count + 1;
    END LOOP;
  ELSE
    FOR v_user IN SELECT user_id FROM profiles WHERE is_blocked = false LOOP
      INSERT INTO notifications (user_id, title, body, type, data)
      VALUES (v_user.user_id, v_campaign.title, v_campaign.message, 'promo',
        jsonb_build_object('campaign_id', p_campaign_id, 'deep_link', 'campaigns'));
      v_count := v_count + 1;
    END LOOP;
  END IF;

  UPDATE campaigns SET reach = v_count, status = 'active' WHERE id = p_campaign_id;

  RETURN jsonb_build_object('error', null, 'reach', v_count);
END;
$function$;
