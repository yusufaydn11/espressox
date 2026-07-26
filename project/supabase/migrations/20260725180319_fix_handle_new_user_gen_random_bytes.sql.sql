/*
# Fix: handle_new_user() trigger fails — gen_random_bytes not in search_path

## Root cause
`handle_new_user()` is `SECURITY DEFINER` with `search_path = 'public'`.
It calls `gen_random_bytes(4)` to build the customer QR code, but that
function lives in the `extensions` schema (part of pgcrypto), NOT in
`public`. With the locked search_path, Postgres cannot resolve the
unqualified name, so the trigger throws:

  ERROR: function gen_random_bytes(integer) does not exist

This fires on EVERY new auth user — both normal signups and the
franchise-user creation flow from the edge function — and Supabase Auth
masks it as the opaque "Database error creating new user".

## Fix
Recreate `handle_new_user()` with the same logic but:
  1. Use `extensions.gen_random_bytes(4)` (schema-qualified) so the call
     resolves regardless of search_path.
  2. Keep `search_path = 'public'` (SECURITY DEFINER best practice) —
     the explicit schema qualification is what makes it safe.

This is a drop-in replacement of the function only. No table changes,
no data loss, no policy changes. Existing rows are untouched.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO user_roles (user_id, role)
  VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO qr_codes (user_id, code)
  VALUES (
    NEW.id,
    'EX-' || UPPER(SUBSTRING(NEW.id::text, 1, 8)) || '-' || UPPER(SUBSTRING(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6))
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$function$;
