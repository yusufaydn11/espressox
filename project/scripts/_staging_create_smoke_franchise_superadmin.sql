-- Staging-only: smoke franchise + super_admin test accounts (idempotent)
-- Does NOT modify yusuf.aydn11@gmail.com or yusuf.aydn11@icloud.com

DO $$
DECLARE
  v_user_id uuid;
  v_store_id text := 's5';
  v_franchise_id uuid := '8f279dc4-9e5a-4e1e-9cb3-bac6e7d4ebe3';
BEGIN
  -- Link s5 to the existing franchise entity (s5 has no franchise operator yet)
  UPDATE public.stores
  SET franchise_id = v_franchise_id
  WHERE id = v_store_id AND franchise_id IS NULL;

  -- ─── smoke.franchise@espressox.test ─────────────────────────
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'smoke.franchise@espressox.test';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'smoke.franchise@espressox.test',
      extensions.crypt('SmokeFranchise!2026', extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Smoke Franchise"}'::jsonb,
      now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'smoke.franchise@espressox.test'),
      'email',
      v_user_id::text,
      now(), now(), now()
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = extensions.crypt('SmokeFranchise!2026', extensions.gen_salt('bf', 10)),
      email_confirmed_at = now(),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (v_user_id, 'franchise', v_store_id)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'franchise', store_id = EXCLUDED.store_id, updated_at = now();

  -- ─── smoke.superadmin@espressox.test ────────────────────────
  v_user_id := NULL;
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'smoke.superadmin@espressox.test';
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      'smoke.superadmin@espressox.test',
      extensions.crypt('SmokeSuperAdmin!2026', extensions.gen_salt('bf', 10)),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Smoke Super Admin"}'::jsonb,
      now(), now(),
      '', '', '', ''
    );

    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'smoke.superadmin@espressox.test'),
      'email',
      v_user_id::text,
      now(), now(), now()
    );
  ELSE
    UPDATE auth.users SET
      encrypted_password = extensions.crypt('SmokeSuperAdmin!2026', extensions.gen_salt('bf', 10)),
      email_confirmed_at = now(),
      updated_at = now()
    WHERE id = v_user_id;
  END IF;

  INSERT INTO public.user_roles (user_id, role, store_id)
  VALUES (v_user_id, 'super_admin', NULL)
  ON CONFLICT (user_id) DO UPDATE
    SET role = 'super_admin', store_id = NULL, updated_at = now();
END $$;
