/*
# Security Advisor Fix - Admin Panel Schema Hardening

## Purpose
Fixes 4 Security Advisor warnings reported on the objects created by the
admin_panel_schema migration. No data is changed; no tables are dropped.
All fixes are idempotent and safe to re-run.

## Issues Fixed

### 1. Security Definer View: public.store_stock
The store_stock view was created without an explicit security_invoker
option. On Postgres 15+ views default to security_definer behavior, which
means the view runs with the owner's privileges and BYPASSES the RLS
policies on its underlying tables (inventory_items, inventory_movements).
A caller who can SELECT the view could read inventory data even if the RLS
policies on the base tables would deny them direct access.
Fix: ALTER VIEW ... SET (security_invoker = true) so the view executes
with the caller's privileges and the base-table RLS policies apply.

### 2. Function Search Path Mutable: public.set_updated_at
The set_updated_at() trigger function was created without SET search_path.
Although it is SECURITY INVOKER (low risk), a mutable search_path allows
search_path injection if a malicious schema is earlier in the path.
Fix: Recreate with SET search_path = 'public'. Existing triggers
(tr_categories_updated, tr_coupons_updated, tr_employees_updated,
tr_franchises_updated, tr_inventory_items_updated,
tr_loyalty_settings_updated) continue to call it unchanged.

### 3 & 4. Public / Authenticated Can Execute SECURITY DEFINER Function: is_admin_role
is_admin_role(p_role text) was created as SECURITY DEFINER and is
executable by anon and authenticated via /rest/v1/rpc/is_admin_role.
This function is NOT used inside any RLS policy (verified: no policy
references it) and is NOT called by any application code (verified: no
frontend/backend imports). It was a helper that ended up unused — the
admin panel uses inline EXISTS subqueries against user_roles instead.
Fix: Convert to SECURITY INVOKER (so it runs as the caller, subject to
RLS on user_roles) AND revoke EXECUTE from anon, authenticated, and
PUBLIC so it is not callable via the REST API. This eliminates both the
"Public can execute" and "Signed-in users can execute" warnings while
preserving the function for any future internal/database use.

## Security
- store_stock now respects RLS on inventory_items / inventory_movements.
- set_updated_at is protected against search_path injection.
- is_admin_role is no longer a privileged function and is not reachable
  from the REST API by any role.
- No RLS policies, table data, or application behavior changes.
*/

-- ─── 1. store_stock view: switch to security_invoker ─────────
ALTER VIEW public.store_stock SET (security_invoker = true);

-- ─── 2. set_updated_at: lock down search_path ────────────────
-- Recreate with explicit search_path. SECURITY INVOKER is preserved.
-- CREATE OR REPLACE keeps the same oid so existing triggers still bind.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$function$;

-- Trigger functions should not be callable by client roles.
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon, authenticated, PUBLIC;

-- ─── 3 & 4. is_admin_role: convert to INVOKER + lock down EXECUTE ──
-- Recreate as SECURITY INVOKER with a locked search_path. The function
-- body is unchanged (it reads user_roles via an EXISTS subquery); as
-- INVOKER it now runs under the caller's privileges and RLS, which is
-- correct for a function that is not used inside any RLS policy.
CREATE OR REPLACE FUNCTION public.is_admin_role(p_role text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
      AND (p_role IS NULL OR ur.role = p_role)
      AND ur.role IN ('super_admin','franchise','store_manager','staff')
  );
$$;

-- Not callable via the REST API by any client role.
REVOKE EXECUTE ON FUNCTION public.is_admin_role(text) FROM anon, authenticated, PUBLIC;
