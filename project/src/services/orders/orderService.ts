import { supabase, type OrderRow, type OrderItemRow } from '@/lib/supabase';

export type OrderWithItems = OrderRow & { order_items: OrderItemRow[] };

export type StoreOrderRow = OrderRow & { order_items: { id: string }[] };

export type CreateOrderItem = {
  name: string;
  qty: number;
  price: number;
  productId?: string | null;
};

export type CreateOrderParams = {
  items: CreateOrderItem[];
  total: number;
  storeId?: string | null;
  storeName: string;
  orderType: string;
  paymentMethod?: string;
  couponCode?: string | null;
  benefitType?: string | null;
  benefitId?: string | null;
};

export type CreateOrderResult = {
  error: string | null;
  orderNumber?: string;
  pointsEarned?: number;
  subtotal?: number;
  discount?: number;
  total?: number;
  billingType?: string;
  benefitTitle?: string | null;
  paymentStatus?: string;
  orderStatus?: string;
};

export async function fetchOrdersByUserId(
  userId: string,
): Promise<{ data: OrderWithItems[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items (*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) return { data: null, error: error.message };
  return { data: data as OrderWithItems[], error: null };
}

export async function fetchOrderByNumber(
  orderNumber: string,
): Promise<{ data: OrderWithItems | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items (*)')
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (error) return { data: null, error: error.message };
  return { data: data as OrderWithItems | null, error: null };
}

export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const { data, error } = await supabase.rpc('create_order', {
    p_items: params.items.map(it => ({
      productId: it.productId ?? null,
      name: it.name,
      qty: it.qty,
      price: it.price,
    })),
    p_total: params.total,
    p_store_id: params.storeId ?? null,
    p_store_name: params.storeName,
    p_order_type: params.orderType,
    p_payment_method: params.paymentMethod ?? 'card',
    p_coupon_code: params.couponCode ?? null,
    p_benefit_type: params.benefitType ?? null,
    p_benefit_id: params.benefitId ?? null,
  });

  if (error) return { error: error.message };
  const result = data as {
    error: string | null;
    order_number: string;
    points_earned?: number;
    subtotal?: number;
    discount?: number;
    total?: number;
    billing_type?: string;
    benefit_title?: string | null;
    payment_status?: string;
    status?: string;
  };
  if (result.error) return { error: result.error };

  return {
    error: null,
    orderNumber: result.order_number,
    pointsEarned: result.points_earned ?? 0,
    subtotal: result.subtotal,
    discount: result.discount,
    total: result.total,
    billingType: result.billing_type,
    benefitTitle: result.benefit_title,
    paymentStatus: result.payment_status,
    orderStatus: result.status,
  };
}

export async function fetchStoreOrders(
  storeId: string,
  limit = 100,
): Promise<{ data: StoreOrderRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(id)')
    .eq('store_id', storeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: data as StoreOrderRow[], error: null };
}

export async function updateOrderStatusByNumber(
  orderNumber: string,
  status: string,
): Promise<{ error: string | null }> {
  const { advanceOrderStatus } = await import('@/services/checkout/checkoutService');
  return advanceOrderStatus(orderNumber, status);
}

export async function fetchRecentOrdersForAdmin(
  limit = 20,
): Promise<{ data: StoreOrderRow[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(id), user_id')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: data as StoreOrderRow[], error: null };
}

export async function fetchOrderStatsRows(): Promise<{
  data: Pick<OrderRow, 'total' | 'user_id' | 'created_at'>[] | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from('orders')
    .select('total, user_id, created_at');
  if (error) return { data: null, error: error.message };
  return { data: data as Pick<OrderRow, 'total' | 'user_id' | 'created_at'>[], error: null };
}

export async function updateOrderByNumber(
  orderNumber: string,
  patch: { status?: string },
): Promise<{ error: string | null }> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.status) dbPatch.status = patch.status;
  const { error } = await supabase
    .from('orders')
    .update(dbPatch)
    .eq('order_number', orderNumber);
  return { error: error?.message ?? null };
}

export async function deleteOrderByNumber(orderNumber: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('order_number', orderNumber);
  return { error: error?.message ?? null };
}
