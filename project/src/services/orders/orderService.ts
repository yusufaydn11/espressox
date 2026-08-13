import { supabase, type OrderRow, type OrderItemRow } from '@/lib/supabase';

export type OrderWithItems = OrderRow & { order_items: OrderItemRow[] };

export type StoreOrderRow = OrderRow & { order_items: { id: string }[] };

export type CreateOrderItem = {
  name: string;
  qty: number;
  price: number;
  productId?: string | null;
  sizeModifier?: number;
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

function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

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

export type OrderPointsSyncRow = Pick<
  OrderRow,
  'order_number' | 'status' | 'payment_status' | 'points_earned' | 'points_credited' | 'store_name' | 'updated_at'
>;

export async function fetchRecentOrdersForPointsSync(
  userId: string,
  sinceHours = 48,
): Promise<{ data: OrderPointsSyncRow[] | null; error: string | null }> {
  const since = new Date(Date.now() - sinceHours * 3_600_000).toISOString();
  const { data, error } = await supabase
    .from('orders')
    .select('order_number, status, payment_status, points_earned, points_credited, store_name, updated_at')
    .eq('user_id', userId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { data: null, error: error.message };
  return { data: data as OrderPointsSyncRow[], error: null };
}

export async function createOrder(params: CreateOrderParams): Promise<CreateOrderResult> {
  const items = params.items.map(it => ({
    productId: nullIfEmpty(it.productId ?? null),
    name: String(it.name ?? ''),
    qty: Math.max(1, Math.floor(Number(it.qty) || 1)),
    price: Number(it.price),
    ...(it.sizeModifier != null ? { sizeModifier: Number(it.sizeModifier) } : {}),
  })).filter(it => it.productId && Number.isFinite(it.price) && it.price > 0);

  if (items.length === 0) {
    return { error: 'empty_cart' };
  }

  const { data, error } = await supabase.rpc('create_order', {
    p_items: items,
    p_total: Number(params.total) || 0,
    p_store_id: nullIfEmpty(params.storeId ?? null),
    p_store_name: String(params.storeName ?? ''),
    p_order_type: params.orderType,
    p_payment_method: params.paymentMethod ?? 'cash',
    p_coupon_code: nullIfEmpty(params.couponCode ?? null),
    p_benefit_type: nullIfEmpty(params.benefitType ?? null),
    p_benefit_id: nullIfEmpty(params.benefitId ?? null),
  });

  if (error) {
    const detail = [error.message, error.details, error.hint].filter(Boolean).join(' — ');
    return { error: detail || 'order_failed' };
  }
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
  if (result.error) {
    const detail = (result as { detail?: string }).detail;
    return { error: detail ? `${result.error}: ${detail}` : String(result.error) };
  }

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
  if (patch.status) {
    return updateOrderStatusByNumber(orderNumber, patch.status);
  }
  return { error: null };
}

export async function deleteOrderByNumber(orderNumber: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('orders')
    .delete()
    .eq('order_number', orderNumber);
  return { error: error?.message ?? null };
}
