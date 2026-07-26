/*
# Fix SECURITY DEFINER Warnings for RLS Helper Functions

## Purpose
The Supabase Security Advisor warns that 5 RLS helper functions
(is_admin, is_franchise, is_hq, my_store_id, user_roles_store_match)
are callable by the authenticated role via /rest/v1/rpc/ as SECURITY
DEFINER. This migration switches them to SECURITY INVOKER so they
are no longer flagged, while preserving their use inside RLS policies.

## Root Cause: RLS Recursion
These functions query the user_roles table. The user_roles table has
RLS enabled with an "admin_read_all_roles" policy that calls is_admin().
If the functions were INVOKER, they would be subject to RLS on
user_roles, which calls is_admin() again — infinite recursion.

## Solution
Remove the "admin_read_all_roles" policy on user_roles. This policy
allowed admins to read ALL user roles from the client. The app does
NOT use this — the client only queries its own role (via select_own_role
policy), and franchise/role management is handled by edge functions
using the service role key (which bypasses RLS).

With admin_read_all_roles removed, the only SELECT policy on user_roles
is "select_own_role" (auth.uid() = user_id). This is sufficient:
- is_admin/is_franchise/is_hq/my_store_id all query WHERE user_id =
  auth.uid(), so select_own_role lets the caller see their own row.
- user_roles_store_match is always called with p_uid = auth.uid() in
  every RLS policy, so the caller's own row is visible.
- No recursion: no remaining policy on user_roles calls these functions.

## Functions Changed (DEFINER → INVOKER)
1. is_admin() — checks if caller has admin/super_admin role
2. is_franchise() — checks if caller has franchise role
3. is_hq() — checks if caller has admin/super_admin role
4. my_store_id() — returns the caller's assigned store_id
5. user_roles_store_match(p_uid, p_store_id) — checks if p_uid is a
   franchise user for p_store_id (always called with p_uid = auth.uid())

## Policy Changes
- DROP "admin_read_all_roles" on user_roles (removes recursion source)
- KEEP "select_own_role" on user_roles (auth.uid() = user_id)

## Security
- All 5 functions now SECURITY INVOKER with SET search_path = 'public'
- EXECUTE revoked from anon/PUBLIC (already done previously)
- EXECUTE retained for authenticated (needed by RLS policies, safe now
  that functions are INVOKER — they can only access the caller's own data)
- The client app never calls these via REST RPC; they are internal to RLS
*/

-- ============================================================
-- 1. Remove admin_read_all_roles policy (recursion source)
-- ============================================================
DROP POLICY IF EXISTS "admin_read_all_roles" ON user_roles;

-- ============================================================
-- 2. Switch all 5 helper functions to SECURITY INVOKER
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('admin','super_admin')
);
$function$;

CREATE OR REPLACE FUNCTION public.is_franchise()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role = 'franchise'
);
$function$;

CREATE OR REPLACE FUNCTION public.is_hq()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = auth.uid()
  AND role IN ('admin','super_admin')
);
$function$;

CREATE OR REPLACE FUNCTION public.my_store_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $function$
SELECT store_id FROM user_roles WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.user_roles_store_match(p_uid uuid, p_store_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_id = p_uid
  AND role = 'franchise'
  AND store_id = p_store_id
);
$function$;

-- ============================================================
-- 3. Re-apply EXECUTE grants (CREATE OR REPLACE resets ACLs)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_franchise() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_hq() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.my_store_id() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.user_roles_store_match(uuid, text) FROM anon, PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_franchise() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_hq() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_store_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_roles_store_match(uuid, text) TO authenticated;
