/*
# Production QA Final Fixes
- Restrict HQ dashboard aggregate RPCs to super_admin + admin roles only (not staff/franchise)
- Add loyalty_challenges table for mobile admin loyalty tasks
*/

-- ─── HQ dashboard role guard ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_hq_dashboard()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
  );
$$;

-- Patch aggregate RPCs: is_internal() → is_hq_dashboard()
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
  IF NOT is_hq_dashboard() THEN
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

CREATE OR REPLACE FUNCTION public.get_admin_sales_series(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

CREATE OR REPLACE FUNCTION public.get_admin_store_comparison(p_limit int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

CREATE OR REPLACE FUNCTION public.get_admin_top_products(p_limit int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

CREATE OR REPLACE FUNCTION public.get_admin_recent_orders(p_limit int DEFAULT 6)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

CREATE OR REPLACE FUNCTION public.get_admin_order_trend(p_days int DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

CREATE OR REPLACE FUNCTION public.get_admin_category_revenue(p_limit int DEFAULT 8)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

CREATE OR REPLACE FUNCTION public.get_admin_hourly_orders()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

CREATE OR REPLACE FUNCTION public.get_admin_order_status_breakdown()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN '[]'::jsonb; END IF;
  IF NOT is_hq_dashboard() THEN RETURN '[]'::jsonb; END IF;

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

-- ─── Loyalty challenges table ────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  progress integer NOT NULL DEFAULT 0,
  target integer NOT NULL DEFAULT 5,
  reward_points integer NOT NULL DEFAULT 100,
  expires_label text,
  type text NOT NULL DEFAULT 'weekly' CHECK (type IN ('weekly', 'monthly', 'streak')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "loyalty_challenges_select_internal" ON loyalty_challenges;
CREATE POLICY "loyalty_challenges_select_internal" ON loyalty_challenges
  FOR SELECT TO authenticated
  USING (is_internal());

DROP POLICY IF EXISTS "loyalty_challenges_insert_hq" ON loyalty_challenges;
CREATE POLICY "loyalty_challenges_insert_hq" ON loyalty_challenges
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "loyalty_challenges_update_hq" ON loyalty_challenges;
CREATE POLICY "loyalty_challenges_update_hq" ON loyalty_challenges
  FOR UPDATE TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

DROP POLICY IF EXISTS "loyalty_challenges_delete_hq" ON loyalty_challenges;
CREATE POLICY "loyalty_challenges_delete_hq" ON loyalty_challenges
  FOR DELETE TO authenticated
  USING (is_super_admin());
