/*
# Account Deletion — Anonymize PII, retain financial order records

Apple App Store account deletion requirement:
- Remove auth account and personal data
- Retain anonymized orders / payment audit trail where legally required

Changes:
1. orders.user_id → nullable, ON DELETE SET NULL
2. payment_intents.user_id → nullable, ON DELETE SET NULL (if table exists)
3. prepare_user_account_deletion() SECURITY DEFINER — service-role only via edge function
*/

-- ─── 1. Orders: detach user, keep financial record ───────────────────────────

ALTER TABLE orders ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ─── 2. payment_intents (FAZ1 table — safe if not yet applied) ───────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_intents'
  ) THEN
    ALTER TABLE payment_intents ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE payment_intents DROP CONSTRAINT IF EXISTS payment_intents_user_id_fkey;
    ALTER TABLE payment_intents
      ADD CONSTRAINT payment_intents_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 3. Anonymization RPC (edge function only) ───────────────────────────────

CREATE OR REPLACE FUNCTION public.prepare_user_account_deletion(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := p_user_id;
  v_orders_detached int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_user_id');
  END IF;

  -- Defense-in-depth: only service_role (edge function) may invoke
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND COALESCE(auth.jwt()->>'role', '') <> 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> v_uid THEN
      RETURN jsonb_build_object('success', false, 'error', 'forbidden');
    END IF;
  END IF;

  -- Detach financial orders (order_number, totals, payments remain)
  UPDATE orders
  SET user_id = NULL,
      notes = CASE
        WHEN notes IS NULL OR notes = '' THEN '[account_deleted]'
        WHEN notes NOT LIKE '%[account_deleted]%' THEN notes || ' [account_deleted]'
        ELSE notes
      END,
      updated_at = now()
  WHERE user_id = v_uid;
  GET DIAGNOSTICS v_orders_detached = ROW_COUNT;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_intents'
  ) THEN
    UPDATE payment_intents SET user_id = NULL, updated_at = now() WHERE user_id = v_uid;
  END IF;

  -- Remove personal / marketing data
  DELETE FROM customer_addresses WHERE user_id = v_uid;
  DELETE FROM notification_preferences WHERE user_id = v_uid;
  DELETE FROM notifications WHERE user_id = v_uid;
  DELETE FROM qr_codes WHERE user_id = v_uid;
  DELETE FROM qr_scans WHERE user_id = v_uid;
  DELETE FROM loyalty_stamps WHERE user_id = v_uid;
  DELETE FROM points_history WHERE user_id = v_uid;
  DELETE FROM reward_redemptions WHERE user_id = v_uid;
  DELETE FROM coupon_redemptions WHERE user_id = v_uid;
  DELETE FROM campaign_applications WHERE user_id = v_uid;

  -- Anonymize profile (keep row until auth delete; avoids orphaned auth if delete fails)
  UPDATE profiles SET
    full_name = '[deleted]',
    phone = '',
    avatar_url = '',
    birthday = '',
    favorite_drinks = '{}',
    favorite_store_id = NULL,
    expo_push_token = NULL,
    points = 0,
    lifetime_points = 0,
    reward_wallet = 0,
    wallet_credits = 0,
    streak = 0,
    tier = 'Silindi',
    updated_at = now()
  WHERE user_id = v_uid;

  DELETE FROM user_roles WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'success', true,
    'orders_detached', v_orders_detached
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.prepare_user_account_deletion(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepare_user_account_deletion(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.prepare_user_account_deletion(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.prepare_user_account_deletion(uuid) TO service_role;
-- service_role executes via edge function admin client

COMMENT ON FUNCTION public.prepare_user_account_deletion(uuid) IS
  'Anonymizes/deletes user PII and detaches orders before auth.users deletion. Edge function only.';
