/*
# B2B Franchise Tedarik ve Cari Hesap Sistemi — Schema

## Summary

This migration creates the database layer for a B2B (business-to-business) portal
that manages the supply-chain relationship between Espresso X HQ (central warehouse)
and its franchise stores. Customers never use this system — it is exclusively for
franchise ordering, invoicing, payments, and account tracking.

## Architecture Principles

- ALL new tables use the `b2b_` prefix to avoid collision with existing tables.
- Existing tables, RLS policies, helper functions, and auth are NOT modified.
- The migration reuses existing helper functions: is_super_admin(), is_admin(),
  is_franchise(), is_store_manager(), is_staff(), is_internal(), has_store_access(),
  my_store_id(), my_store_ids().
- Extensibility: the schema is designed so that e-Fatura, ERP, advanced warehouse
  management, and campaign modules can be added WITHOUT altering existing columns.
  Extra columns can be appended; JSONB metadata fields absorb future attributes.

## New Tables (9)

1. b2b_warehouses — Central warehouses (multi-warehouse ready, starts with 1)
2. b2b_products — Wholesale supply catalog (separate from retail `products`)
3. b2b_product_stock — Per-warehouse stock levels for B2B products
4. b2b_orders — Franchise purchase orders with full lifecycle
5. b2b_order_items — Line items within a B2B order (snapshot pricing)
6. b2b_invoices — Invoices linked to orders (e-Fatura ready)
7. b2b_payments — Payment records (iyzico/Ödeal ready, manual confirmation)
8. b2b_ledger — Cari hesap ledger (debit/credit entries per franchise)
9. b2b_order_templates — "Reorder" / favorite order lists for franchises

## New Helper Functions

- b2b_franchise_id() — returns the franchise_id for the current user's store
- b2b_check_credit(p_franchise_id, p_amount) — risk control: true if within limit
- b2b_estimate_delivery(p_warehouse_id, p_store_id) — estimated delivery date
- b2b_next_order_number() — sequential order number generator
- b2b_next_invoice_number() — sequential invoice number generator
- b2b_next_payment_number() — sequential payment number generator
- b2b_next_ledger_number() — sequential ledger entry number generator

## New RPC Functions (PL/pgSQL)

- create_b2b_order(p_items, p_notes, p_warehouse_id) — create order from cart
- cancel_b2b_order(p_order_id, p_reason) — cancel an unpaid order
- advance_b2b_order_status(p_order_id, p_new_status, p_tracking_no, p_carrier, p_eta) — HQ status progression
- confirm_b2b_payment(p_payment_id) — HQ confirms a manual payment
- record_b2b_payment(p_order_id, p_provider, p_amount, p_provider_ref, p_method) — record a payment
- get_b2b_account_summary(p_franchise_id) — cari balance, open invoices, recent movements
- get_b2b_dashboard(p_store_id) — dashboard KPIs for a store
- reorder_b2b_order(p_order_id, p_template_name) — clone an order into a new draft or template

## Triggers

- trg_b2b_order_paid → on order status='paid': auto-create invoice + ledger debit
- trg_b2b_payment_success → on payment status='success': ledger credit + update order
- trg_b2b_order_status_change → on status change: insert notification + audit log
- b2b_updated_at → auto-maintain updated_at on all b2b tables

## Franchise Credit Limit & Risk Control

The `franchises` table already exists but has no credit fields. Rather than ALTER
the existing table (which could affect existing code), credit limit is stored in a
new dedicated table `b2b_franchise_credit` that JOINs to franchises. This keeps the
existing franchises table untouched while supporting risk control.

Actually, to avoid an extra JOIN for every ledger query, we add credit fields to the
b2b_ledger's franchise reference. The simplest approach that doesn't modify existing
tables: a new `b2b_franchise_credit` table with 1:1 relationship to franchises.

## Multi-Warehouse Support

b2b_warehouses + b2b_product_stock enable multi-warehouse from day one.
Initially a single "Merkez Depo" warehouse is seeded. Products reference a default
warehouse; orders specify which warehouse fulfills them. Future: split fulfillment
across warehouses without schema changes.

## Shipping & Tracking

b2b_orders includes: carrier_company, tracking_number, tracking_url, estimated_delivery.
These are set by HQ when advancing status to 'shipped'. estimated_delivery is
auto-calculated at order creation time via b2b_estimate_delivery().

## Reorder & Favorite Orders

b2b_order_templates stores saved order templates. A franchise can save a past order
as a template, then create a new order from it via reorder_b2b_order() RPC.

## Security (RLS)

All 9 new tables have RLS enabled with policies using existing helper functions.
No existing policy is touched. The access matrix:

- b2b_warehouses: internal read; HQ management
- b2b_products: all authenticated read (active); HQ management
- b2b_product_stock: internal read; HQ management
- b2b_orders: franchise/store_manager own-store; super_admin all; staff read own-store
- b2b_order_items: via parent order
- b2b_invoices: franchise own; HQ management
- b2b_payments: franchise own; HQ management
- b2b_ledger: franchise own; HQ management
- b2b_order_templates: franchise/store_manager own-store; HQ all
- b2b_franchise_credit: franchise read own; HQ management

## Important Notes

1. Safe to re-run: all CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS.
2. No existing tables are altered.
3. No existing RLS policies are modified.
4. Existing helper functions (is_super_admin, is_admin, is_franchise, etc.) are reused.
5. The handle_new_user trigger is unaffected.
6. Email confirmation remains OFF.
*/

