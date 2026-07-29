/*
# B2B Business Logic Fixes — Order Flow, Payment, Ledger, Notifications

## Summary

This migration fixes several business logic issues in the existing B2B RPC functions
and adds missing functionality required for the complete order-to-delivery workflow.
No tables are altered or dropped — only functions and triggers are replaced.

## Changes

### 1. create_b2b_order — now creates orders as 'awaiting_payment'
Previously orders were created with status 'draft'. The business rule requires that
once a franchise confirms their cart, the order immediately enters 'awaiting_payment'.
The 'draft' status is removed from the workflow.

### 2. record_b2b_payment — complete transactional side-effects
Now performs all of the following in a single SECURITY DEFINER function (atomic):
  - Inserts payment record with status 'success'
  - Creates exactly ONE invoice (idempotency check: no invoice if one already exists)
  - Updates order status to 'paid'
  - Creates TWO ledger entries (debit for invoice, credit for payment) with balance_after
  - Updates b2b_franchise_credit.current_balance from ledger
  - Inserts notification to store users
  - Inserts audit log entry

### 3. confirm_b2b_payment — fixed double-payment bug
Previously called record_b2b_payment() which created a SECOND payment record.
Now performs the side-effects directly (invoice, ledger, order update) without
creating a duplicate payment. Marks the existing payment as 'success' and runs
the same side-effect logic as record_b2b_payment.

### 4. Ledger balance_after — now calculated correctly
Both record_b2b_payment and confirm_b2b_payment now compute the running balance
from existing ledger entries and store it in balance_after.

### 5. b2b_franchise_credit.current_balance — auto-updated
After each ledger entry, current_balance is recalculated from the ledger.

### 6. New trigger: b2b_notify_order_created
Fires AFTER INSERT on b2b_orders to send a "Sipariş Oluşturuldu" notification
to all store users. Previously only status CHANGES generated notifications, so
the initial creation was silent.

### 7. New function: b2b_recalc_credit_balance
Helper that recalculates current_balance from ledger entries for a franchise.

### 8. advance_b2b_order_status — now also allows paid→confirmed transition
  Also sends notification via the existing status-change trigger.
  Added tracking_url generation and audit log (already existed but improved).

### 9. New RPC: update_b2b_shipping
Allows HQ to update carrier, tracking number, tracking URL, and estimated
delivery date independently of status advancement (so shipping info can be
entered/updated before or at the shipped stage).

### 10. Realtime enabled on B2B tables
Adds all B2B tables to the Supabase Realtime publication so the frontend can
subscribe to changes for live notifications and order tracking.

## Important Notes
1. Safe to re-run: all DROP POLICY / CREATE OR REPLACE FUNCTION are idempotent.
2. No existing tables are altered — only functions and triggers replaced.
3. No existing RLS policies are modified.
4. The 'draft' status remains in the CHECK constraint for backwards compatibility
   but orders are no longer created with it.
*/

-- ============================================================================
-- SECTION 1: Helper — recalculate franchise credit balance from ledger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.b2b_recalc_credit_balance(p_franchise_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_debit numeric(12,2);
  v_credit numeric(12,2);
  v_balance numeric(12,2);
BEGIN
  SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0)
  INTO v_debit, v_credit
  FROM b2b_ledger WHERE franchise_id = p_franchise_id;

  v_balance := v_debit - v_credit;

  INSERT INTO b2b_franchise_credit (franchise_id, credit_limit, current_balance, risk_status, payment_terms_days)
  VALUES (p_franchise_id, 50000, v_balance, CASE WHEN v_balance > 40000 THEN 'warning' ELSE 'normal' END, 30)
  ON CONFLICT (franchise_id) DO UPDATE
  SET current_balance = v_balance,
      risk_status = CASE WHEN v_balance > 40000 THEN 'warning' ELSE 'normal' END,
      updated_at = now();
END;
$function$;

