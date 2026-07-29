/*
# Sprint 2 — H-05: Admin dashboard & analytics aggregate RPCs

Replaces full-table client scans with server-side SQL aggregation.
Requires is_internal() — same access as admin panel users.
*/

-- ─── Dashboard KPIs ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_kpis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_month_start timestamptz := date_trunc('month', now());
  v_total_orders bigint;
  v_all_revenue numeric;
  v_top_product text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;
  IF NOT is_internal() THEN
    RETURN jsonb_build_object('error', 'unauthorized');
  END IF;

  SELECT COUNT(*)::bigint, COALESCE(SUM(total), 0)
  INTO v_total_orders, v_all_revenue
  FROM orders
  WHERE status <> 'cancelled';

  SELECT oi.name INTO v_top_product
  FROM order_items oi
  GROUP BY oi.name
  ORDER BY SUM(oi.quantity) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'error', null,
    'today_sales', COALESCE((
      SELECT SUM(total) FROM orders
      WHERE created_at >= v_today_start AND status <> 'cancelled'
    ), 0),
    'month_revenue', COALESCE((
      SELECT SUM(total) FROM orders
      WHERE created_at >= v_month_start AND status <> 'cancelled'
    ), 0),
    'total_orders', v_total_orders,
    'avg_basket', CASE WHEN v_total_orders > 0 THEN v_all_revenue / v_total_orders ELSE 0 END,
    'active_customers', (SELECT COUNT(*)::int FROM profiles WHERE is_blocked = false),
    'points_redeemed', COALESCE((
      SELECT SUM(ABS(points))::int FROM points_history WHERE points < 0
    ), 0),
    'new_members', (SELECT COUNT(*)::int FROM profiles WHERE created_at >= v_month_start),
    'top_product', COALESCE(v_top_product, '—')
  );
END;
$function$;

-- ─── Sales series (daily totals) ────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_sales_series(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'created_at', day::text,
      'total', total
    ) ORDER BY day)
    FROM (
      SELECT date_trunc('day', created_at)::date AS day, SUM(total) AS total
      FROM orders
      WHERE created_at >= now() - make_interval(days => GREATEST(p_days, 1))
        AND status <> 'cancelled'
      GROUP BY 1
    ) s
  ), '[]'::jsonb);
END;
$function$;

-- ─── Store comparison ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_store_comparison(p_limit int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'store_name', store_name,
      'total', total
    ) ORDER BY total DESC)
    FROM (
      SELECT store_name, SUM(total) AS total
      FROM orders
      WHERE status <> 'cancelled'
      GROUP BY store_name
      ORDER BY SUM(total) DESC
      LIMIT GREATEST(p_limit, 1)
    ) s
  ), '[]'::jsonb);
END;
$function$;

-- ─── Top products by quantity ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_top_products(p_limit int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', name,
      'quantity', quantity
    ) ORDER BY quantity DESC)
    FROM (
      SELECT name, SUM(quantity)::int AS quantity
      FROM order_items
      GROUP BY name
      ORDER BY SUM(quantity) DESC
      LIMIT GREATEST(p_limit, 1)
    ) s
  ), '[]'::jsonb);
END;
$function$;

-- ─── Recent orders (dashboard, no order_items join) ─────────
CREATE OR REPLACE FUNCTION public.get_admin_recent_orders(p_limit int DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(s)::jsonb ORDER BY s.created_at DESC)
    FROM (
      SELECT
        o.id,
        o.order_number,
        o.store_name,
        o.created_at,
        o.total,
        o.status
      FROM orders o
      WHERE o.status <> 'cancelled'
      ORDER BY o.created_at DESC
      LIMIT GREATEST(p_limit, 1)
    ) s
  ), '[]'::jsonb);
END;
$function$;

-- ─── Order trend (orders + revenue per day) ─────────────────
CREATE OR REPLACE FUNCTION public.get_admin_order_trend(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'created_at', day::text,
      'total', revenue,
      'orders', orders
    ) ORDER BY day)
    FROM (
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*)::int AS orders,
        SUM(total) AS revenue
      FROM orders
      WHERE created_at >= now() - make_interval(days => GREATEST(p_days, 1))
        AND status <> 'cancelled'
      GROUP BY 1
    ) s
  ), '[]'::jsonb);
END;
$function$;

-- ─── Category / product revenue ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_category_revenue(p_limit int DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'name', name,
      'revenue', revenue
    ) ORDER BY revenue DESC)
    FROM (
      SELECT
        name,
        SUM(quantity * unit_price) AS revenue
      FROM order_items
      GROUP BY name
      ORDER BY SUM(quantity * unit_price) DESC
      LIMIT GREATEST(p_limit, 1)
    ) s
  ), '[]'::jsonb);
END;
$function$;

-- ─── Hourly order distribution ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_hourly_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'hour', hour,
      'orders', orders
    ) ORDER BY hour)
    FROM (
      SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*)::int AS orders
      FROM orders
      WHERE status <> 'cancelled'
      GROUP BY 1
    ) s
  ), '[]'::jsonb);
END;
$function$;

-- ─── Order status breakdown ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_admin_order_status_breakdown()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_internal() THEN RETURN '[]'::jsonb; END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'status', status,
      'count', cnt
    ) ORDER BY cnt DESC)
    FROM (
      SELECT status, COUNT(*)::int AS cnt
      FROM orders
      GROUP BY status
    ) s
  ), '[]'::jsonb);
END;
$function$;

GRANT EXECUTE ON FUNCTION
  public.get_admin_dashboard_kpis(),
  public.get_admin_sales_series(int),
  public.get_admin_store_comparison(int),
  public.get_admin_top_products(int),
  public.get_admin_recent_orders(int),
  public.get_admin_order_trend(int),
  public.get_admin_category_revenue(int),
  public.get_admin_hourly_orders(),
  public.get_admin_order_status_breakdown()
TO authenticated;

REVOKE EXECUTE ON FUNCTION
  public.get_admin_dashboard_kpis(),
  public.get_admin_sales_series(int),
  public.get_admin_store_comparison(int),
  public.get_admin_top_products(int),
  public.get_admin_recent_orders(int),
  public.get_admin_order_trend(int),
  public.get_admin_category_revenue(int),
  public.get_admin_hourly_orders(),
  public.get_admin_order_status_breakdown()
FROM anon, PUBLIC;
