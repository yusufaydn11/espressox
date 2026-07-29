import { supabase } from './supabase';
import {
  fetchOrders as fetchOrdersService,
  updateOrderStatus as updateOrderStatusService,
  fetchCustomerOrders as fetchCustomerOrdersService,
  fetchDashboardKpisAggregate,
  fetchSalesSeriesAggregate,
  fetchStoreComparisonAggregate,
  fetchTopProductsAggregate,
  fetchRecentOrdersAggregate,
  type DashboardRecentOrderRow,
} from '../services/orders';
import {
  fetchPushJobs as fetchPushJobsService,
  createPushJob as createPushJobService,
  fetchNotifications as fetchNotificationsService,
  sendB2BPushNotify,
} from '../services/notifications';
import {
  fetchRewards as fetchRewardsService,
  createReward as createRewardService,
  updateReward as updateRewardService,
  deleteReward as deleteRewardService,
  fetchLoyaltySettings as fetchLoyaltySettingsService,
  updateLoyaltySettings as updateLoyaltySettingsService,
} from '../services/loyalty';
import {
  fetchProducts as fetchProductsService,
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  fetchCategories as fetchCategoriesService,
  createCategory as createCategoryService,
  updateCategory as updateCategoryService,
  deleteCategory as deleteCategoryService,
  reorderCategories as reorderCategoriesService,
} from '../services/products';
import {
  fetchB2BProducts as fetchB2BProductsService,
  createB2BProduct as createB2BProductService,
  updateB2BProduct as updateB2BProductService,
  deleteB2BProduct as deleteB2BProductService,
  fetchB2BWarehouses as fetchB2BWarehousesService,
  fetchB2BProductStock as fetchB2BProductStockService,
  upsertB2BProductStock as upsertB2BProductStockService,
  fetchB2BInvoicesForOrder as fetchB2BInvoicesForOrderService,
  fetchB2BPaymentsForOrder as fetchB2BPaymentsForOrderService,
  confirmB2BPayment as confirmB2BPaymentService,
  getB2BInvoicePdfUrl as getB2BInvoicePdfUrlService,
  getB2BOrderPdfUrl as getB2BOrderPdfUrlService,
} from '../services/b2b';
import { VIP_TIER_FILTER } from '@shared/constants/loyalty';
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
  const data = await fetchDashboardKpisAggregate();
  if (data.error) throw new Error(String(data.error));

  return {
    todaySales: Number(data.today_sales ?? 0),
    monthRevenue: Number(data.month_revenue ?? 0),
    totalOrders: Number(data.total_orders ?? 0),
    avgBasket: Number(data.avg_basket ?? 0),
    activeCustomers: Number(data.active_customers ?? 0),
    pointsRedeemed: Number(data.points_redeemed ?? 0),
    newMembers: Number(data.new_members ?? 0),
    topProduct: String(data.top_product ?? '—'),
  };
}

export async function fetchSalesSeries(days: number): Promise<{ label: string; value: number }[]> {
  const rows = await fetchSalesSeriesAggregate(days);
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  rows.forEach(r => {
    const k = r.created_at.slice(0, 10);
    if (k in buckets) buckets[k] += Number(r.total);
  });
  return Object.entries(buckets).map(([k, v]) => ({
    label: new Date(k).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
    value: Math.round(v),
  }));
}

export async function fetchStoreComparison(): Promise<{ label: string; value: number }[]> {
  const rows = await fetchStoreComparisonAggregate(8);
  return rows.map(r => ({ label: r.store_name, value: Math.round(Number(r.total)) }));
}

export async function fetchTopProducts(limit = 8): Promise<{ label: string; value: number }[]> {
  const rows = await fetchTopProductsAggregate(limit);
  return rows.map(r => ({ label: r.name, value: Number(r.quantity) }));
}

