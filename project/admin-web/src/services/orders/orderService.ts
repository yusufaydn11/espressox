import { supabase, type OrderRow, type OrderItemRow } from '../../lib/supabase';

export type OrderWithItems = OrderRow & { order_items: OrderItemRow[] };

export type DashboardRecentOrderRow = {
  id: string;
  order_number: string;
  store_name: string;
  created_at: string;
  total: number;
  status: string;
};

async function callAggregateRpc<T>(fn: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  return data as T;
}

export async function fetchDashboardKpisAggregate() {
  return callAggregateRpc<Record<string, unknown>>('get_admin_dashboard_kpis');
}

export async function fetchSalesSeriesAggregate(days: number) {
  return callAggregateRpc<Array<{ created_at: string; total: number }>>('get_admin_sales_series', { p_days: days });
}

export async function fetchStoreComparisonAggregate(limit = 8) {
  return callAggregateRpc<Array<{ store_name: string; total: number }>>('get_admin_store_comparison', { p_limit: limit });
}

export async function fetchTopProductsAggregate(limit = 8) {
  return callAggregateRpc<Array<{ name: string; quantity: number }>>('get_admin_top_products', { p_limit: limit });
}

export async function fetchRecentOrdersAggregate(limit = 6) {
  return callAggregateRpc<DashboardRecentOrderRow[]>('get_admin_recent_orders', { p_limit: limit });
}

export async function fetchOrderTrendAggregate(days: number) {
  return callAggregateRpc<Array<{ created_at: string; total: number; orders: number }>>('get_admin_order_trend', { p_days: days });
}

export async function fetchCategoryRevenueAggregate(limit = 10) {
  return callAggregateRpc<Array<{ name: string; revenue: number }>>('get_admin_category_revenue', { p_limit: limit });
}

export async function fetchHourlyOrdersAggregate() {
  return callAggregateRpc<Array<{ hour: number; orders: number }>>('get_admin_hourly_orders');
}

export async function fetchOrderStatusBreakdownAggregate() {
  return callAggregateRpc<Array<{ status: string; count: number }>>('get_admin_order_status_breakdown');
}

export async function fetchOrders(
  status?: string,
): Promise<OrderWithItems[]> {
  let q = supabase
    .from('orders')
    .select('*, order_items(*)')
    .order('created_at', { ascending: false })
    .limit(100);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as OrderWithItems[];
}

export async function updateOrderStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchCustomerOrders(userId: string): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return data as OrderRow[];
}

export async function fetchOrderTotalsSince(sinceIso: string) {
  return supabase
    .from('orders')
    .select('total')
    .gte('created_at', sinceIso)
    .neq('status', 'cancelled');
}

export async function fetchOrderTotalsInRange(sinceIso: string) {
  return supabase
    .from('orders')
    .select('total, created_at')
    .gte('created_at', sinceIso)
    .neq('status', 'cancelled');
}

export async function fetchAllOrderTotals() {
  return supabase
    .from('orders')
    .select('total')
    .neq('status', 'cancelled');
}

export async function fetchSalesSeriesRows(days: number) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return supabase
    .from('orders')
    .select('total, created_at')
    .gte('created_at', start.toISOString())
    .neq('status', 'cancelled');
}

export async function fetchStoreComparisonRows() {
  return supabase
    .from('orders')
    .select('store_name, total')
    .neq('status', 'cancelled');
}

export async function fetchOrderTrendRows(days: number) {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return supabase
    .from('orders')
    .select('total, created_at')
    .gte('created_at', start.toISOString())
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });
}

export async function fetchHourlyOrderTimestamps() {
  return supabase
    .from('orders')
    .select('created_at')
    .neq('status', 'cancelled')
    .limit(500);
}

export async function fetchOrderStatusRows() {
  return supabase
    .from('orders')
    .select('status')
    .limit(1000);
}

export async function fetchTopProductItems() {
  return supabase.from('order_items').select('name, quantity');
}

export async function fetchCategoryRevenueItems() {
  return supabase.from('order_items').select('name, quantity, unit_price');
}
