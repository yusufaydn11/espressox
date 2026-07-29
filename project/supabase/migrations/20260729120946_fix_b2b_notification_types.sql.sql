/*
# Fix B2B notification type constraint violations

## Problem
B2B order creation fails because the `b2b_notify_order_created()` and
`b2b_notify_status_change()` trigger functions insert notification `type`
values ('b2b_order_created', 'b2b_order_created_hq', 'b2b_order_<status>')
that are NOT in the `notifications_type_check` CHECK constraint, which only
allows: 'order', 'promo', 'reward', 'challenge', 'general', 'admin'.

## Fix
Both trigger functions now use the existing `'order'` type for all B2B
order notifications. The B2B-specific context (order_id, order_number,
status, total, store_id) is already carried in the `data` JSONB column,
so no information is lost.

## Security
- No schema changes, no RLS changes.
- Functions remain SECURITY DEFINER with search_path = 'public'.
*/

CREATE OR REPLACE FUNCTION public.b2b_notify_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Notify all users linked to this store
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT ur.user_id, 'Sipariş Oluşturuldu',
  'Yeni sipariş oluşturuldu: ' || NEW.order_number || ' — Toplam: ' || NEW.total::text || ' TL',
  'order',
  jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total, 'source', 'b2b')
  FROM user_roles ur WHERE ur.store_id = NEW.store_id;

  -- Also notify HQ (super_admins)
  INSERT INTO notifications (user_id, title, body, type, data)
  SELECT u.id, 'Yeni B2B Sipariş',
  'Franchise siparişi oluşturuldu: ' || NEW.order_number,
  'order',
  jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'total', NEW.total, 'store_id', NEW.store_id, 'source', 'b2b_hq')
  FROM auth.users u
  JOIN user_roles ur ON ur.user_id = u.id
  WHERE ur.role = 'super_admin';

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (NEW.created_by, 'b2b_order_created', 'b2b_order', NEW.id::text,
  jsonb_build_object('order_number', NEW.order_number, 'total', NEW.total, 'store_id', NEW.store_id));

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.b2b_notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_status_labels jsonb := '{"draft":"Taslak","awaiting_payment":"Ödeme Bekleniyor","paid":"Ödeme Alındı","confirmed":"Onaylandı","preparing":"Hazırlanıyor","shipped":"Kargoya Verildi","delivered":"Teslim Edildi","cancelled":"İptal Edildi"}'::jsonb;
  v_title text;
  v_body text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_title := COALESCE(v_status_labels->>NEW.status, NEW.status);
    v_body := 'Sipariş ' || NEW.order_number || ' durumu: ' || v_title;

    -- Notify all users linked to this store
    INSERT INTO notifications (user_id, title, body, type, data)
    SELECT ur.user_id, v_title, v_body, 'order',
    jsonb_build_object('order_id', NEW.id, 'status', NEW.status, 'order_number', NEW.order_number, 'source', 'b2b')
    FROM user_roles ur WHERE ur.store_id = NEW.store_id;

    -- Audit log
    INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'b2b_order_status_change', 'b2b_order', NEW.id::text,
    jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END;
$function$;