export async function fetchRecentDashboardOrders(limit = 6): Promise<DashboardRecentOrderRow[]> {
  return fetchRecentOrdersAggregate(limit);
}

// ─── Orders ──────────────────────────────────────────────────
export async function fetchOrders(status?: string): Promise<(OrderRow & { order_items: OrderItemRow[] })[]> {
  return fetchOrdersService(status);
}

export async function updateOrderStatus(id: string, status: string) {
  return updateOrderStatusService(id, status);
}

// ─── Products ────────────────────────────────────────────────
export async function fetchProducts(): Promise<Product[]> {
  return fetchProductsService();
}

export async function createProduct(p: Partial<Product>) {
  return createProductService(p);
}

export async function updateProduct(id: string, patch: Partial<Product>) {
  return updateProductService(id, patch);
}

export async function deleteProduct(id: string) {
  return deleteProductService(id);
}

// ─── Categories ──────────────────────────────────────────────
export async function fetchCategories(): Promise<Category[]> {
  return fetchCategoriesService();
}

export async function createCategory(c: Partial<Category>) {
  return createCategoryService(c);
}

export async function updateCategory(id: string, patch: Partial<Category>) {
  return updateCategoryService(id, patch);
}

export async function deleteCategory(id: string) {
  return deleteCategoryService(id);
}

export async function reorderCategories(items: { id: string; sort_order: number }[]) {
  return reorderCategoriesService(items);
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
  return fetchRewardsService();
}

export async function createReward(r: Partial<Reward>) {
  return createRewardService(r);
}

export async function updateReward(id: string, patch: Partial<Reward>) {
  return updateRewardService(id, patch);
}

export async function deleteReward(id: string) {
  return deleteRewardService(id);
}

export async function fetchLoyaltySettings(): Promise<LoyaltySettings | null> {
  return fetchLoyaltySettingsService();
}

export async function updateLoyaltySettings(id: string, patch: Partial<LoyaltySettings>) {
  return updateLoyaltySettingsService(id, patch);
}

// ─── Customers ───────────────────────────────────────────────
export async function fetchCustomers(segment?: string): Promise<UserProfile[]> {
  let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (segment === 'vip') q = q.in('tier', [...VIP_TIER_FILTER]);
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
  return fetchCustomerOrdersService(userId);
}

