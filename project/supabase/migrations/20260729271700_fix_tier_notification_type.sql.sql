/*
# recalc_profile_tier — use valid notifications.type ('reward' not 'loyalty')
# Fixes create_order rollback when tier upgrade notification violates CHECK constraint
*/

CREATE OR REPLACE FUNCTION public.recalc_profile_tier(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lp int;
  v_old text;
  v_new text;
BEGIN
  SELECT lifetime_points, tier INTO v_lp, v_old FROM profiles WHERE user_id = p_user_id;
  v_new := CASE
    WHEN v_lp >= 15000 THEN 'VIP'
    WHEN v_lp >= 7000 THEN 'Siyah'
    WHEN v_lp >= 3000 THEN 'Altın'
    WHEN v_lp >= 1000 THEN 'Gümüş'
    ELSE 'Bronz'
  END;
  IF v_new <> COALESCE(v_old, 'Bronz') THEN
    UPDATE profiles SET tier = v_new WHERE user_id = p_user_id;
    INSERT INTO notifications (user_id, title, body, type)
    VALUES (p_user_id, 'Seviye yükseldin!', 'Tebrikler! Yeni seviyen: ' || v_new, 'reward');
  END IF;
  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalc_profile_tier(uuid) TO authenticated;
