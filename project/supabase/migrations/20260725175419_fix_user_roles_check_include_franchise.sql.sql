/*
# Fix: allow 'franchise' role in user_roles.role CHECK constraint

## Problem
The `user_roles.role` column has a CHECK constraint allowing only
`customer | staff | admin | super_admin`. The franchise RBAC system
introduced a new `franchise` role, but the CHECK was never updated.

When the `manage-franchise-user` edge function (or any caller) tries to
upsert a row with role = 'franchise', Postgres rejects it:

  new row for relation "user_roles" violates check constraint
  "user_roles_role_check"

For the edge-function flow, this error bubbles up as the opaque
Supabase Auth message "Database error creating new user", because the
insert happens inside the same logical flow right after
`auth.admin.createUser`. Worse, because `handle_new_user()` itself
inserts role 'customer' (allowed), normal signups still work — but the
franchise creation flow is completely broken.

## Fix
Drop the old CHECK and replace it with one that also allows 'franchise'.
This is the only schema change. No data is lost; no policies change.

## Notes
1. The CHECK is replaced (DROP + ADD) because ALTER CONSTRAINT syntax
   is not supported for CHECK constraints. The new constraint is
   semantically a superset of the old one, so existing rows remain valid.
2. After this, `role = 'franchise'` inserts/upserts succeed, and the
   franchise-needs-store CHECK (added in the previous migration) still
   enforces that a franchise row must carry a store_id.
*/

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role = ANY (ARRAY['customer','staff','admin','super_admin','franchise']));
