-- Hotfix: RLS INSERT policies for order lifecycle tables used by create_order RPC

CREATE POLICY "order_status_history_insert_own" ON order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_status_history.order_id AND o.user_id = auth.uid())
  );

CREATE POLICY "order_status_history_insert_internal" ON order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (is_internal());

-- Staff status updates via advance_order_status
CREATE POLICY "order_status_history_insert_store" ON order_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_history.order_id
        AND has_store_access(o.store_id)
    )
  );