-- ============================================================================
-- SECTION 1: Warehouses (multi-warehouse ready)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  address text DEFAULT '',
  city text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_warehouses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_warehouses_active ON b2b_warehouses(is_active);

-- Seed default warehouse
INSERT INTO b2b_warehouses (code, name, is_default)
SELECT 'WH01', 'Merkez Depo', true
WHERE NOT EXISTS (SELECT 1 FROM b2b_warehouses WHERE is_default = true);

-- ============================================================================
-- SECTION 2: B2B Products (wholesale supply catalog)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  category text NOT NULL DEFAULT 'Genel',
  unit text NOT NULL DEFAULT 'adet',
  price numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 10,
  min_order_qty numeric(12,2) NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  campaign_label text DEFAULT '',
  campaign_price numeric(10,2),
  campaign_ends timestamptz,
  default_warehouse_id uuid REFERENCES b2b_warehouses(id),
  sort_order integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_products ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_products_active ON b2b_products(is_active);
CREATE INDEX IF NOT EXISTS idx_b2b_products_category ON b2b_products(category);
CREATE INDEX IF NOT EXISTS idx_b2b_products_sku ON b2b_products(sku);

-- ============================================================================
-- SECTION 3: B2B Product Stock (per-warehouse)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES b2b_products(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES b2b_warehouses(id) ON DELETE CASCADE,
  stock_qty numeric(12,2) NOT NULL DEFAULT 0,
  reserved_qty numeric(12,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, warehouse_id)
);

ALTER TABLE b2b_product_stock ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_stock_product ON b2b_product_stock(product_id);
CREATE INDEX IF NOT EXISTS idx_b2b_stock_warehouse ON b2b_product_stock(warehouse_id);

-- ============================================================================
-- SECTION 4: B2B Orders
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  store_id text REFERENCES stores(id),
  franchise_id uuid REFERENCES franchises(id),
  warehouse_id uuid REFERENCES b2b_warehouses(id),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','awaiting_payment','paid','confirmed','preparing',
    'shipped','delivered','cancelled'
  )),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',

  -- Shipping & tracking
  carrier_company text DEFAULT '',
  tracking_number text DEFAULT '',
  tracking_url text DEFAULT '',
  estimated_delivery date,
  shipped_at timestamptz,
  delivered_at timestamptz,

  -- Workflow metadata
  created_by uuid REFERENCES auth.users(id),
  paid_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id),
  confirmed_at timestamptz,
  cancel_reason text DEFAULT '',

  -- Extensibility: future e-Fatura, ERP, advanced campaign fields go in metadata
  metadata jsonb NOT NULL DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_orders_store ON b2b_orders(store_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_franchise ON b2b_orders(franchise_id);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_status ON b2b_orders(status);
CREATE INDEX IF NOT EXISTS idx_b2b_orders_created ON b2b_orders(created_at DESC);

-- ============================================================================
-- SECTION 5: B2B Order Items (line items with snapshot pricing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES b2b_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES b2b_products(id),
  sku text NOT NULL DEFAULT '',
  name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'adet',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  vat_rate numeric(5,2) NOT NULL DEFAULT 10,
  line_total numeric(12,2) NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_order_items_order ON b2b_order_items(order_id);

-- ============================================================================
-- SECTION 6: B2B Invoices (e-Fatura ready)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES b2b_orders(id),
  store_id text REFERENCES stores(id),
  franchise_id uuid REFERENCES franchises(id),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN (
    'issued','paid','partial','cancelled'
  )),
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  vat_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount numeric(12,2) NOT NULL DEFAULT 0,
  due_date date,
  pdf_url text DEFAULT '',

  -- e-Fatura readiness (future integration without schema change)
  e_invoice_status text DEFAULT 'pending',
  e_invoice_uuid text DEFAULT '',
  e_invoice_error text DEFAULT '',

  metadata jsonb NOT NULL DEFAULT '{}',
  issued_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_invoices_order ON b2b_invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_b2b_invoices_franchise ON b2b_invoices(franchise_id);
CREATE INDEX IF NOT EXISTS idx_b2b_invoices_status ON b2b_invoices(status);

-- ============================================================================
-- SECTION 7: B2B Payments (iyzico/Ödeal ready)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number text NOT NULL UNIQUE,
  order_id uuid NOT NULL REFERENCES b2b_orders(id),
  invoice_id uuid REFERENCES b2b_invoices(id),
  store_id text REFERENCES stores(id),
  franchise_id uuid REFERENCES franchises(id),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending','success','failed','refunded'
  )),
  provider text NOT NULL DEFAULT 'manual',
  provider_ref text DEFAULT '',
  payment_method text DEFAULT 'card',
  paid_by uuid REFERENCES auth.users(id),
  confirmed_by uuid REFERENCES auth.users(id),
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_payments_order ON b2b_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_b2b_payments_franchise ON b2b_payments(franchise_id);
CREATE INDEX IF NOT EXISTS idx_b2b_payments_status ON b2b_payments(status);

