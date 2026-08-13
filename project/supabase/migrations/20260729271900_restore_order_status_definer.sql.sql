/*
# Restore SECURITY DEFINER on order status RPCs
Migration 718 recreated advance_order_status / cancel_order as SECURITY INVOKER.
With orders_update_store_fm removed (70401), SELECT FOR UPDATE on orders fails for
franchise staff (no UPDATE RLS) → spurious order_not_found.
*/

CREATE OR REPLACE FUNCTION public.advance_order_status(
  p_order_number text,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_order.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (v_order.user_id, v_notify_title, v_notify_body, 'order');
  END IF;

  RETURN jsonb_build_object('error', null, 'status', p_new_status);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'status_update_failed', 'detail', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_order(p_order_number text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  IF v_order.user_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (v_order.user_id, 'Siparis iptal edildi', v_order.order_number || ' numarali siparisiniz iptal edildi.', 'order');
  END IF;

  RETURN jsonb_build_object('error', null, 'order_number', p_order_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('error', 'cancel_failed', 'detail', SQLERRM, 'sqlstate', SQLSTATE);
END;
$$;

ALTER FUNCTION public.advance_order_status(text, text, text) SECURITY DEFINER;
ALTER FUNCTION public.cancel_order(text, text) SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.advance_order_status(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_order(text, text) TO authenticated;
