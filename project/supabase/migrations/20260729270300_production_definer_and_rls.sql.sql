/*
# Production RLS & SECURITY DEFINER Hardening
- Checkout lifecycle RPCs → SECURITY DEFINER (bypass RLS safely with in-function auth)
- Idempotent RLS policies for V3 tables
- record_order_payment RPC
- Triggers, grants, duplicate RPC guard
*/

-- ─── 1. Duplicate RPC guard (idempotent) ─────────────────────
DROP FUNCTION IF EXISTS public.create_order(jsonb, numeric, text, text, text);

-- ─── 2. SECURITY DEFINER for checkout lifecycle ──────────────
ALTER FUNCTION public.create_order(jsonb, numeric, text, text, text, text, text, text, text) SECURITY DEFINER;
ALTER FUNCTION public.cancel_order(text, text) SECURITY DEFINER;
ALTER FUNCTION public.advance_order_status(text, text, text) SECURITY DEFINER;

-- Internal tier helper — not callable by clients directly
REVOKE EXECUTE ON FUNCTION public.recalc_profile_tier(uuid) FROM PUBLIC, anon, authenticated;

-- ─── 3. record_order_payment ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_order_payment(
  p_order_number text,
  p_payment_status text,
  p_transaction_id text DEFAULT NULL,
  p_gateway text DEFAULT 'internal',
  p_refund_amount numeric DEFAULT NULL
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
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF p_payment_status NOT IN ('pending','authorized','paid','failed','refunded','partial_refund') THEN
    RETURN jsonb_build_object('error', 'invalid_payment_status');
  END IF;

  SELECT * INTO v_order FROM orders WHERE order_number = p_order_number FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  IF v_order.user_id <> v_uid AND NOT is_admin() AND NOT has_store_access(v_order.store_id) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT * INTO v_payment FROM order_payments WHERE order_id = v_order.id ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO order_payments (order_id, amount, payment_method, payment_status, transaction_id, gateway, refund_amount)
    VALUES (v_order.id, v_order.total, COALESCE(v_order.payment_method, 'card'), p_payment_status, p_transaction_id, p_gateway, COALESCE(p_refund_amount, 0))
    RETURNING * INTO v_payment;
  ELSE
    UPDATE order_payments SET
      payment_status = p_payment_status,
      transaction_id = COALESCE(p_transaction_id, transaction_id),
      gateway = COALESCE(p_gateway, gateway),
      refund_amount = COALESCE(p_refund_amount, refund_amount),
      updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  END IF;

  UPDATE orders SET
    payment_status = p_payment_status,
    transaction_id = COALESCE(p_transaction_id, transaction_id),
    payment_gateway = COALESCE(p_gateway, payment_gateway),
    updated_at = now()
  WHERE id = v_order.id;

  RETURN jsonb_build_object(
    'error', null,
    'order_number', p_order_number,
    'payment_status', v_payment.payment_status,
    'payment_id', v_payment.id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_order_payment(text, text, text, text, numeric) TO authenticated;

-- ─── 4. customer_addresses (profile addresses) ───────────────
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Ev',
  line1 text NOT NULL,
  line2 text DEFAULT '',
  city text NOT NULL DEFAULT '',
  district text DEFAULT '',
  postal_code text DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON customer_addresses(user_id);

DROP POLICY IF EXISTS "customer_addresses_select_own" ON customer_addresses;
CREATE POLICY "customer_addresses_select_own" ON customer_addresses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "customer_addresses_insert_own" ON customer_addresses;
CREATE POLICY "customer_addresses_insert_own" ON customer_addresses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "customer_addresses_update_own" ON customer_addresses;
CREATE POLICY "customer_addresses_update_own" ON customer_addresses FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "customer_addresses_delete_own" ON customer_addresses;
CREATE POLICY "customer_addresses_delete_own" ON customer_addresses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "customer_addresses_select_internal" ON customer_addresses;
CREATE POLICY "customer_addresses_select_internal" ON customer_addresses FOR SELECT TO authenticated
  USING (is_internal());

DROP TRIGGER IF EXISTS tr_customer_addresses_updated ON customer_addresses;
CREATE TRIGGER tr_customer_addresses_updated BEFORE UPDATE ON customer_addresses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 5. Idempotent RLS — V3 lifecycle tables ─────────────────
DROP POLICY IF EXISTS "order_payments_update_internal" ON order_payments;
CREATE POLICY "order_payments_update_internal" ON order_payments FOR UPDATE TO authenticated
  USING (
    is_internal()
    OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_payments.order_id AND o.user_id = auth.uid())
  )
  WITH CHECK (
    is_internal()
    OR EXISTS (SELECT 1 FROM orders o WHERE o.id = order_payments.order_id AND o.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "coupon_redemptions_delete_own" ON coupon_redemptions;
CREATE POLICY "coupon_redemptions_delete_own" ON coupon_redemptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_internal());

DROP POLICY IF EXISTS "campaign_applications_delete_own" ON campaign_applications;
CREATE POLICY "campaign_applications_delete_own" ON campaign_applications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR is_internal());

DROP POLICY IF EXISTS "free_coffee_redemptions_insert_own" ON free_coffee_redemptions;
CREATE POLICY "free_coffee_redemptions_insert_own" ON free_coffee_redemptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "free_coffee_redemptions_update_own" ON free_coffee_redemptions;
CREATE POLICY "free_coffee_redemptions_update_own" ON free_coffee_redemptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reward_redemptions_update_own" ON reward_redemptions;
CREATE POLICY "reward_redemptions_update_own" ON reward_redemptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- order_status_history (idempotent re-create)
DROP POLICY IF EXISTS "order_status_history_insert_own" ON order_status_history;
CREATE POLICY "order_status_history_insert_own" ON order_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_status_history.order_id AND o.user_id = auth.uid()));

DROP POLICY IF EXISTS "order_status_history_insert_internal" ON order_status_history;
CREATE POLICY "order_status_history_insert_internal" ON order_status_history FOR INSERT TO authenticated
  WITH CHECK (is_internal());

DROP POLICY IF EXISTS "order_status_history_insert_store" ON order_status_history;
CREATE POLICY "order_status_history_insert_store" ON order_status_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM orders o WHERE o.id = order_status_history.order_id AND has_store_access(o.store_id)));

DROP TRIGGER IF EXISTS tr_order_payments_updated ON order_payments;
CREATE TRIGGER tr_order_payments_updated BEFORE UPDATE ON order_payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 6. Verify production constraints (no-op if ok) ──────────
DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_order'
    GROUP BY p.proname HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Duplicate create_order signatures detected';
  END IF;
END;
$verify$;
