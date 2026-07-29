/*
# B2B Production Readiness Fixes

- Fix notification type constraint violations in payment and shipping side-effects
- Notifications use type 'order' with source in data JSONB (matches CHECK constraint)
*/

CREATE OR REPLACE FUNCTION public.b2b_process_payment_side_effects(
  p_order_id uuid,
  p_payment_id uuid DEFAULT NULL,
  p_provider text DEFAULT 'manual',
  p_payment_number text DEFAULT '',
  p_uid uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_order b2b_orders%ROWTYPE;
  v_inv_id uuid;
  v_inv_no text;
  v_ledger_no text;
  v_prev_balance numeric(12,2);
  v_new_balance numeric(12,2);
  v_inv_exists uuid;
BEGIN
  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'order_not_found'); END IF;

  SELECT id INTO v_inv_exists FROM b2b_invoices WHERE order_id = p_order_id LIMIT 1;
  IF v_inv_exists IS NOT NULL THEN
    UPDATE b2b_orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = p_order_id;
    RETURN jsonb_build_object('error', null, 'invoice_id', v_inv_exists, 'skipped', true);
  END IF;

  v_inv_no := b2b_next_invoice_number();
  INSERT INTO b2b_invoices (invoice_number, order_id, store_id, franchise_id, status, subtotal, vat_total, total, paid_amount, due_date, paid_at)
  VALUES (v_inv_no, p_order_id, v_order.store_id, v_order.franchise_id, 'paid',
          v_order.subtotal, v_order.vat_total, v_order.total, v_order.total,
          (now() + interval '30 days')::date, now())
  RETURNING id INTO v_inv_id;

  IF p_payment_id IS NOT NULL THEN
    UPDATE b2b_payments SET invoice_id = v_inv_id WHERE id = p_payment_id;
  END IF;

  UPDATE b2b_orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = p_order_id;

  SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END), 0)
  INTO v_prev_balance
  FROM b2b_ledger WHERE franchise_id = v_order.franchise_id;

  v_ledger_no := 'LED-' || b2b_next_ledger_number();
  v_new_balance := v_prev_balance + v_order.total;
  INSERT INTO b2b_ledger (entry_number, franchise_id, store_id, type, amount, description, ref_type, ref_id, balance_after, created_by)
  VALUES (v_ledger_no, v_order.franchise_id, v_order.store_id, 'debit', v_order.total,
          'Fatura ' || v_inv_no, 'invoice', v_inv_id, v_new_balance, p_uid);

  v_ledger_no := 'LED-' || b2b_next_ledger_number();
  v_new_balance := v_prev_balance + v_order.total - v_order.total;
  INSERT INTO b2b_ledger (entry_number, franchise_id, store_id, type, amount, description, ref_type, ref_id, balance_after, created_by)
  VALUES (v_ledger_no, v_order.franchise_id, v_order.store_id, 'credit', v_order.total,
          'Ödeme ' || COALESCE(p_payment_number, p_provider), 'payment', p_payment_id, v_new_balance, p_uid);

  PERFORM b2b_recalc_credit_balance(v_order.franchise_id);

  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Ödeme Alındı',
         'Sipariş ' || v_order.order_number || ' ödemeniz alındı. Tutar: ' || v_order.total::text || ' TL',
         'order',
         jsonb_build_object(
           'order_id', p_order_id,
           'order_number', v_order.order_number,
           'amount', v_order.total,
           'invoice_id', v_inv_id,
           'source', 'b2b_payment'
         )
  FROM user_roles ur
  WHERE ur.store_id = v_order.store_id
    AND ur.role IN ('franchise', 'store_manager', 'staff');

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (p_uid, 'b2b_payment_processed', 'b2b_order', p_order_id::text,
          jsonb_build_object('order_id', p_order_id, 'amount', v_order.total, 'invoice_id', v_inv_id, 'provider', p_provider));

  RETURN jsonb_build_object('error', null, 'invoice_id', v_inv_id, 'order_id', p_order_id);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_b2b_shipping(
  p_order_id uuid,
  p_carrier text DEFAULT '',
  p_tracking_no text DEFAULT '',
  p_tracking_url text DEFAULT '',
  p_eta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_carrier text;
  v_tracking text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  UPDATE b2b_orders
  SET carrier_company = CASE WHEN p_carrier <> '' THEN p_carrier ELSE carrier_company END,
      tracking_number = CASE WHEN p_tracking_no <> '' THEN p_tracking_no ELSE tracking_number END,
      tracking_url = CASE WHEN p_tracking_url <> '' THEN p_tracking_url
                          WHEN p_tracking_no <> '' THEN 'https://www.google.com/search?q=' || COALESCE(p_carrier, carrier_company) || '+' || p_tracking_no
                          ELSE tracking_url END,
      estimated_delivery = CASE WHEN p_eta IS NOT NULL THEN p_eta ELSE estimated_delivery END,
      updated_at = now()
  WHERE id = p_order_id;

  SELECT carrier_company, tracking_number INTO v_carrier, v_tracking
  FROM b2b_orders WHERE id = p_order_id;

  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Kargo Bilgisi Güncellendi',
         'Sipariş ' || v_order.order_number || ' kargo bilgileri güncellendi. Kargo: ' || COALESCE(v_carrier, '—') || ' Takip: ' || COALESCE(v_tracking, '—'),
         'order',
         jsonb_build_object(
           'order_id', p_order_id,
           'order_number', v_order.order_number,
           'carrier', v_carrier,
           'tracking_no', v_tracking,
           'source', 'b2b_shipping'
         )
  FROM user_roles ur
  WHERE ur.store_id = v_order.store_id
    AND ur.role IN ('franchise', 'store_manager', 'staff');

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_shipping_updated', 'b2b_order', p_order_id::text,
          jsonb_build_object('carrier', v_carrier, 'tracking_no', v_tracking, 'eta', p_eta));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id);
END;
$function$;