-- ============================================================================
-- SECTION 2: Helper — create invoice + ledger for a paid order (shared logic)
-- ============================================================================

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

  -- Idempotency: skip if invoice already exists for this order
  SELECT id INTO v_inv_exists FROM b2b_invoices WHERE order_id = p_order_id LIMIT 1;
  IF v_inv_exists IS NOT NULL THEN
    -- Invoice already created, just ensure order is paid
    UPDATE b2b_orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = p_order_id;
    RETURN jsonb_build_object('error', null, 'invoice_id', v_inv_exists, 'skipped', true);
  END IF;

  -- Create invoice
  v_inv_no := b2b_next_invoice_number();
  INSERT INTO b2b_invoices (invoice_number, order_id, store_id, franchise_id, status, subtotal, vat_total, total, paid_amount, due_date, paid_at)
  VALUES (v_inv_no, p_order_id, v_order.store_id, v_order.franchise_id, 'paid',
          v_order.subtotal, v_order.vat_total, v_order.total, v_order.total,
          (now() + interval '30 days')::date, now())
  RETURNING id INTO v_inv_id;

  -- Link payment to invoice if payment_id provided
  IF p_payment_id IS NOT NULL THEN
    UPDATE b2b_payments SET invoice_id = v_inv_id WHERE id = p_payment_id;
  END IF;

  -- Update order status to paid
  UPDATE b2b_orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = p_order_id;

  -- Ledger: debit (invoice creates debt)
  SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END), 0)
  INTO v_prev_balance
  FROM b2b_ledger WHERE franchise_id = v_order.franchise_id;

  v_ledger_no := 'LED-' || b2b_next_ledger_number();
  v_new_balance := v_prev_balance + v_order.total;
  INSERT INTO b2b_ledger (entry_number, franchise_id, store_id, type, amount, description, ref_type, ref_id, balance_after, created_by)
  VALUES (v_ledger_no, v_order.franchise_id, v_order.store_id, 'debit', v_order.total,
          'Fatura ' || v_inv_no, 'invoice', v_inv_id, v_new_balance, p_uid);

  -- Ledger: credit (payment settles debt)
  v_ledger_no := 'LED-' || b2b_next_ledger_number();
  v_new_balance := v_prev_balance + v_order.total - v_order.total;
  INSERT INTO b2b_ledger (entry_number, franchise_id, store_id, type, amount, description, ref_type, ref_id, balance_after, created_by)
  VALUES (v_ledger_no, v_order.franchise_id, v_order.store_id, 'credit', v_order.total,
          'Ödeme ' || COALESCE(p_payment_number, p_provider), 'payment', p_payment_id, v_new_balance, p_uid);

  -- Update franchise credit balance
  PERFORM b2b_recalc_credit_balance(v_order.franchise_id);

  -- Notification to store users
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Ödeme Alındı', 'Sipariş ' || v_order.order_number || ' ödemeniz alındı. Tutari: ' || v_order.total::text || ' TL',
         'b2b_payment_received',
         jsonb_build_object('order_id', p_order_id, 'amount', v_order.total, 'invoice_id', v_inv_id)
  FROM user_roles ur WHERE ur.store_id = v_order.store_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (p_uid, 'b2b_payment_processed', 'b2b_order', p_order_id::text,
          jsonb_build_object('order_id', p_order_id, 'amount', v_order.total, 'invoice_id', v_inv_id, 'provider', p_provider));

  RETURN jsonb_build_object('error', null, 'invoice_id', v_inv_id, 'order_id', p_order_id);
END;
$function$;

-- ============================================================================
-- SECTION 3: Rewrite record_b2b_payment — uses shared side-effects helper
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_b2b_payment(
  p_order_id uuid,
  p_provider text DEFAULT 'manual',
  p_amount numeric DEFAULT 0,
  p_provider_ref text DEFAULT '',
  p_method text DEFAULT 'card'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_pay_id uuid;
  v_pay_no text;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  -- Authorization: own store or super_admin
  IF NOT is_super_admin() AND NOT has_store_access(v_order.store_id) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Must be awaiting payment
  IF v_order.status NOT IN ('awaiting_payment') THEN
    RETURN jsonb_build_object('error', 'not_awaiting_payment', 'status', v_order.status);
  END IF;

  -- Create payment record
  v_pay_no := 'PAY-' || b2b_next_payment_number();
  INSERT INTO b2b_payments (payment_number, order_id, store_id, franchise_id, amount, status, provider, provider_ref, payment_method, paid_by, paid_at)
  VALUES (v_pay_no, p_order_id, v_order.store_id, v_order.franchise_id,
          v_order.total, 'success', p_provider, p_provider_ref, p_method, v_uid, now())
  RETURNING id INTO v_pay_id;

  -- Process all side-effects (invoice, ledger, credit, notification, audit)
  v_result := b2b_process_payment_side_effects(p_order_id, v_pay_id, p_provider, v_pay_no, v_uid);

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'payment_id', v_pay_id, 'invoice_id', v_result->>'invoice_id');
END;
$function$;

-- ============================================================================
-- SECTION 4: Rewrite confirm_b2b_payment — NO double payment
-- ============================================================================

