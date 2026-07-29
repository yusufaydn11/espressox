/*
# Improve create_b2b_order error diagnostics

## Purpose
When a B2B order cannot be created because the user's store is not linked
to a franchise, the function previously returned a bare `{'error': 'no_franchise'}`
with no context. This made debugging difficult — the admin could not tell
which store, which user, or which missing record caused the failure.

## Changes
1. Replaces the bare `no_franchise` error with a detailed JSON object that
   includes:
   - `store_id` — the store that has no franchise link
   - `store_name` — the human-readable store name
   - `user_id` — the authenticated user who attempted the order
   - `user_email` — the user's email (joined from auth.users)
   - `detail` — a plain-English explanation of the problem and how to fix it
2. Also enriches the `no_store` error with the user_id and user_email so
   admins can identify users whose accounts lack a store assignment.
3. Adds `log_id` (a random UUID) to both errors so the same diagnostic
   context can be correlated in logs.

## Security
- No RLS or policy changes.
- No table structure changes.
- Function remains SECURITY DEFINER with `search_path = 'public'`.
- No new tables or columns.
*/

CREATE OR REPLACE FUNCTION public.create_b2b_order(
  p_items jsonb,
  p_notes text DEFAULT ''::text,
  p_warehouse_id uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_store text;
  v_store_name text;
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
  v_user_email text;
  v_log_id text;
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
    v_log_id := gen_random_uuid()::text;
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_uid;
    RETURN jsonb_build_object(
      'error', 'no_store',
      'error_code', 'NO_STORE_ASSIGNMENT',
      'log_id', v_log_id,
      'user_id', v_uid,
      'user_email', v_user_email,
      'detail', 'Bu kullanıcının user_roles kaydında store_id atanmamış. Admin panelinden kullanıcıya bir şube atayın.'
    );
  END IF;

  SELECT s.franchise_id, s.name INTO v_franchise, v_store_name FROM stores s WHERE s.id = v_store;
  IF v_franchise IS NULL THEN
    v_log_id := gen_random_uuid()::text;
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_uid;
    RETURN jsonb_build_object(
      'error', 'no_franchise',
      'error_code', 'STORE_NOT_LINKED_TO_FRANCHISE',
      'log_id', v_log_id,
      'store_id', v_store,
      'store_name', v_store_name,
      'user_id', v_uid,
      'user_email', v_user_email,
      'detail', format('"%s" (ID: %s) adlı şubenin franchise_id alanı boş. Admin panelindeki Şube yönetimi ekranından bu şubeyi bir franchise ile ilişkilendirin.', COALESCE(v_store_name, 'Bilinmeyen Şube'), v_store)
    );
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