export async function updateCustomer(userId: string, patch: Partial<UserProfile>) {
  const { error } = await supabase.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

// ─── Push / Notifications ────────────────────────────────────
export async function fetchPushJobs(): Promise<PushJob[]> {
  return fetchPushJobsService();
}

export async function createPushJob(p: Partial<PushJob>) {
  return createPushJobService(p);
}

export async function fetchNotifications(): Promise<NotificationRow[]> {
  return fetchNotificationsService();
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
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as (B2BOrder & { b2b_order_items: B2BOrderItem[] })[];
}

export type B2BOrderWithMeta = B2BOrder & {
  b2b_order_items: B2BOrderItem[];
  franchise_name?: string;
  store_name?: string;
};

export async function enrichB2BOrdersWithMeta(
  orders: (B2BOrder & { b2b_order_items: B2BOrderItem[] })[],
): Promise<B2BOrderWithMeta[]> {
  const storeIds = [...new Set(orders.map(o => o.store_id).filter(Boolean))] as string[];
  const franchiseIds = [...new Set(orders.map(o => o.franchise_id).filter(Boolean))] as string[];

  const [storesRes, franchisesRes] = await Promise.all([
    storeIds.length
      ? supabase.from('stores').select('id, name').in('id', storeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    franchiseIds.length
      ? supabase.from('franchises').select('id, company_name').in('id', franchiseIds)
      : Promise.resolve({ data: [] as { id: string; company_name: string }[] }),
  ]);

  const storeNames: Record<string, string> = {};
  const franchiseNames: Record<string, string> = {};
  (storesRes.data ?? []).forEach((s: { id: string; name: string }) => { storeNames[s.id] = s.name; });
  (franchisesRes.data ?? []).forEach((f: { id: string; company_name: string }) => { franchiseNames[f.id] = f.company_name; });

  return orders.map(o => ({
    ...o,
    store_name: o.store_id ? storeNames[o.store_id] ?? '—' : '—',
    franchise_name: o.franchise_id ? franchiseNames[o.franchise_id] ?? '—' : '—',
  }));
}

export type B2BOrderDetail = B2BOrder & {
  b2b_order_items: B2BOrderItem[];
  creator_name?: string;
  franchise_name?: string;
  store_name?: string;
};

export async function fetchB2BOrderDetail(orderId: string): Promise<B2BOrderDetail | null> {
  const { data, error } = await supabase
    .from('b2b_orders')
    .select('*, b2b_order_items(*)')
    .eq('id', orderId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const order = data as B2BOrder & { b2b_order_items: B2BOrderItem[] };
  const productIds = order.b2b_order_items.map(i => i.product_id).filter(Boolean) as string[];

  const [creatorRes, franchiseRes, storeRes, productsRes] = await Promise.all([
    order.created_by
      ? supabase.from('profiles').select('full_name').eq('user_id', order.created_by).maybeSingle()
      : Promise.resolve({ data: null }),
    order.franchise_id
      ? supabase.from('franchises').select('company_name').eq('id', order.franchise_id).maybeSingle()
      : Promise.resolve({ data: null }),
    order.store_id
      ? supabase.from('stores').select('name').eq('id', order.store_id).maybeSingle()
      : Promise.resolve({ data: null }),
    productIds.length
      ? supabase.from('b2b_products').select('id, image_url').in('id', productIds)
      : Promise.resolve({ data: [] }),
  ]);

  const imageMap: Record<string, string> = {};
  (productsRes.data as { id: string; image_url: string }[] | null)?.forEach(p => {
    imageMap[p.id] = p.image_url;
  });

  return {
    ...order,
    b2b_order_items: order.b2b_order_items.map(it => ({
      ...it,
      image_url: it.product_id ? imageMap[it.product_id] ?? '' : '',
    })),
    creator_name: (creatorRes.data as { full_name: string } | null)?.full_name ?? '—',
    franchise_name: (franchiseRes.data as { company_name: string } | null)?.company_name ?? '—',
    store_name: (storeRes.data as { name: string } | null)?.name ?? '—',
  };
}

export async function fetchB2BInvoicesForOrder(orderId: string): Promise<B2BInvoice[]> {
  return fetchB2BInvoicesForOrderService(orderId);
}

export async function fetchB2BPaymentsForOrder(orderId: string): Promise<B2BPayment[]> {
  return fetchB2BPaymentsForOrderService(orderId);
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

const B2B_STATUS_PUSH_LABELS: Record<string, string> = {
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
};

export async function advanceB2BOrderStatus(
  orderId: string,
  newStatus: string,
  opts?: { trackingNo?: string; carrier?: string; eta?: string; orderNumber?: string },
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('advance_b2b_order_status', {
    p_order_id: orderId,
    p_new_status: newStatus,
    p_tracking_no: opts?.trackingNo ?? '',
    p_carrier: opts?.carrier ?? '',
    p_eta: opts?.eta ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as { error: string | null };
  if (!result.error) {
    const label = B2B_STATUS_PUSH_LABELS[newStatus] ?? newStatus;
    await sendB2BPushNotify(
      orderId,
      `Sipariş: ${label}`,
      `${opts?.orderNumber ?? 'Siparişiniz'} — ${label}`,
    );
  }
  return result;
}

export async function updateB2BShipping(
  orderId: string,
  carrier: string,
  trackingNo: string,
  trackingUrl: string,
  eta?: string,
  orderNumber?: string,
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('update_b2b_shipping', {
    p_order_id: orderId,
    p_carrier: carrier,
    p_tracking_no: trackingNo,
    p_tracking_url: trackingUrl,
    p_eta: eta ?? null,
  });
  if (error) throw new Error(error.message);
  const result = data as { error: string | null };
  if (!result.error) {
    await sendB2BPushNotify(
      orderId,
      'Kargo Bilgisi Güncellendi',
      `${orderNumber ?? 'Siparişiniz'} — ${carrier || 'Kargo'} ${trackingNo ? `· ${trackingNo}` : ''}`.trim(),
    );
  }
  return result;
}

export async function confirmB2BPayment(paymentId: string): Promise<{ error: string | null }> {
  return confirmB2BPaymentService(paymentId);
}

export async function rejectB2BOrder(orderId: string, reason: string, orderNumber?: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('reject_b2b_order', { p_order_id: orderId, p_reason: reason });
  if (error) throw new Error(error.message);
  const result = data as { error: string | null };
  if (!result.error) {
    await sendB2BPushNotify(orderId, 'Sipariş İptal Edildi', `${orderNumber ?? 'Siparişiniz'} iptal edildi`);
  }
  return result;
}

export async function addB2BAdminNote(orderId: string, note: string): Promise<{ error: string | null }> {
  const { data, error } = await supabase.rpc('add_b2b_admin_note', { p_order_id: orderId, p_note: note });
  if (error) throw new Error(error.message);
  const result = data as { error: string | null };
  if (!result.error) {
    await sendB2BPushNotify(orderId, 'Yeni Sipariş Notu', note.slice(0, 120));
  }
  return result;
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

export type B2BTimelineEntry = {
  action: string;
  created_at: string;
  actor_id: string | null;
  actor_name: string;
  details: Record<string, unknown>;
};

export async function fetchB2BOrderTimeline(orderId: string): Promise<B2BTimelineEntry[]> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('action, created_at, actor_id, details')
    .eq('entity_type', 'b2b_order')
    .eq('entity_id', orderId)
    .order('created_at', { ascending: true });
  if (error) return [];

  const rows = data as { action: string; created_at: string; actor_id: string | null; details: Record<string, unknown> }[];
  const actorIds = [...new Set(rows.map(r => r.actor_id).filter(Boolean))] as string[];
  const nameMap: Record<string, string> = {};

  if (actorIds.length) {
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name').in('user_id', actorIds);
    (profiles as { user_id: string; full_name: string }[] | null)?.forEach(p => {
      nameMap[p.user_id] = p.full_name || 'Sistem';
    });
  }

  return rows.map(r => ({
    ...r,
    actor_name: r.actor_id ? nameMap[r.actor_id] ?? 'Merkez' : 'Sistem',
  }));
}

export async function getB2BInvoicePdfUrl(invoiceId: string): Promise<string> {
  return getB2BInvoicePdfUrlService(invoiceId);
}

export async function getB2BOrderPdfUrl(orderId: string): Promise<string> {
  return getB2BOrderPdfUrlService(orderId);
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
  return fetchB2BProductsService();
}

export async function createB2BProduct(p: Partial<B2BProduct>): Promise<B2BProduct> {
  return createB2BProductService(p);
}

export async function updateB2BProduct(id: string, patch: Partial<B2BProduct>): Promise<void> {
  return updateB2BProductService(id, patch);
}

export async function deleteB2BProduct(id: string): Promise<void> {
  return deleteB2BProductService(id);
}

export async function fetchB2BWarehouses(): Promise<B2BWarehouse[]> {
  return fetchB2BWarehousesService();
}

export async function fetchB2BProductStock(productId: string): Promise<B2BProductStock[]> {
  return fetchB2BProductStockService(productId);
}

export async function upsertB2BProductStock(
  productId: string,
  warehouseId: string,
  stockQty: number,
): Promise<void> {
  return upsertB2BProductStockService(productId, warehouseId, stockQty);
}
