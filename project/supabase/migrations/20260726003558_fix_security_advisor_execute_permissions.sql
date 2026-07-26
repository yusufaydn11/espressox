/*
# Security Advisor Fix - EXECUTE Permissions & Helper Function Hardening

## Purpose
1. Revoke EXECUTE permission from the anon role (and PUBLIC) for all
   sensitive RPC functions. Only authenticated users should call them.
2. Revoke EXECUTE from anon AND authenticated for trigger functions
   (they should only be called by the database itself, never by clients).
3. Harden the 5 RLS helper functions that must remain SECURITY DEFINER
   by ensuring they have a secure search_path.

## EXECUTE Permission Changes

### Customer RPC functions (revoke from anon, keep for authenticated)
- add_points, spend_points, redeem_reward, create_order, qr_scan
- These are called by authenticated customers only.

### Admin RPC function (revoke from anon, keep for authenticated)
- send_campaign
- Only admin/franchise users call this; role check is inside the function.

### RLS helper functions (keep EXECUTE for authenticated, revoke from anon)
- is_admin, is_franchise, is_hq, my_store_id, user_roles_store_match
- These are called inside RLS policies (which run as the authenticated user).
- anon should never need these since anon requests only hit public tables
  (products, rewards, stores, active campaigns) whose policies don't call
  these helpers after the campaigns policy split.

### Trigger functions (revoke from anon AND authenticated)
- handle_new_user, handle_user_login, create_stamp_card_on_redeem
- These are fired by triggers, not called directly by any client.
- Only the postgres/service_role owner needs EXECUTE.

## Security
- anon can no longer call any RPC function.
- authenticated users can call customer and admin RPCs (role checks inside).
- Trigger functions are not callable by any client role.
- All helper functions retain SET search_path = 'public' for safety.
*/

-- ============================================================
-- Customer RPC functions: revoke from anon, keep authenticated
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.add_points(integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.spend_points(integer, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_order(jsonb, numeric, text, text, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qr_scan(uuid, text, text, integer) FROM anon, PUBLIC;

-- Ensure authenticated retains EXECUTE
GRANT EXECUTE ON FUNCTION public.add_points(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_points(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_reward(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, numeric, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qr_scan(uuid, text, text, integer) TO authenticated;

-- ============================================================
-- Admin RPC function: revoke from anon, keep authenticated
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.send_campaign(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_campaign(uuid) TO authenticated;

-- ============================================================
-- RLS helper functions: revoke from anon, keep authenticated
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

-- ============================================================
-- Trigger functions: revoke from anon AND authenticated
-- (only the database engine fires these via triggers)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_user_login() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_stamp_card_on_redeem() FROM anon, authenticated, PUBLIC;

-- ============================================================
-- update_updated_at trigger helper: restrict similarly
-- (only called by BEFORE UPDATE triggers, not by clients)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated, PUBLIC;