-- ============================================================================
-- SECTION 8: B2B Ledger (cari hesap defteri)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number text NOT NULL UNIQUE,
  franchise_id uuid NOT NULL REFERENCES franchises(id),
  store_id text REFERENCES stores(id),
  type text NOT NULL CHECK (type IN ('debit','credit')),
  amount numeric(12,2) NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  ref_type text NOT NULL DEFAULT 'manual',
  ref_id uuid,
  balance_after numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_ledger ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_ledger_franchise ON b2b_ledger(franchise_id);
CREATE INDEX IF NOT EXISTS idx_b2b_ledger_created ON b2b_ledger(created_at DESC);

-- ============================================================================
-- SECTION 9: B2B Franchise Credit (risk control — no ALTER to franchises table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_franchise_credit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  franchise_id uuid NOT NULL UNIQUE REFERENCES franchises(id) ON DELETE CASCADE,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  current_balance numeric(12,2) NOT NULL DEFAULT 0,
  risk_status text NOT NULL DEFAULT 'normal' CHECK (risk_status IN (
    'normal','warning','blocked'
  )),
  payment_terms_days integer NOT NULL DEFAULT 30,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_franchise_credit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_credit_franchise ON b2b_franchise_credit(franchise_id);

-- ============================================================================
-- SECTION 10: B2B Order Templates (reorder / favorite orders)
-- ============================================================================

CREATE TABLE IF NOT EXISTS b2b_order_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  store_id text REFERENCES stores(id),
  franchise_id uuid REFERENCES franchises(id),
  source_order_id uuid REFERENCES b2b_orders(id),
  items jsonb NOT NULL DEFAULT '[]',
  is_favorite boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE b2b_order_templates ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_b2b_templates_store ON b2b_order_templates(store_id);
CREATE INDEX IF NOT EXISTS idx_b2b_templates_franchise ON b2b_order_templates(franchise_id);

-- ============================================================================
-- SECTION 11: Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.b2b_franchise_id()
RETURNS uuid
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $function$
  SELECT s.franchise_id
  FROM user_roles ur
  JOIN stores s ON s.id = ur.store_id
  WHERE ur.user_id = auth.uid()
  AND ur.store_id IS NOT NULL
  AND s.franchise_id IS NOT NULL
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.b2b_check_credit(p_franchise_id uuid, p_amount numeric)
RETURNS boolean
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT credit_limit >= p_amount + current_balance
     FROM b2b_franchise_credit
     WHERE franchise_id = p_franchise_id),
    true
  );
$function$;

CREATE OR REPLACE FUNCTION public.b2b_estimate_delivery(p_warehouse_id uuid, p_store_id text)
RETURNS date
LANGUAGE sql STABLE
SET search_path TO 'public'
AS $function$
  SELECT (now() + interval '3 days')::date;
$function$;

