/*
# Store Release RLS Hardening

- Remove coupon enumeration policy
- Remove customer audit tampering policies
- Remove direct store loyalty stamp / free-coffee INSERT bypass
- Add defense-in-depth guard to webhook payment confirmation
*/

-- ─── 1. Coupon enumeration ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "coupons_select_active_by_code" ON coupons;

-- ─── 2. Customer audit tampering ─────────────────────────────────────────────

DROP POLICY IF EXISTS "order_status_history_insert_own" ON order_status_history;
DROP POLICY IF EXISTS "coupon_redemptions_delete_own" ON coupon_redemptions;
DROP POLICY IF EXISTS "campaign_applications_delete_own" ON campaign_applications;

-- ─── 3. Store loyalty direct write bypass ────────────────────────────────────

DROP POLICY IF EXISTS "loyalty_stamps_insert_store" ON loyalty_stamps;
DROP POLICY IF EXISTS "loyalty_stamps_update_store_fm" ON loyalty_stamps;
DROP POLICY IF EXISTS "free_coffee_redemptions_insert_store" ON free_coffee_redemptions;

-- ─── 4. Webhook RPC defense-in-depth (70400 body + service_role guard) ───────

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

REVOKE ALL ON FUNCTION public.confirm_order_payment_webhook(text, numeric, text, text, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_order_payment_webhook(text, numeric, text, text, text, uuid) FROM anon, authenticated;
