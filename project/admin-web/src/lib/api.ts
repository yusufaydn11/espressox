import { supabase } from './supabase';
import type {
  Product, Category, Store, OrderRow, OrderItemRow, CampaignRow, Coupon,
  Reward, Franchise, Employee, InventoryItem, InventoryMovement, StoreStock,
  LoyaltySettings, PushJob, UserProfile, NotificationRow,
  B2BOrder, B2BOrderItem, B2BInvoice, B2BPayment,
  B2BProduct, B2BProductStock, B2BWarehouse,
} from './supabase';

export type DashboardKpis = {
  todaySales: number;
  monthRevenue: number;
  totalOrders: number;
  avgBasket: number;
  activeCustomers: number;
  pointsRedeemed: number;
  newMembers: number;
  topProduct: string;
};

export async function fetchDashboardKpis(): Promise<DashboardKpis> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [today, month, allOrders, customers, redeemed, newMembers, topItem] = await Promise.all([
    supabase.from('orders').select('total').gte('created_at', todayStart).neq('status', 'cancelled'),
    supabase.from('orders').select('total, created_at').gte('created_at', monthStart).neq('status', 'cancelled'),
    supabase.from('orders').select('total').neq('status', 'cancelled'),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('is_blocked', false),
    supabase.from('points_history').select('points').lt('points', 0),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', monthStart),
    supabase.from('order_items').select('name, quantity'),
  ]);

  const sum = (rows: { total: number }[] | null) => rows?.reduce((s, r) => s + Number(r.total), 0) ?? 0;
  const todaySales = sum(today.data as { total: number }[] | null);
  const monthRevenue = sum(month.data as { total: number }[] | null);
  const allTotal = sum(allOrders.data as { total: number }[] | null);
  const orderCount = allOrders.data?.length ?? 0;
  const avgBasket = orderCount > 0 ? allTotal / orderCount : 0;
  const pointsRedeemed = Math.abs((redeemed.data as { points: number }[] | null)?.reduce((s, r) => s + r.points, 0) ?? 0);

  const itemQty: Record<string, number> = {};
  (topItem.data as { name: string; quantity: number }[] | null)?.forEach(i => {
    itemQty[i.name] = (itemQty[i.name] ?? 0) + i.quantity;
  });
  const topProduct = Object.entries(itemQty).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return {
    todaySales, monthRevenue, totalOrders: orderCount,
    avgBasket, activeCustomers: customers.count ?? 0,
    pointsRedeemed, newMembers: newMembers.count ?? 0, topProduct,
  };
}

export async function fetchSalesSeries(days: number): Promise<{ label: string; value: number }[]> {
  const start = new Date(); start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('orders').select('total, created_at').gte('created_at', start.toISOString()).neq('status', 'cancelled');
  if (error) return [];
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  (data as { total: number; created_at: string }[]).forEach(r => {
    const k = r.created_at.slice(0, 10);
    if (k in buckets) buckets[k] += Number(r.total);
  });
  return Object.entries(buckets).map(([k, v]) => ({
    label: new Date(k).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
    value: Math.round(v),
  }));
}

export async function fetchStoreComparison(): Promise<{ label: string; value: number }[]> {
  const { data, error } = await supabase
    .from('orders').select('store_name, total').neq('status', 'cancelled');
  if (error) return [];
  const map: Record<string, number> = {};
  (data as { store_name: string; total: number }[]).forEach(r => {
    map[r.store_name] = (map[r.store_name] ?? 0) + Number(r.total);
  });
  return Object.entries(map).map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value).slice(0, 8);
}

export async function fetchTopProducts(limit = 8): Promise<{ label: string; value: number }[]> {
  const { data, error } = await supabase.from('order_items').select('name, quantity');
  if (error) return [];
  const map: Record<string, number> = {};
  (data as { name: string; quantity: number }[]).forEach(r => {
    map[r.name] = (map[r.name] ?? 0) + r.quantity;
  });
  return Object.entries(map).map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value).slice(0, limit);
}