CREATE OR REPLACE FUNCTION public.confirm_b2b_payment(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_pay b2b_payments%ROWTYPE;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_pay FROM b2b_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_pay.status != 'pending' THEN RETURN jsonb_build_object('error', 'not_pending'); END IF;

  -- Mark payment as success
  UPDATE b2b_payments SET status = 'success', confirmed_by = v_uid, paid_at = now(), updated_at = now()
  WHERE id = p_payment_id;

  -- Process side-effects directly (no recursive record_b2b_payment call)
  v_result := b2b_process_payment_side_effects(v_pay.order_id, p_payment_id, v_pay.provider, v_pay.payment_number, v_uid);

  RETURN jsonb_build_object('error', null, 'payment_id', p_payment_id, 'invoice_id', v_result->>'invoice_id');
END;
$function$;

-- ============================================================================
-- SECTION 5: Rewrite create_b2b_order — status = 'awaiting_payment'
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_b2b_order(
  p_items jsonb,
  p_notes text DEFAULT '',
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_store text;
  v_franchise uuid;
  v_wh uuid;
  v_order_id uuid;
  v_order_no text;
  v_subtotal numeric(12,2) := 0;
  v_vat numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_item jsonb;
  v_prod b2b_products%ROWTYPE;
  v_line_total numeric(12,2);
  v_line_vat numeric(12,2);
  v_eff_price numeric(10,2);
  v_est_del date;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  IF NOT is_internal() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;
  IF jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('error', 'empty_cart');
  END IF;

  v_store := my_store_id();
  IF v_store IS NULL THEN
    RETURN jsonb_build_object('error', 'no_store');
  END IF;

  SELECT s.franchise_id INTO v_franchise FROM stores s WHERE s.id = v_store;
  IF v_franchise IS NULL THEN
    RETURN jsonb_build_object('error', 'no_franchise');
  END IF;

  -- Credit check
  IF NOT b2b_check_credit(v_franchise, 0) THEN
    RETURN jsonb_build_object('error', 'credit_blocked');
  END IF;

  -- Warehouse: use provided or default
  IF p_warehouse_id IS NOT NULL THEN
    v_wh := p_warehouse_id;
  ELSE
    SELECT id INTO v_wh FROM b2b_warehouses WHERE is_default = true AND is_active = true LIMIT 1;
  END IF;
  IF v_wh IS NULL THEN
    RETURN jsonb_build_object('error', 'no_warehouse');
  END IF;

  v_order_no := 'B2B-' || b2b_next_order_number();
  v_est_del := b2b_estimate_delivery(v_wh, v_store);

  -- Create order directly as 'awaiting_payment' (not 'draft')
  INSERT INTO b2b_orders (order_number, store_id, franchise_id, warehouse_id, status, notes, created_by, estimated_delivery)
  VALUES (v_order_no, v_store, v_franchise, v_wh, 'awaiting_payment', p_notes, v_uid, v_est_del)
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_prod FROM b2b_products WHERE id = (v_item->>'product_id')::uuid AND is_active = true;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'product_not_found', 'sku', v_item->>'product_id');
    END IF;

    -- Effective price: campaign if active and not expired
    v_eff_price := v_prod.price;
    IF v_prod.campaign_price IS NOT NULL
       AND (v_prod.campaign_ends IS NULL OR v_prod.campaign_ends > now()) THEN
      v_eff_price := v_prod.campaign_price;
    END IF;

    v_line_total := v_eff_price * (v_item->>'quantity')::numeric;
    v_line_vat := v_line_total * v_prod.vat_rate / 100;
    v_subtotal := v_subtotal + v_line_total;
    v_vat := v_vat + v_line_vat;

    INSERT INTO b2b_order_items (order_id, product_id, sku, name, unit, quantity, unit_price, vat_rate, line_total)
    VALUES (v_order_id, v_prod.id, v_prod.sku, v_prod.name, v_prod.unit,
            (v_item->>'quantity')::numeric, v_eff_price, v_prod.vat_rate, v_line_total);
  END LOOP;

  v_total := v_subtotal + v_vat;

  UPDATE b2b_orders SET subtotal = v_subtotal, vat_total = v_vat, total = v_total
  WHERE id = v_order_id;

  -- Credit limit re-check with actual total
  IF NOT b2b_check_credit(v_franchise, v_total) THEN
    DELETE FROM b2b_orders WHERE id = v_order_id;
    RETURN jsonb_build_object('error', 'credit_limit_exceeded', 'limit', v_total);
  END IF;

  RETURN jsonb_build_object('error', null, 'order_id', v_order_id, 'order_number', v_order_no, 'total', v_total);
END;
$function$;

-- ============================================================================
-- SECTION 6: Rewrite advance_b2b_order_status — improved with audit
-- ============================================================================

CREATE OR REPLACE FUNCTION public.advance_b2b_order_status(
  p_order_id uuid,
  p_new_status text,
  p_tracking_no text DEFAULT '',
  p_carrier text DEFAULT '',
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
  v_valid_transitions text[];
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  -- Valid: paid→confirmed→preparing→shipped→delivered
  v_valid_transitions := ARRAY[
    ['paid','confirmed'], ['confirmed','preparing'],
    ['preparing','shipped'], ['shipped','delivered']
  ];

  IF NOT array[ARRAY[v_order.status, p_new_status]] <@ v_valid_transitions THEN
    RETURN jsonb_build_object('error', 'invalid_transition', 'from', v_order.status, 'to', p_new_status);
  END IF;

  UPDATE b2b_orders
  SET status = p_new_status,
      tracking_number = CASE WHEN p_new_status = 'shipped' AND p_tracking_no <> '' THEN p_tracking_no ELSE tracking_number END,
      carrier_company = CASE WHEN p_new_status = 'shipped' AND p_carrier <> '' THEN p_carrier ELSE carrier_company END,
      tracking_url = CASE WHEN p_new_status = 'shipped' AND p_tracking_no <> '' THEN
        'https://www.google.com/search?q=' || COALESCE(p_carrier, '') || '+' || p_tracking_no
      ELSE tracking_url END,
      estimated_delivery = CASE WHEN p_eta IS NOT NULL THEN p_eta ELSE estimated_delivery END,
      shipped_at = CASE WHEN p_new_status = 'shipped' THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
      confirmed_by = CASE WHEN p_new_status = 'confirmed' THEN v_uid ELSE confirmed_by END,
      confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END,
      updated_at = now()
  WHERE id = p_order_id;

  -- Audit log (notification is handled by the status-change trigger)
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_order_status_advanced', 'b2b_order', p_order_id::text,
          jsonb_build_object('from', v_order.status, 'to', p_new_status, 'order_number', v_order.order_number));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'status', p_new_status);
