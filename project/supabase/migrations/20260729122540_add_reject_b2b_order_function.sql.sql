/*
# Add reject/cancel B2B order capability for HQ admins

## Purpose
The advance_b2b_order_status() function only allows forward transitions
(paid→confirmed→preparing→shipped→delivered). Admins need to be able to
reject (cancel) orders from the paid or confirmed stages.

## Security
- SECURITY DEFINER, search_path = 'public'
- Only super_admin can reject
- The existing b2b_notify_status_change() trigger automatically sends
  a notification with type 'order' to the franchise when status changes
  to 'cancelled'.
*/

CREATE OR REPLACE FUNCTION public.reject_b2b_order(
  p_order_id uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  -- Can only reject orders that haven't been shipped yet
  IF v_order.status NOT IN ('awaiting_payment', 'paid', 'confirmed', 'preparing') THEN
    RETURN jsonb_build_object('error', 'invalid_transition', 'from', v_order.status, 'to', 'cancelled');
  END IF;

  UPDATE b2b_orders
  SET status = 'cancelled',
      cancel_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Merkez tarafından reddedildi'),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_order_rejected', 'b2b_order', p_order_id::text,
  jsonb_build_object('from', v_order.status, 'to', 'cancelled', 'reason', p_reason, 'order_number', v_order.order_number));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'status', 'cancelled');
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reject_b2b_order(uuid, text) TO authenticated;