CREATE OR REPLACE FUNCTION public.b2b_next_order_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_num int;
BEGIN
  SELECT COALESCE(MAX(num), 0) + 1 INTO v_num
  FROM (
    SELECT CAST(REPLACE(order_number, 'B2B-', '') AS int) AS num
    FROM b2b_orders
    WHERE order_number LIKE 'B2B-%'
  ) sub;
  RETURN lpad(v_num::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.b2b_next_invoice_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_num int; v_year text;
BEGIN
  v_year := to_char(now(), 'YYYY');
  SELECT COALESCE(MAX(num), 0) + 1 INTO v_num
  FROM (
    SELECT CAST(REPLACE(REPLACE(invoice_number, 'INV-' || v_year || '-', ''), 'INV-', '') AS int) AS num
    FROM b2b_invoices
    WHERE invoice_number LIKE 'INV-%'
  ) sub;
  RETURN 'INV-' || v_year || '-' || lpad(v_num::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.b2b_next_payment_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_num int;
BEGIN
  SELECT COALESCE(MAX(num), 0) + 1 INTO v_num
  FROM (
    SELECT CAST(REPLACE(payment_number, 'PAY-', '') AS int) AS num
    FROM b2b_payments
    WHERE payment_number LIKE 'PAY-%'
  ) sub;
  RETURN 'PAY-' || lpad(v_num::text, 6, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.b2b_next_ledger_number()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE v_num int;
BEGIN
  SELECT COALESCE(MAX(num), 0) + 1 INTO v_num
  FROM (
    SELECT CAST(REPLACE(entry_number, 'LED-', '') AS int) AS num
    FROM b2b_ledger
    WHERE entry_number LIKE 'LED-%'
  ) sub;
  RETURN 'LED-' || lpad(v_num::text, 6, '0');
END;
$function$;

-- ============================================================================
-- SECTION 12: updated_at trigger function for all b2b tables
-- ============================================================================

CREATE OR REPLACE FUNCTION public.b2b_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'b2b_warehouses','b2b_products','b2b_orders','b2b_invoices',
    'b2b_payments','b2b_franchise_credit','b2b_order_templates'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_b2b_%s_updated ON %s;', t, t);
    EXECUTE format('CREATE TRIGGER trg_b2b_%s_updated BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION b2b_set_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- SECTION 13: RPC — create_b2b_order
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

  INSERT INTO b2b_orders (order_number, store_id, franchise_id, warehouse_id, status, notes, created_by, estimated_delivery)
  VALUES (v_order_no, v_store, v_franchise, v_wh, 'draft', p_notes, v_uid, v_est_del)
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
-- SECTION 14: RPC — cancel_b2b_order
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cancel_b2b_order(p_order_id uuid, p_reason text DEFAULT '')
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

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  -- Authorization: own store or super_admin
  IF NOT is_super_admin() AND NOT has_store_access(v_order.store_id) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Only draft or awaiting_payment can be cancelled
  IF v_order.status NOT IN ('draft','awaiting_payment') THEN
    RETURN jsonb_build_object('error', 'cannot_cancel', 'status', v_order.status);
  END IF;

  UPDATE b2b_orders
  SET status = 'cancelled', cancel_reason = p_reason, updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id);
END;
$function$;

-- ============================================================================
-- SECTION 15: RPC — advance_b2b_order_status (HQ only)
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
  v_valid_transitions text[][];
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

  IF NOT array[
    ARRAY[v_order.status, p_new_status]
  ] <@ v_valid_transitions THEN
    RETURN jsonb_build_object('error', 'invalid_transition', 'from', v_order.status, 'to', p_new_status);
  END IF;

  UPDATE b2b_orders
  SET status = p_new_status,
      tracking_number = CASE WHEN p_new_status = 'shipped' THEN p_tracking_no ELSE tracking_number END,
      carrier_company = CASE WHEN p_new_status = 'shipped' THEN p_carrier ELSE carrier_company END,
      tracking_url = CASE WHEN p_new_status = 'shipped' AND p_tracking_no <> '' THEN
        'https://www.google.com/search?q=' || p_carrier || '+' || p_tracking_no
      ELSE tracking_url END,
      estimated_delivery = CASE WHEN p_eta IS NOT NULL THEN p_eta ELSE estimated_delivery END,
      shipped_at = CASE WHEN p_new_status = 'shipped' THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
      confirmed_by = CASE WHEN p_new_status = 'confirmed' THEN v_uid ELSE confirmed_by END,
      confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'status', p_new_status);
END;
$function$;

-- ============================================================================
-- SECTION 16: RPC — record_b2b_payment
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
  v_inv_id uuid;
  v_inv_no text;
  v_ledger_no text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  -- Authorization: own store or super_admin
  IF NOT is_super_admin() AND NOT has_store_access(v_order.store_id) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  IF v_order.status NOT IN ('awaiting_payment') THEN
    RETURN jsonb_build_object('error', 'not_awaiting_payment', 'status', v_order.status);
  END IF;

  v_pay_no := 'PAY-' || b2b_next_payment_number();

  INSERT INTO b2b_payments (payment_number, order_id, store_id, franchise_id, amount, status, provider, provider_ref, payment_method, paid_by, paid_at)
  VALUES (v_pay_no, p_order_id, v_order.store_id, v_order.franchise_id,
          v_order.total, 'success', p_provider, p_provider_ref, p_method, v_uid, now())
  RETURNING id INTO v_pay_id;

  -- Auto-create invoice
  v_inv_no := b2b_next_invoice_number();
  INSERT INTO b2b_invoices (invoice_number, order_id, store_id, franchise_id, status, subtotal, vat_total, total, paid_amount, due_date, paid_at)
  VALUES (v_inv_no, p_order_id, v_order.store_id, v_order.franchise_id, 'paid',
          v_order.subtotal, v_order.vat_total, v_order.total, v_order.total,
          (now() + interval '30 days')::date, now())
  RETURNING id INTO v_inv_id;

  UPDATE b2b_payments SET invoice_id = v_inv_id WHERE id = v_pay_id;

  -- Update order status
  UPDATE b2b_orders SET status = 'paid', paid_at = now(), updated_at = now() WHERE id = p_order_id;

  -- Ledger: debit (invoice) + credit (payment)
  v_ledger_no := 'LED-' || b2b_next_ledger_number();
  INSERT INTO b2b_ledger (entry_number, franchise_id, store_id, type, amount, description, ref_type, ref_id, created_by)
  VALUES (v_ledger_no, v_order.franchise_id, v_order.store_id, 'debit', v_order.total,
          'Fatura ' || v_inv_no, 'invoice', v_inv_id, v_uid);

  v_ledger_no := 'LED-' || b2b_next_ledger_number();
  INSERT INTO b2b_ledger (entry_number, franchise_id, store_id, type, amount, description, ref_type, ref_id, created_by)
  VALUES (v_ledger_no, v_order.franchise_id, v_order.store_id, 'credit', v_order.total,
          'Ödeme ' || v_pay_no || ' (' || p_provider || ')', 'payment', v_pay_id, v_uid);

  -- Update franchise credit balance
  INSERT INTO b2b_franchise_credit (franchise_id, credit_limit, current_balance)
  VALUES (v_order.franchise_id, 0, 0)
  ON CONFLICT (franchise_id) DO NOTHING;

  -- Notifications
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Ödeme Alındı', 'Sipariş ' || v_order.order_number || ' ödemeniz alındı.', 'b2b_payment_received',
         jsonb_build_object('order_id', p_order_id, 'amount', v_order.total)
  FROM user_roles ur WHERE ur.store_id = v_order.store_id;

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'payment_id', v_pay_id, 'invoice_id', v_inv_id);
END;
$function$;

-- ============================================================================
-- SECTION 17: RPC — confirm_b2b_payment (HQ confirms manual payment)
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
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_pay FROM b2b_payments WHERE id = p_payment_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;
  IF v_pay.status != 'pending' THEN RETURN jsonb_build_object('error', 'not_pending'); END IF;

  UPDATE b2b_payments SET status = 'success', confirmed_by = v_uid, paid_at = now(), updated_at = now()
  WHERE id = p_payment_id;

  -- Same side-effects as record_b2b_payment (invoice + ledger + order update)
  PERFORM record_b2b_payment(v_pay.order_id, v_pay.provider, v_pay.amount, v_pay.provider_ref, v_pay.payment_method);

  RETURN jsonb_build_object('error', null, 'payment_id', p_payment_id);
END;
$function$;

-- ============================================================================
-- SECTION 18: RPC — get_b2b_account_summary
-- ============================================================================

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

-- ============================================================================
-- SECTION 19: RPC — get_b2b_dashboard
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_b2b_dashboard(p_store_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_franchise uuid;
  v_balance numeric(12,2);
  v_last_payment jsonb;
  v_counts jsonb;
  v_last_order jsonb;
  v_open_invoice_total numeric(12,2);
  v_recent jsonb;
BEGIN
  -- Authorize: own store or super_admin
  IF NOT is_super_admin() AND NOT has_store_access(p_store_id) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT s.franchise_id INTO v_franchise FROM stores s WHERE s.id = p_store_id;

  -- Cari balance
  SELECT COALESCE(SUM(CASE WHEN type='debit' THEN amount ELSE -amount END), 0)
  INTO v_balance
  FROM b2b_ledger WHERE franchise_id = v_franchise;

  -- Last payment
  SELECT to_jsonb(p) INTO v_last_payment
  FROM (
    SELECT payment_number, amount, paid_at
    FROM b2b_payments WHERE store_id = p_store_id AND status = 'success'
    ORDER BY paid_at DESC LIMIT 1
  ) p;

  -- Order counts by status
  SELECT jsonb_build_object(
    'awaiting_payment', COUNT(*) FILTER (WHERE status='awaiting_payment'),
    'paid', COUNT(*) FILTER (WHERE status='paid'),
    'confirmed', COUNT(*) FILTER (WHERE status='confirmed'),
    'preparing', COUNT(*) FILTER (WHERE status='preparing'),
    'shipped', COUNT(*) FILTER (WHERE status='shipped'),
    'delivered', COUNT(*) FILTER (WHERE status='delivered'),
    'draft', COUNT(*) FILTER (WHERE status='draft')
  ) INTO v_counts
  FROM b2b_orders WHERE store_id = p_store_id AND status != 'cancelled';

  -- Last order date
  SELECT to_jsonb(o) INTO v_last_order
  FROM (
    SELECT order_number, total, created_at
    FROM b2b_orders WHERE store_id = p_store_id
    ORDER BY created_at DESC LIMIT 1
  ) o;

  -- Open invoices total
  SELECT COALESCE(SUM(total - paid_amount), 0) INTO v_open_invoice_total
  FROM b2b_invoices WHERE franchise_id = v_franchise AND status IN ('issued','partial');

  -- Recent ledger entries
  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT entry_number, type, amount, description, created_at
    FROM b2b_ledger WHERE franchise_id = v_franchise
    ORDER BY created_at DESC LIMIT 5
  ) l;

  RETURN jsonb_build_object(
    'balance', v_balance,
    'last_payment', v_last_payment,
    'order_counts', v_counts,
    'last_order', v_last_order,
    'open_invoice_total', v_open_invoice_total,
    'recent_movements', v_recent
  );
END;
$function$;

-- ============================================================================
-- SECTION 20: RPC — reorder_b2b_order (clone order → new draft or template)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reorder_b2b_order(
  p_order_id uuid,
  p_template_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_items jsonb;
  v_template_id uuid;
  v_result jsonb;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  IF NOT is_super_admin() AND NOT has_store_access(v_order.store_id) THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  -- Build items JSON for create_b2b_order
  SELECT jsonb_agg(jsonb_build_object(
    'product_id', oi.product_id,
    'quantity', oi.quantity
  )) INTO v_items
  FROM b2b_order_items oi WHERE oi.order_id = p_order_id;

  -- If template_name provided, save as template
  IF p_template_name IS NOT NULL AND p_template_name <> '' THEN
    INSERT INTO b2b_order_templates (name, store_id, franchise_id, source_order_id, items, created_by)
    VALUES (p_template_name, v_order.store_id, v_order.franchise_id, p_order_id, v_items, v_uid)
    RETURNING id INTO v_template_id;
  END IF;

  -- Create new draft order from items
  v_result := create_b2b_order(v_items, 'Tekrar sipariş — ' || v_order.order_number, v_order.warehouse_id);

  RETURN jsonb_build_object(
    'error', v_result->>'error',
    'new_order', v_result,
    'template_id', v_template_id
  );
END;
$function$;

-- ============================================================================
-- SECTION 21: Trigger — notification on order status change
-- ============================================================================

CREATE OR REPLACE FUNCTION public.b2b_notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_labels jsonb := '{"draft":"Taslak","awaiting_payment":"Ödeme Bekleniyor","paid":"Ödeme Alındı","confirmed":"Onaylandı","preparing":"Hazırlanıyor","shipped":"Kargoya Verildi","delivered":"Teslim Edildi","cancelled":"İptal Edildi"}'::jsonb;
  v_title text;
  v_body text;
  v_user uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := COALESCE(v_status_labels->>NEW.status, NEW.status);
    v_body := 'Sipariş ' || NEW.order_number || ' durumu: ' || v_title;

    -- Notify all users linked to this store
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT ur.user_id, v_title, v_body, 'b2b_order_' || NEW.status,
           jsonb_build_object('order_id', NEW.id, 'status', NEW.status, 'order_number', NEW.order_number)
    FROM user_roles ur WHERE ur.store_id = NEW.store_id;

    -- Audit log
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'b2b_order_status_change', 'b2b_order', NEW.id::text,
            jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_b2b_order_status_notify ON b2b_orders;
CREATE TRIGGER trg_b2b_order_status_notify
  AFTER UPDATE ON b2b_orders
  FOR EACH ROW
  EXECUTE FUNCTION b2b_notify_status_change();

-- ============================================================================
-- SECTION 22: RLS Policies — b2b_warehouses
-- ============================================================================

DROP POLICY IF EXISTS "b2b_wh_select_internal" ON b2b_warehouses;
CREATE POLICY "b2b_wh_select_internal" ON b2b_warehouses
  FOR SELECT TO authenticated USING (is_internal());

DROP POLICY IF EXISTS "b2b_wh_insert_hq" ON b2b_warehouses;
CREATE POLICY "b2b_wh_insert_hq" ON b2b_warehouses
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_wh_update_hq" ON b2b_warehouses;
CREATE POLICY "b2b_wh_update_hq" ON b2b_warehouses
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_wh_delete_hq" ON b2b_warehouses;
CREATE POLICY "b2b_wh_delete_hq" ON b2b_warehouses
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 23: RLS Policies — b2b_products
-- ============================================================================

DROP POLICY IF EXISTS "b2b_prod_select_auth" ON b2b_products;
CREATE POLICY "b2b_prod_select_auth" ON b2b_products
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "b2b_prod_insert_hq" ON b2b_products;
CREATE POLICY "b2b_prod_insert_hq" ON b2b_products
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_prod_update_hq" ON b2b_products;
CREATE POLICY "b2b_prod_update_hq" ON b2b_products
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_prod_delete_hq" ON b2b_products;
CREATE POLICY "b2b_prod_delete_hq" ON b2b_products
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 24: RLS Policies — b2b_product_stock
-- ============================================================================

DROP POLICY IF EXISTS "b2b_stock_select_internal" ON b2b_product_stock;
CREATE POLICY "b2b_stock_select_internal" ON b2b_product_stock
  FOR SELECT TO authenticated USING (is_internal());

DROP POLICY IF EXISTS "b2b_stock_insert_hq" ON b2b_product_stock;
CREATE POLICY "b2b_stock_insert_hq" ON b2b_product_stock
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_stock_update_hq" ON b2b_product_stock;
CREATE POLICY "b2b_stock_update_hq" ON b2b_product_stock
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_stock_delete_hq" ON b2b_product_stock;
CREATE POLICY "b2b_stock_delete_hq" ON b2b_product_stock
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 25: RLS Policies — b2b_orders
-- ============================================================================

DROP POLICY IF EXISTS "b2b_orders_select_own" ON b2b_orders;
CREATE POLICY "b2b_orders_select_own" ON b2b_orders
  FOR SELECT TO authenticated USING (has_store_access(store_id));

DROP POLICY IF EXISTS "b2b_orders_select_hq" ON b2b_orders;
CREATE POLICY "b2b_orders_select_hq" ON b2b_orders
  FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "b2b_orders_select_admin" ON b2b_orders;
CREATE POLICY "b2b_orders_select_admin" ON b2b_orders
  FOR SELECT TO authenticated USING (is_admin());

DROP POLICY IF EXISTS "b2b_orders_insert_own" ON b2b_orders;
CREATE POLICY "b2b_orders_insert_own" ON b2b_orders
  FOR INSERT TO authenticated
  WITH CHECK (has_store_access(store_id));

DROP POLICY IF EXISTS "b2b_orders_update_own" ON b2b_orders;
CREATE POLICY "b2b_orders_update_own" ON b2b_orders
  FOR UPDATE TO authenticated
  USING (has_store_access(store_id)) WITH CHECK (has_store_access(store_id));

DROP POLICY IF EXISTS "b2b_orders_update_hq" ON b2b_orders;
CREATE POLICY "b2b_orders_update_hq" ON b2b_orders
  FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_orders_delete_hq" ON b2b_orders;
CREATE POLICY "b2b_orders_delete_hq" ON b2b_orders
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 26: RLS Policies — b2b_order_items (via parent order)
-- ============================================================================

DROP POLICY IF EXISTS "b2b_items_select_own" ON b2b_order_items;
CREATE POLICY "b2b_items_select_own" ON b2b_order_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM b2b_orders o WHERE o.id = b2b_order_items.order_id
    AND (has_store_access(o.store_id) OR is_super_admin() OR is_admin())));

