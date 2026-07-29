/*
# Sprint 1 — C-02: Prevent franchise direct mutation of B2B orders/payments

Order status and payment records must flow through SECURITY DEFINER RPCs only.
create_b2b_order / cancel_b2b_order / record_b2b_payment remain the mutation path.
*/

DROP POLICY IF EXISTS "b2b_orders_update_own" ON b2b_orders;

DROP POLICY IF EXISTS "b2b_pay_insert_own" ON b2b_payments;