// ─── Orders ──────────────────────────────────────────────────
export async function fetchOrders(status?: string): Promise<(OrderRow & { order_items: OrderItemRow[] })[]> {
  let q = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(100);
  if (status && status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as (OrderRow & { order_items: OrderItemRow[] })[];
}

export async function updateOrderStatus(id: string, status: string) {
  const { error } = await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Products ────────────────────────────────────────────────
export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Product[];
}

export async function createProduct(p: Partial<Product>) {
  const { data, error } = await supabase.from('products').insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as Product;
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  const { error } = await supabase.from('products').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteProduct(id: string) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Categories ──────────────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Category[];
}

export async function createCategory(c: Partial<Category>) {
  const { data, error } = await supabase.from('categories').insert(c).select().single();
  if (error) throw new Error(error.message);
  return data as Category;
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  const { error } = await supabase.from('categories').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function reorderCategories(items: { id: string; sort_order: number }[]) {
  const { error } = await supabase.from('categories').upsert(items, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

// ─── Stores ──────────────────────────────────────────────────
export async function fetchStores(): Promise<Store[]> {
  const { data, error } = await supabase.from('stores').select('*').order('name');
  if (error) throw new Error(error.message);
  return data as Store[];
}

export async function updateStore(id: string, patch: Partial<Store>) {
  const { error } = await supabase.from('stores').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function createStore(s: Partial<Store>) {
  const { data, error } = await supabase.from('stores').insert(s).select().single();
  if (error) throw new Error(error.message);
  return data as Store;
}

// ─── Campaigns ───────────────────────────────────────────────
export async function fetchCampaigns(): Promise<CampaignRow[]> {
  const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as CampaignRow[];
}

export async function createCampaign(c: Partial<CampaignRow>) {
  const { data, error } = await supabase.from('campaigns').insert(c).select().single();
  if (error) throw new Error(error.message);
  return data as CampaignRow;
}

export async function updateCampaign(id: string, patch: Partial<CampaignRow>) {
  const { error } = await supabase.from('campaigns').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Coupons ─────────────────────────────────────────────────
export async function fetchCoupons(): Promise<Coupon[]> {
  const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Coupon[];
}

export async function createCoupon(c: Partial<Coupon>) {
  const { data, error } = await supabase.from('coupons').insert(c).select().single();
  if (error) throw new Error(error.message);
  return data as Coupon;
}

export async function updateCoupon(id: string, patch: Partial<Coupon>) {
  const { error } = await supabase.from('coupons').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteCoupon(id: string) {
  const { error } = await supabase.from('coupons').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Rewards / Loyalty ───────────────────────────────────────
export async function fetchRewards(): Promise<Reward[]> {
  const { data, error } = await supabase.from('rewards').select('*').order('points_cost', { ascending: true });
  if (error) throw new Error(error.message);
  return data as Reward[];
}

export async function createReward(r: Partial<Reward>) {
  const { data, error } = await supabase.from('rewards').insert(r).select().single();
  if (error) throw new Error(error.message);
  return data as Reward;
}

export async function updateReward(id: string, patch: Partial<Reward>) {
  const { error } = await supabase.from('rewards').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteReward(id: string) {
  const { error } = await supabase.from('rewards').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchLoyaltySettings(): Promise<LoyaltySettings | null> {
  const { data, error } = await supabase.from('loyalty_settings').select('*').limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return data as LoyaltySettings | null;
}

export async function updateLoyaltySettings(id: string, patch: Partial<LoyaltySettings>) {
  const { error } = await supabase.from('loyalty_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Customers ───────────────────────────────────────────────
export async function fetchCustomers(segment?: string): Promise<UserProfile[]> {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (segment === 'vip') q = q.in('tier', ['Altın', 'Siyah', 'VIP']);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = data as UserProfile[];
  if (segment === 'new') {
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    rows = rows.filter(r => new Date(r.created_at) >= monthAgo);
  } else if (segment === 'inactive') {
    rows = rows.filter(r => r.is_blocked || r.streak === 0);
  }
  return rows;
}

export async function fetchCustomerOrders(userId: string): Promise<OrderRow[]> {
  const { data, error } = await supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
  if (error) throw new Error(error.message);
  return data as OrderRow[];
}

export async function updateCustomer(userId: string, patch: Partial<UserProfile>) {
  const { error } = await supabase.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ─── Push / Notifications ────────────────────────────────────
export async function fetchPushJobs(): Promise<PushJob[]> {
  const { data, error } = await supabase.from('admin_push_queue').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data as PushJob[];
}

export async function createPushJob(p: Partial<PushJob>) {
  const { data, error } = await supabase.from('admin_push_queue').insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as PushJob;
}

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw new Error(error.message);
  return data as NotificationRow[];
}

// ─── Franchises ──────────────────────────────────────────────
export async function fetchFranchises(): Promise<Franchise[]> {
  const { data, error } = await supabase.from('franchises').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Franchise[];
}

export async function createFranchise(f: Partial<Franchise>) {
  const { data, error } = await supabase.from('franchises').insert(f).select().single();
  if (error) throw new Error(error.message);
  return data as Franchise;
}

export async function updateFranchise(id: string, patch: Partial<Franchise>) {
  const { error } = await supabase.from('franchises').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteFranchise(id: string) {
  const { error } = await supabase.from('franchises').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Employees ───────────────────────────────────────────────
export async function fetchEmployees(): Promise<Employee[]> {
  const { data, error } = await supabase.from('employees').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Employee[];
}

export async function createEmployee(e: Partial<Employee>) {
  const { data, error } = await supabase.from('employees').insert(e).select().single();
  if (error) throw new Error(error.message);
  return data as Employee;
}

export async function updateEmployee(id: string, patch: Partial<Employee>) {
  const { error } = await supabase.from('employees').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteEmployee(id: string) {
  const { error } = await supabase.from('employees').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ─── Inventory ───────────────────────────────────────────────
export async function fetchInventoryItems(): Promise<InventoryItem[]> {
  const { data, error } = await supabase.from('inventory_items').select('*').order('name');
  if (error) throw new Error(error.message);
  return data as InventoryItem[];
}

// ─── B2B Order Management (HQ) ─────────────────────────────
export async function fetchB2BOrders(status?: string): Promise<(B2BOrder & { b2b_order_items: B2BOrderItem[] })[]> {
  let q = supabase
    .from('b2b_orders')
    .select('*, b2b_order_items(*)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status && status !== 'all') {
    q = q.eq('status', status);
  } else if (!status) {
    q = q.in('status', ['paid', 'confirmed', 'preparing', 'shipped', 'delivered']);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as (B2BOrder & { b2b_order_items: B2BOrderItem[] })[];
}

export async function fetchB2BOrderDetail(orderId: string): Promise<(B2BOrder & { b2b_order_items: B2BOrderItem[] }) | null> {
  const { data, error } = await supabase
    .from('b2b_orders')
    .select('*, b2b_order_items(*)')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as (B2BOrder & { b2b_order_items: B2BOrderItem[] }) | null;
}

export async function fetchB2BInvoicesForOrder(orderId: string): Promise<B2BInvoice[]> {
  const { data, error } = await supabase
    .from('b2b_invoices')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as B2BInvoice[];
}

export async function fetchB2BPaymentsForOrder(orderId: string): Promise<B2BPayment[]> {
  const { data, error } = await supabase
    .from('b2b_payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as B2BPayment[];
}

export async function fetchStoreName(storeId: string): Promise<string> {
  const { data, error } = await supabase
    .from('stores')
    .select('name')
    .eq('id', storeId)
    .maybeSingle();
  if (error) return 'Bilinmeyen Şube';
  return (data as { name: string } | null)?.name ?? 'Bilinmeyen Şube';
}

export async function advanceB2BOrderStatus(
  orderId: string,
  newStatus: string,
  opts?: { trackingNo?: string; carrier?: string; eta?: string },
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('advance_b2b_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_tracking_no: opts?.trackingNo ?? '',
    p_carrier: opts?.carrier ?? '',
    p_eta: opts?.eta ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { error: string | null };
}

export async function updateB2BShipping(
  orderId: string,
  carrier: string,
  trackingNo: string,
  trackingUrl: string,
  eta?: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('update_b2b_shipping', {
    p_order_id: orderId,
    p_carrier: carrier,
    p_tracking_no: trackingNo,
    p_tracking_url: trackingUrl,
    p_eta: eta ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { error: string | null };
}

export async function confirmB2BPayment(paymentId: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('confirm_b2b_payment', { p_payment_id: paymentId });
  if (error) throw new Error(error.message);
  return data as { error: string | null };
}

export async function rejectB2BOrder(orderId: string, reason: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('reject_b2b_order', { p_order_id: orderId, p_reason: reason });
  if (error) throw new Error(error.message);
  return data as { error: string | null };
}

export async function fetchFranchiseInfo(franchiseId: string): Promise<Franchise | null> {
  const { data, error } = await supabase
    .from('franchises')
    .select('*')
    .eq('id', franchiseId)
    .maybeSingle();
  if (error) return null;
  return data as Franchise | null;
}

export async function fetchStoreInfo(storeId: string): Promise<Store | null> {
  const { data, error } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .maybeSingle();
  if (error) return null;
  return data as Store | null;
}

export async function fetchB2BOrderTimeline(orderId: string): Promise<{ action: string; created_at: string; actor_id: string | null; details: Record<string, unknown> }[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('action, created_at, actor_id, details')
    .eq('entity_type', 'b2b_order')
    .eq('entity_id', orderId)
    .order('created_at', { ascending: true });
  if (error) return [];
  return data as { action: string; created_at: string; actor_id: string | null; details: Record<string, unknown> }[];
}

export function getB2BInvoicePdfUrl(invoiceId: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  return `${baseUrl}/functions/v1/b2b-invoice-pdf?id=${invoiceId}`;
}

export async function createInventoryItem(i: Partial<InventoryItem>) {
  const { data, error } = await supabase.from('inventory_items').insert(i).select().single();
  if (error) throw new Error(error.message);
  return data as InventoryItem;
}

export async function updateInventoryItem(id: string, patch: Partial<InventoryItem>) {
  const { error } = await supabase.from('inventory_items').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchStoreStock(): Promise<StoreStock[]> {
  const { data, error } = await supabase.from('store_stock').select('*');
  if (error) throw new Error(error.message);
  return data as StoreStock[];
}

export async function addInventoryMovement(m: Partial<InventoryMovement>) {
  const { data, error } = await supabase.from('inventory_movements').insert(m).select().single();
  if (error) throw new Error(error.message);
  return data as InventoryMovement;
}

// ─── B2B Product Management ─────────────────────────────────
export async function fetchB2BProducts(): Promise<B2BProduct[]> {
  const { data, error } = await supabase
    .from('b2b_products')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return data as B2BProduct[];
}

export async function createB2BProduct(p: Partial<B2BProduct>): Promise<B2BProduct> {
  const { data, error } = await supabase.from('b2b_products').insert(p).select().single();
  if (error) throw new Error(error.message);
  return data as B2BProduct;
}

export async function updateB2BProduct(id: string, patch: Partial<B2BProduct>): Promise<void> {
  const { error } = await supabase.from('b2b_products').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteB2BProduct(id: string): Promise<void> {
  const { error } = await supabase.from('b2b_products').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function fetchB2BWarehouses(): Promise<B2BWarehouse[]> {
  const { data, error } = await supabase.from('b2b_warehouses').select('*').order('name');
  if (error) throw new Error(error.message);
  return data as B2BWarehouse[];
}

export async function fetchB2BProductStock(productId: string): Promise<B2BProductStock[]> {
  const { data, error } = await supabase
    .from('b2b_product_stock')
    .select('*, b2b_warehouses(name)')
    .eq('product_id', productId);
  if (error) throw new Error(error.message);
  return data as (B2BProductStock & { b2b_warehouses: { name: string } })[];
}

export async function upsertB2BProductStock(
  productId: string,
  warehouseId: string,
  stockQty: number,
): Promise<void> {
  const { error } = await supabase
    .from('b2b_product_stock')
    .upsert(
      { product_id: productId, warehouse_id: warehouseId, stock_qty: stockQty },
      { onConflict: 'product_id,warehouse_id' },
    );
  if (error) throw new Error(error.message);
}
