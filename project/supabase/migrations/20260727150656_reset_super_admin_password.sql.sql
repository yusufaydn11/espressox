/*
# Reset super_admin password to a known temporary value

## Purpose
The auth.users account yusuf.aydn11@gmail.com exists and is confirmed,
and already has a super_admin row in user_roles, but the password is
unknown to the operator. This migration resets the bcrypt password hash
to a known temporary password so the operator can sign in to the admin
web panel immediately, then change it from the Supabase dashboard.

## What it does
- Generates a bcrypt hash (cost 10, same as Supabase Auth) for the
  temporary password "EspressoX2026!" using pgcrypto's crypt() function.
- Updates auth.users for yusuf.aydn11@gmail.com:
    encrypted_password = <new hash>
    email_confirmed_at = now()   (ensure confirmed)
    updated_at = now()
- Does NOT touch user_roles (the super_admin row already exists for
  this user_id).
- Idempotent: re-running simply re-sets the same password.

## Security
- Only operates on the single specified email.
- The temporary password is intended to be changed by the operator
  after first login via the Supabase Dashboard → Authentication → Users.
- No RLS or schema changes.
*/

UPDATE auth.users
SET
  encrypted_password = crypt('EspressoX2026!', gen_salt('bf', 10)),
  email_confirmed_at = now(),
  updated_at = now()
WHERE email = 'yusuf.aydn11@gmail.com';
