/*
# Sprint 1 — C-03: Block client self-award via add_points RPC

Loyalty points are awarded through create_order and qr_scan internally.
Direct add_points EXECUTE from authenticated clients enabled unlimited inflation.
*/

REVOKE EXECUTE ON FUNCTION public.add_points(integer, text)
  FROM PUBLIC, anon, authenticated;