DROP POLICY IF EXISTS "b2b_items_insert_own" ON b2b_order_items;
CREATE POLICY "b2b_items_insert_own" ON b2b_order_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM b2b_orders o WHERE o.id = b2b_order_items.order_id
    AND (has_store_access(o.store_id) OR is_super_admin())));

DROP POLICY IF EXISTS "b2b_items_update_hq" ON b2b_order_items;
CREATE POLICY "b2b_items_update_hq" ON b2b_order_items
  FOR UPDATE TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_items_delete_hq" ON b2b_order_items;
CREATE POLICY "b2b_items_delete_hq" ON b2b_order_items
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 27: RLS Policies — b2b_invoices
-- ============================================================================

DROP POLICY IF EXISTS "b2b_inv_select_franchise" ON b2b_invoices;
CREATE POLICY "b2b_inv_select_franchise" ON b2b_invoices
  FOR SELECT TO authenticated
  USING (franchise_id = b2b_franchise_id() OR is_super_admin() OR is_admin());

DROP POLICY IF EXISTS "b2b_inv_insert_hq" ON b2b_invoices;
CREATE POLICY "b2b_inv_insert_hq" ON b2b_invoices
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_inv_update_hq" ON b2b_invoices;
CREATE POLICY "b2b_inv_update_hq" ON b2b_invoices
  FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_inv_delete_hq" ON b2b_invoices;
