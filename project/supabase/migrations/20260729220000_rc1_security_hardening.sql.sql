/*
# RC-1 Security hardening

- Fix get_b2b_account_summary IDOR (franchise/HQ auth gate)
- Remove direct B2B order/item INSERT bypass (force RPC path)
*/

-- ─── Fix IDOR on account summary ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_b2b_account_summary(p_franchise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_debit numeric(12,2);
  v_credit numeric(12,2);
  v_balance numeric(12,2);
  v_open_invoices jsonb;
  v_recent jsonb;
  v_credit_info jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  IF NOT (
    is_admin()
    OR b2b_franchise_id() = p_franchise_id
  ) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN type='credit' THEN amount ELSE 0 END), 0)
  INTO v_debit, v_credit
  FROM b2b_ledger WHERE franchise_id = p_franchise_id;

  v_balance := v_debit - v_credit;

  SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.created_at DESC), '[]'::jsonb)
  INTO v_open_invoices
  FROM (
    SELECT id, invoice_number, total, paid_amount, status, due_date, created_at
    FROM b2b_invoices
    WHERE franchise_id = p_franchise_id AND status IN ('issued','partial')
    ORDER BY created_at DESC LIMIT 5
  ) i;

  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT entry_number, type, amount, description, created_at
    FROM b2b_ledger
    WHERE franchise_id = p_franchise_id
    ORDER BY created_at DESC LIMIT 10
  ) l;

  SELECT to_jsonb(c) INTO v_credit_info
  FROM (
    SELECT credit_limit, current_balance, risk_status, payment_terms_days
    FROM b2b_franchise_credit WHERE franchise_id = p_franchise_id
  ) c;

  RETURN jsonb_build_object(
    'balance', v_balance,
    'total_debit', v_debit,
    'total_credit', v_credit,
    'open_invoices', v_open_invoices,
    'recent_movements', v_recent,
    'credit', v_credit_info
  );
END;
$function$;

-- ─── Force B2B order creation via RPC only ────────────────────
DROP POLICY IF EXISTS "b2b_orders_insert_own" ON b2b_orders;

DROP POLICY IF EXISTS "b2b_items_insert_own" ON b2b_order_items;
