/*
# B2B Order Production Enhancements

- admin_notes column on b2b_orders (HQ notes visible to franchise)
- add_b2b_admin_note() RPC
- Improved status-change notifications with franchise-friendly labels
- Deduplicated audit logging (trigger only, not RPC)
*/

-- ─── admin_notes column ─────────────────────────────────────
ALTER TABLE b2b_orders
  ADD COLUMN IF NOT EXISTS admin_notes text NOT NULL DEFAULT '';

-- ─── Status notification labels (HQ workflow) ───────────────
CREATE OR REPLACE FUNCTION public.b2b_status_label(p_status text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_status
    WHEN 'draft' THEN 'Taslak'
    WHEN 'awaiting_payment' THEN 'Ödeme Bekleniyor'
    WHEN 'paid' THEN 'Bekliyor'
    WHEN 'confirmed' THEN 'Onaylandı'
    WHEN 'preparing' THEN 'Hazırlanıyor'
    WHEN 'shipped' THEN 'Kargoya Verildi'
    WHEN 'delivered' THEN 'Teslim Edildi'
    WHEN 'cancelled' THEN 'İptal Edildi'
    ELSE p_status
  END;
$$;

-- ─── Notify franchise users on status change ────────────────
CREATE OR REPLACE FUNCTION public.b2b_notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_title text;
  v_body text;
  v_from_label text;
  v_to_label text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_from_label := b2b_status_label(OLD.status);
    v_to_label := b2b_status_label(NEW.status);
    v_title := 'Sipariş: ' || v_to_label;
    v_body := NEW.order_number || ' — ' || v_from_label || ' → ' || v_to_label;

    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT ur.user_id, v_title, v_body, 'order',
      jsonb_build_object(
        'order_id', NEW.id,
        'order_number', NEW.order_number,
        'status', NEW.status,
        'from_status', OLD.status,
        'to_status', NEW.status,
        'source', 'b2b'
      )
    FROM user_roles ur
    WHERE ur.store_id = NEW.store_id
      AND ur.role IN ('franchise', 'store_manager', 'staff');

    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'b2b_order_status_change',
      'b2b_order',
      NEW.id::text,
      jsonb_build_object(
        'from', OLD.status,
        'to', NEW.status,
        'from_label', v_from_label,
        'to_label', v_to_label,
        'order_number', NEW.order_number
      )
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- ─── advance_b2b_order_status — remove duplicate audit ──────
CREATE OR REPLACE FUNCTION public.advance_b2b_order_status(
  p_order_id uuid,
  p_new_status text,
  p_tracking_no text DEFAULT '',
  p_carrier text DEFAULT '',
  p_eta date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_valid_transitions text[];
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  v_valid_transitions := ARRAY[
    ['paid','confirmed'], ['confirmed','preparing'],
    ['preparing','shipped'], ['shipped','delivered']
  ];

  IF NOT array[ARRAY[v_order.status, p_new_status]] <@ v_valid_transitions THEN
    RETURN jsonb_build_object('error', 'invalid_transition', 'from', v_order.status, 'to', p_new_status);
  END IF;

  IF p_new_status = 'shipped' AND COALESCE(NULLIF(TRIM(p_carrier), ''), NULLIF(TRIM(v_order.carrier_company), '')) IS NULL THEN
    RETURN jsonb_build_object('error', 'carrier_required');
  END IF;

  UPDATE b2b_orders
  SET status = p_new_status,
      tracking_number = CASE WHEN p_new_status = 'shipped' AND p_tracking_no <> '' THEN p_tracking_no ELSE tracking_number END,
      carrier_company = CASE WHEN p_new_status = 'shipped' AND p_carrier <> '' THEN p_carrier ELSE carrier_company END,
      tracking_url = CASE WHEN p_new_status = 'shipped' AND p_tracking_no <> '' THEN
        'https://www.google.com/search?q=' || COALESCE(NULLIF(p_carrier, ''), carrier_company) || '+' || p_tracking_no
      ELSE tracking_url END,
      estimated_delivery = CASE WHEN p_eta IS NOT NULL THEN p_eta ELSE estimated_delivery END,
      shipped_at = CASE WHEN p_new_status = 'shipped' THEN now() ELSE shipped_at END,
      delivered_at = CASE WHEN p_new_status = 'delivered' THEN now() ELSE delivered_at END,
      confirmed_by = CASE WHEN p_new_status = 'confirmed' THEN v_uid ELSE confirmed_by END,
      confirmed_at = CASE WHEN p_new_status = 'confirmed' THEN now() ELSE confirmed_at END,
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'status', p_new_status);
END;
$function$;

-- ─── reject_b2b_order — trigger handles notification ─────────
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

  IF v_order.status NOT IN ('awaiting_payment', 'paid', 'confirmed', 'preparing') THEN
    RETURN jsonb_build_object('error', 'invalid_transition', 'from', v_order.status, 'to', 'cancelled');
  END IF;

  UPDATE b2b_orders
  SET status = 'cancelled',
      cancel_reason = COALESCE(NULLIF(TRIM(p_reason), ''), 'Merkez tarafından iptal edildi'),
      updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_order_rejected', 'b2b_order', p_order_id::text,
    jsonb_build_object('from', v_order.status, 'to', 'cancelled', 'reason', p_reason, 'order_number', v_order.order_number));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id, 'status', 'cancelled');
END;
$function$;

-- ─── add_b2b_admin_note ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.add_b2b_admin_note(
  p_order_id uuid,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_order b2b_orders%ROWTYPE;
  v_author text;
  v_entry text;
  v_ts text;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('error', 'unauthenticated'); END IF;
  IF NOT is_super_admin() THEN RETURN jsonb_build_object('error', 'unauthorized'); END IF;
  IF COALESCE(NULLIF(TRIM(p_note), ''), '') = '' THEN
    RETURN jsonb_build_object('error', 'empty_note');
  END IF;

  SELECT * INTO v_order FROM b2b_orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'not_found'); END IF;

  SELECT COALESCE(NULLIF(full_name, ''), 'Merkez') INTO v_author
  FROM profiles WHERE user_id = v_uid LIMIT 1;

  v_ts := to_char(now() AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM-DD HH24:MI');
  v_entry := v_ts || ' · ' || v_author || E'\n' || TRIM(p_note);

  UPDATE b2b_orders
  SET admin_notes = CASE
    WHEN admin_notes = '' THEN v_entry
    ELSE admin_notes || E'\n\n---\n' || v_entry
  END,
  updated_at = now()
  WHERE id = p_order_id;

  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id,
    'Sipariş Notu — ' || v_order.order_number,
    v_author || ': ' || LEFT(TRIM(p_note), 120),
    'order',
    jsonb_build_object('order_id', p_order_id, 'order_number', v_order.order_number, 'source', 'b2b_admin_note')
  FROM user_roles ur
  WHERE ur.store_id = v_order.store_id
    AND ur.role IN ('franchise', 'store_manager');

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (v_uid, 'b2b_admin_note_added', 'b2b_order', p_order_id::text,
    jsonb_build_object('order_number', v_order.order_number, 'note', LEFT(TRIM(p_note), 200)));

  RETURN jsonb_build_object('error', null, 'order_id', p_order_id);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.add_b2b_admin_note(uuid, text) TO authenticated;
