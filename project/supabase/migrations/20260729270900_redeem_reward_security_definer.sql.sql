/*
# Fix redeem_reward RLS violation (FAZ 0.1)

70401 revoked direct customer INSERT on reward_redemptions / points_history.
redeem_reward remained SECURITY INVOKER, so RPC inserts failed with RLS.

Align with create_order / qr_scan: SECURITY DEFINER + in-function auth checks.
*/

CREATE OR REPLACE FUNCTION public.redeem_reward(p_reward_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_cost int;
  v_current int;
  v_title text;
  v_blocked boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'unauthenticated');
  END IF;

  SELECT is_blocked INTO v_blocked FROM profiles WHERE user_id = v_uid;
  IF v_blocked THEN
    RETURN jsonb_build_object('error', 'account_blocked');
  END IF;

  SELECT points_cost, title INTO v_cost, v_title
  FROM rewards
  WHERE id = p_reward_id AND is_active = true;
  IF v_cost IS NULL THEN
    RETURN jsonb_build_object('error', 'reward_not_found');
  END IF;

  SELECT points INTO v_current
  FROM profiles
  WHERE user_id = v_uid
  FOR UPDATE;
  IF v_current IS NULL THEN
    RETURN jsonb_build_object('error', 'profile_not_found');
  END IF;
  IF v_current < v_cost THEN
    RETURN jsonb_build_object('error', 'insufficient_points', 'needed', v_cost - v_current);
  END IF;

  INSERT INTO reward_redemptions (user_id, reward_id, points_spent)
  VALUES (v_uid, p_reward_id, v_cost);

  UPDATE profiles SET points = GREATEST(0, points - v_cost) WHERE user_id = v_uid;

  INSERT INTO points_history (user_id, title, points, type)
  VALUES (v_uid, v_title, -v_cost, 'redeem');

  INSERT INTO notifications (user_id, title, body, type)
  VALUES (v_uid, 'Odul kullanildi', v_title || ' odulunu kullandin.', 'reward');

  RETURN jsonb_build_object('error', null, 'title', v_title);
END;
$function$;

ALTER FUNCTION public.redeem_reward(text) SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.redeem_reward(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_reward(text) TO authenticated;