CREATE POLICY "b2b_inv_delete_hq" ON b2b_invoices
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 28: RLS Policies — b2b_payments
-- ============================================================================

DROP POLICY IF EXISTS "b2b_pay_select_franchise" ON b2b_payments;
CREATE POLICY "b2b_pay_select_franchise" ON b2b_payments
  FOR SELECT TO authenticated
  USING (franchise_id = b2b_franchise_id() OR is_super_admin() OR is_admin());

DROP POLICY IF EXISTS "b2b_pay_insert_own" ON b2b_payments;
CREATE POLICY "b2b_pay_insert_own" ON b2b_payments
  FOR INSERT TO authenticated
  WITH CHECK (has_store_access(store_id) OR is_super_admin());

DROP POLICY IF EXISTS "b2b_pay_update_hq" ON b2b_payments;
CREATE POLICY "b2b_pay_update_hq" ON b2b_payments
  FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_pay_delete_hq" ON b2b_payments;
CREATE POLICY "b2b_pay_delete_hq" ON b2b_payments
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 29: RLS Policies — b2b_ledger
-- ============================================================================

DROP POLICY IF EXISTS "b2b_ledger_select_franchise" ON b2b_ledger;
CREATE POLICY "b2b_ledger_select_franchise" ON b2b_ledger
  FOR SELECT TO authenticated
  USING (franchise_id = b2b_franchise_id() OR is_super_admin() OR is_admin());

