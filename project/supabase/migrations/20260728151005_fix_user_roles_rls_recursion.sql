-- Fix: role helper functions cause infinite RLS recursion on user_roles table.
-- is_admin() / is_super_admin() query user_roles inside RLS policies ON user_roles,
-- which re-triggers the policy → infinite recursion → query fails → role never loads.
-- Making them SECURITY DEFINER (owned by postgres, which bypasses RLS) breaks the cycle.

ALTER FUNCTION public.is_admin()        SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.is_super_admin()  SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.is_franchise()    SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.is_staff()        SECURITY DEFINER SET search_path = public;
ALTER FUNCTION public.is_store_manager() SECURITY DEFINER SET search_path = public;