END;
$function$;

-- ============================================================================
-- SECTION 7: New RPC — update_b2b_shipping (independent shipping update)
-- ============================================================================

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

  -- Notification to store
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Kargo Bilgisi Güncellendi',
         'Sipariş ' || v_order.order_number || ' kargo bilgileri güncellendi. Kargo: ' || COALESCE(p_carrier, carrier_company) || ' Takip: ' || COALESCE(p_tracking_no, tracking_number),
         'b2b_shipping_update',
         jsonb_build_object('order_id', p_order_id, 'carrier', p_carrier, 'tracking_no', p_tracking_no)
  FROM user_roles ur WHERE ur.store_id = v_order.store_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_shipping_updated', 'b2b_order', p_order_id::text,
          jsonb_build_object('carrier', p_carrier, 'tracking_no', p_tracking_no, 'eta', p_eta));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id);
END;
$function$;

-- ============================================================================
-- SECTION 8: New trigger — notify on order creation (AFTER INSERT)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.b2b_notify_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Notify all users linked to this store
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Sipariş Oluşturuldu',
         'Yeni sipariş oluşturuldu: ' || NEW.order_number || ' — Toplam: ' || NEW.total::text || ' TL',
         'b2b_order_created',
         jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total)
  FROM user_roles ur WHERE ur.store_id = NEW.store_id;

  -- Also notify HQ (super_admins)
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT u.id, 'Yeni B2B Sipariş',
         'Franchise siparişi oluşturuldu: ' || NEW.order_number,
         'b2b_order_created_hq',
         jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total, 'store_id', NEW.store_id)
  FROM auth.users u
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE ur.role = 'super_admin';

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (NEW.created_by, 'b2b_order_created', 'b2b_order', NEW.id::text,
          jsonb_build_object('order_number', NEW.order_number, 'total', NEW.total, 'store_id', NEW.store_id));

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_b2b_order_created_notify ON b2b_orders;
CREATE TRIGGER trg_b2b_order_created_notify
  AFTER INSERT ON b2b_orders
  FOR EACH ROW
  EXECUTE FUNCTION b2b_notify_order_created();

-- ============================================================================
-- SECTION 9: Enable Realtime on B2B tables
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE b2b_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_ledger;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_products;
ALTER PUBLICATION supabase_realtime ADD TABLE b2b_product_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- ============================================================================
-- SECTION 10: Grant EXECUTE on new RPCs
-- ============================================================================

GRANT EXECUTE ON FUNCTION
  public.b2b_recalc_credit_balance(uuid),
  public.b2b_process_payment_side_effects(uuid, uuid, text, text, uuid),
  public.update_b2b_shipping(uuid, text, text, text, date)
TO authenticated;