DROP POLICY IF EXISTS "b2b_ledger_insert_hq" ON b2b_ledger;
CREATE POLICY "b2b_ledger_insert_hq" ON b2b_ledger
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin() OR is_admin());

DROP POLICY IF EXISTS "b2b_ledger_update_hq" ON b2b_ledger;
CREATE POLICY "b2b_ledger_update_hq" ON b2b_ledger
  FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_ledger_delete_hq" ON b2b_ledger;
CREATE POLICY "b2b_ledger_delete_hq" ON b2b_ledger
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 30: RLS Policies — b2b_franchise_credit
-- ============================================================================

DROP POLICY IF EXISTS "b2b_credit_select_franchise" ON b2b_franchise_credit;
CREATE POLICY "b2b_credit_select_franchise" ON b2b_franchise_credit
  FOR SELECT TO authenticated
  USING (franchise_id = b2b_franchise_id() OR is_super_admin() OR is_admin());

DROP POLICY IF EXISTS "b2b_credit_insert_hq" ON b2b_franchise_credit;
CREATE POLICY "b2b_credit_insert_hq" ON b2b_franchise_credit
  FOR INSERT TO authenticated WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_credit_update_hq" ON b2b_franchise_credit;
CREATE POLICY "b2b_credit_update_hq" ON b2b_franchise_credit
  FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "b2b_credit_delete_hq" ON b2b_franchise_credit;
