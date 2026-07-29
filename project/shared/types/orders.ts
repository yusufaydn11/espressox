/** Customer-facing order lifecycle statuses. */
export type OrderStatus =
  | 'pending'
  | 'preparing'
  | 'ready'
  | 'picked-up'
  | 'delivered'
  | 'scheduled'
  | 'cancelled';

export type OrderType = 'pickup' | 'table' | 'delivery' | 'scheduled';
