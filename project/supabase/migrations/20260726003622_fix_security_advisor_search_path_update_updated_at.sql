/*
# Security Advisor Fix - Add search_path to update_updated_at

## Purpose
The update_updated_at() trigger function was missing a SET search_path
clause. While it is SECURITY INVOKER (low risk), the Security Advisor
recommends all functions have an explicit search_path to prevent
search_path injection attacks.

## Changes
- Recreate update_updated_at() with SET search_path = 'public'.

## Security
- No behavior change; only adds the search_path safety setting.
*/

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Re-apply EXECUTE restriction (CREATE OR REPLACE may reset ACL)
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated, PUBLIC;