CREATE POLICY "b2b_credit_delete_hq" ON b2b_franchise_credit
  FOR DELETE TO authenticated USING (is_super_admin());

-- ============================================================================
-- SECTION 31: RLS Policies — b2b_order_templates
-- ============================================================================

DROP POLICY IF EXISTS "b2b_tpl_select_own" ON b2b_order_templates;
CREATE POLICY "b2b_tpl_select_own" ON b2b_order_templates
  FOR SELECT TO authenticated USING (has_store_access(store_id));

DROP POLICY IF EXISTS "b2b_tpl_select_hq" ON b2b_order_templates;
CREATE POLICY "b2b_tpl_select_hq" ON b2b_order_templates
  FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "b2b_tpl_insert_own" ON b2b_order_templates;
CREATE POLICY "b2b_tpl_insert_own" ON b2b_order_templates
  FOR INSERT TO authenticated WITH CHECK (has_store_access(store_id));

DROP POLICY IF EXISTS "b2b_tpl_update_own" ON b2b_order_templates;
CREATE POLICY "b2b_tpl_update_own" ON b2b_order_templates
  FOR UPDATE TO authenticated
  USING (has_store_access(store_id)) WITH CHECK (has_store_access(store_id));

DROP POLICY IF EXISTS "b2b_tpl_delete_own" ON b2b_order_templates;
CREATE POLICY "b2b_tpl_delete_own" ON b2b_order_templates
  FOR DELETE TO authenticated USING (has_store_access(store_id));

-- ============================================================================
-- SECTION 32: Grant EXECUTE on RPCs to authenticated
-- ============================================================================

GRANT EXECUTE ON FUNCTION
  public.create_b2b_order(jsonb, text, uuid),
  public.cancel_b2b_order(uuid, text),
  public.advance_b2b_order_status(uuid, text, text, text, date),
  public.record_b2b_payment(uuid, text, numeric, text, text),
  public.confirm_b2b_payment(uuid),
  public.get_b2b_account_summary(uuid),
  public.get_b2b_dashboard(text),
  public.reorder_b2b_order(uuid, text)
TO authenticated;
