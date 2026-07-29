/*
# Sprint 1 — C-01: Revoke client EXECUTE on internal B2B SECURITY DEFINER helpers

b2b_process_payment_side_effects and b2b_recalc_credit_balance must only be
invoked from other SECURITY DEFINER RPCs (record_b2b_payment, confirm_b2b_payment).
*/

REVOKE EXECUTE ON FUNCTION public.b2b_process_payment_side_effects(uuid, uuid, text, text, uuid)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.b2b_recalc_credit_balance(uuid)
  FROM PUBLIC, anon, authenticated;
