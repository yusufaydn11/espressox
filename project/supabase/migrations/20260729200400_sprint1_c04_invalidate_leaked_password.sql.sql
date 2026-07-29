/*
# Sprint 1 — C-04: Invalidate known leaked super_admin temporary password

The password "EspressoX2026!" was committed in migration 20260727150656.
This migration replaces it with a random unknown hash. Operator must reset
via Supabase Dashboard → Authentication → Users before next login.
*/

UPDATE auth.users
SET
  encrypted_password = extensions.crypt(
    encode(extensions.gen_random_bytes(32), 'hex'),
    extensions.gen_salt('bf', 10)
  ),
  updated_at = now()
WHERE email = 'yusuf.aydn11@gmail.com';
