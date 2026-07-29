import {
  createContext, useContext, useState, useCallback, useEffect, type ReactNode,
} from 'react';
import { supabase, type Profile, type Store, type Product, type Reward, type CampaignRow, type QrScanRow } from '@/lib/supabase';
import {
  fetchRecentOrdersForAdmin,
  fetchOrderStatsRows,
  updateOrderByNumber,
  deleteOrderByNumber,
} from '@/services/orders';
import { insertBulk } from '@/services/notifications';
import {
  fetchAllRewards,
  fetchQrScansForAdmin,
  createReward as createRewardService,
  updateReward as updateRewardService,
  deleteReward as deleteRewardService,
} from '@/services/loyalty';
import {
  fetchAllProducts,
  createProduct as createProductService,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
} from '@/services/products';
import { TIERS, VIP_TIER_FILTER } from '@shared/constants/loyalty';
import { customerStatusFromTier } from '@shared/utils/loyalty';
import { useAdminToast } from '@/context/AdminToastContext';
import type { TierInfo, Employee } from '@/types';
import { EMPLOYEES, CHALLENGES } from '@/data';

interface Coupon {
  id: string; code: string; title: string;
  type: 'percent' | 'fixed' | 'bogo' | 'gift';
  value: string; redeemed: number; limit: number;
  expires: string; status: 'active' | 'expired' | 'scheduled';
}

interface AdminCustomer {
  id: string; user_id: string; name: string; email: string; phone: string;
  tier: string; orders: number; spent: number; lastOrder: string;
  status: 'active' | 'inactive' | 'vip'; segment: string;
  created_at: string; last_sign_in_at: string | null; is_blocked: boolean;
}

interface AdminOrder {
  id: string; user_id: string; customer: string; items: number; total: number;
  status: string; type: string; store: string; time: string; created_at: string;
}

interface AdminState {
  products: Product[];
  addProduct: (p: Partial<Product>) => Promise<void>;
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;

  stores: Store[];
  addStore: (s: Partial<Store>) => Promise<void>;
  updateStore: (id: string, patch: Partial<Store>) => Promise<void>;
  deleteStore: (id: string) => Promise<void>;

  campaigns: CampaignRow[];
  addCampaign: (c: Partial<CampaignRow>) => Promise<void>;
  updateCampaign: (id: string, patch: Partial<CampaignRow>) => Promise<void>;
  deleteCampaign: (id: string) => Promise<void>;

  coupons: Coupon[];
  addCoupon: (c: Coupon) => void;
  updateCoupon: (id: string, patch: Partial<Coupon>) => void;
  deleteCoupon: (id: string) => void;

  customers: AdminCustomer[];
  updateCustomer: (id: string, patch: Partial<AdminCustomer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  blockCustomer: (id: string, block: boolean) => Promise<void>;

  orders: AdminOrder[];
  updateOrder: (id: string, patch: Partial<AdminOrder>) => Promise<void>;

  tiers: TierInfo[];
  updateTier: (name: string, patch: Partial<TierInfo>) => void;

  rewards: Reward[];
  addReward: (r: Partial<Reward>) => Promise<void>;
  updateReward: (id: string, patch: Partial<Reward>) => Promise<void>;
  deleteReward: (id: string) => Promise<void>;

  employees: Employee[];
  addEmployee: (e: Employee) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  deleteEmployee: (id: string) => void;

  challenges: typeof CHALLENGES;
  addChallenge: (c: typeof CHALLENGES[number]) => void;
  updateChallenge: (id: string, patch: Partial<typeof CHALLENGES[number]>) => void;
  deleteChallenge: (id: string) => void;

  qrScans: QrScanRow[];
  totalCustomers: number;
  totalRevenue: number;
  totalOrders: number;

  deleteOrder: (id: string) => Promise<void>;
  sendPushNotification: (title: string, body: string, segment: string) => Promise<number>;

  showToast: (msg: string) => void;
  loading: boolean;
}

const Ctx = createContext<AdminState | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const { showToast } = useAdminToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [qrScans, setQrScans] = useState<QrScanRow[]>([]);
  const [tiers, setTiers] = useState<TierInfo[]>(TIERS);
  const [employees, setEmployees] = useState<Employee[]>(EMPLOYEES);
  const [challenges, setChallenges] = useState(CHALLENGES);
  const [loading, setLoading] = useState(true);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  const [coupons, setCoupons] = useState<Coupon[]>([
    { id: 'co1', code: 'SONBAHAR20', title: 'Sonbahar Baharat %20 İndirim', type: 'percent', value: '%20 İND', redeemed: 1840, limit: 5000, expires: '31 Eki', status: 'active' },
    { id: 'co2', code: 'MUTLU2', title: 'Mutlu Saat 1+1', type: 'bogo', value: '1+1', redeemed: 3204, limit: 10000, expires: 'Sürekli', status: 'active' },
    { id: 'co3', code: 'DOGUMGUNU-X', title: 'Doğum Günü Ücretsiz İçecek', type: 'gift', value: 'Ücretsiz', redeemed: 412, limit: 1820, expires: 'Aylık', status: 'active' },
  ]);

  const logAdminAction = useCallback(async (
    action: string, entityType: string, entityId: string, details: Record<string, unknown>,
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('audit_logs').insert({
      actor_id: user.id, action, entity_type: entityType, entity_id: entityId, details,
    }).then();
  }, []);

  // Load all admin data from Supabase
  const loadAll = useCallback(async () => {
    setLoading(true);

    const [prodRes, storeRes, campRes, custRes, orderRes, rewRes, scanRes, statsRes] = await Promise.all([
      fetchAllProducts(),
      supabase.from('stores').select('*').order('name'),
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      fetchRecentOrdersForAdmin(20),
      fetchAllRewards(),
      fetchQrScansForAdmin(20),
      fetchOrderStatsRows(),
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (storeRes.data) setStores(storeRes.data as Store[]);
    if (campRes.data) setCampaigns(campRes.data as CampaignRow[]);
    if (rewRes.data) setRewards(rewRes.data);
    if (scanRes.data) setQrScans(scanRes.data);

    if (custRes.data) {
      const profiles = custRes.data as Profile[];
      const orderStatsMap = new Map<string, { count: number; spent: number; lastDate: string }>();
      if (statsRes.data) {
        for (const o of statsRes.data) {
          const cur = orderStatsMap.get(o.user_id) ?? { count: 0, spent: 0, lastDate: '' };
          cur.count += 1;
          cur.spent += Number(o.total);
          if (o.created_at > cur.lastDate) cur.lastDate = o.created_at;
          orderStatsMap.set(o.user_id, cur);
        }
      }
      const adminCusts: AdminCustomer[] = profiles.map(p => {
        const stats = orderStatsMap.get(p.user_id);
        return {
          id: p.id,
          user_id: p.user_id,
          name: p.full_name || 'İsimsiz Üye',
          email: `***@${p.user_id.slice(0, 8)}`,
          phone: p.phone || '',
          tier: p.tier,
          orders: stats?.count ?? 0,
          spent: stats?.spent ?? 0,
          lastOrder: stats?.lastDate ? new Date(stats.lastDate).toLocaleDateString('tr-TR') : '',
          status: customerStatusFromTier(p.tier, p.is_blocked),
          segment: p.tier,
          created_at: p.created_at,
          last_sign_in_at: p.last_sign_in_at ?? null,
          is_blocked: p.is_blocked,
        };
      });
      setCustomers(adminCusts);
      setTotalCustomers(adminCusts.length);
    }

    if (orderRes.data) {
      const profileMap = new Map<string, string>();
      if (custRes.data) {
        for (const p of (custRes.data as Profile[])) {
          profileMap.set(p.user_id, p.full_name || 'İsimsiz Üye');
        }
      }
      const adminOrders: AdminOrder[] = orderRes.data.map(o => ({
        id: o.order_number,
        user_id: o.user_id,
        customer: profileMap.get(o.user_id) ?? 'Misafir',
        items: o.order_items?.length ?? 0,
        total: Number(o.total),
        status: o.status,
        type: o.order_type,
        store: o.store_name,
        time: new Date(o.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        created_at: o.created_at,
      }));
      setOrders(adminOrders);
      setTotalOrders(adminOrders.length);
    }

    if (statsRes.data) {
      setTotalRevenue(statsRes.data.reduce((sum, o) => sum + Number(o.total), 0));
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Products
  const addProduct = useCallback(async (p: Partial<Product>) => {
    const { error } = await createProductService(p);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('create_product', 'product', '', { product: p });
    showToast('Ürün eklendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const updateProduct = useCallback(async (id: string, patch: Partial<Product>) => {
    const { error } = await updateProductService(id, patch);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('update_product', 'product', id, { patch });
    showToast('Ürün güncellendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const deleteProduct = useCallback(async (id: string) => {
    const { error } = await deleteProductService(id);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('delete_product', 'product', id, {});
    showToast('Ürün silindi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  // Stores
  const addStore = useCallback(async (s: Partial<Store>) => {
    const { error } = await supabase.from('stores').insert(s);
    if (error) { showToast('Hata: ' + error.message); return; }
    showToast('Mağaza eklendi'); loadAll();
  }, [showToast, loadAll]);

  const updateStore = useCallback(async (id: string, patch: Partial<Store>) => {
    const { error } = await supabase.from('stores').update(patch).eq('id', id);
    if (error) { showToast('Hata: ' + error.message); return; }
    showToast('Mağaza güncellendi'); loadAll();
  }, [showToast, loadAll]);

  const deleteStore = useCallback(async (id: string) => {
    const { error } = await supabase.from('stores').delete().eq('id', id);
    if (error) { showToast('Hata: ' + error.message); return; }
    showToast('Mağaza silindi'); loadAll();
  }, [showToast, loadAll]);

  // Campaigns
  const addCampaign = useCallback(async (c: Partial<CampaignRow>) => {
    const { error } = await supabase.from('campaigns').insert(c);
    if (error) { showToast('Hata: ' + error.message); return; }
    await logAdminAction('create_campaign', 'campaign', '', { campaign: c });
    showToast('Kampanya eklendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const updateCampaign = useCallback(async (id: string, patch: Partial<CampaignRow>) => {
    const { error } = await supabase.from('campaigns').update(patch).eq('id', id);
    if (error) { showToast('Hata: ' + error.message); return; }
    await logAdminAction('update_campaign', 'campaign', id, { patch });
    showToast('Kampanya güncellendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const deleteCampaign = useCallback(async (id: string) => {
    const { error } = await supabase.from('campaigns').delete().eq('id', id);
    if (error) { showToast('Hata: ' + error.message); return; }
    await logAdminAction('delete_campaign', 'campaign', id, {});
    showToast('Kampanya silindi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  // Customers
  const updateCustomer = useCallback(async (id: string, patch: Partial<AdminCustomer>) => {
    const dbPatch: Record<string, unknown> = {};
    if (patch.tier) dbPatch.tier = patch.tier;
    if (patch.is_blocked !== undefined) dbPatch.is_blocked = patch.is_blocked;
    if (patch.phone !== undefined) dbPatch.phone = patch.phone;
    const { error } = await supabase.from('profiles').update(dbPatch).eq('id', id);
    if (error) { showToast('Hata: ' + error.message); return; }
    await logAdminAction('update_customer', 'profile', id, { patch: dbPatch });
    showToast('Müşteri güncellendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const deleteCustomer = useCallback(async (id: string) => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) { showToast('Hata: ' + error.message); return; }
    await logAdminAction('delete_customer', 'profile', id, {});
    showToast('Müşteri silindi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const blockCustomer = useCallback(async (id: string, block: boolean) => {
    const { error } = await supabase.from('profiles').update({ is_blocked: block }).eq('id', id);
    if (error) { showToast('Hata: ' + error.message); return; }
    await logAdminAction(block ? 'block_customer' : 'unblock_customer', 'profile', id, {});
    showToast(block ? 'Müşteri engellendi' : 'Müşteri engeli kaldırıldı'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  // Orders
  const updateOrder = useCallback(async (id: string, patch: Partial<AdminOrder>) => {
    const dbPatch: { status?: string } = {};
    if (patch.status) dbPatch.status = patch.status;
    const { error } = await updateOrderByNumber(id, dbPatch);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('update_order', 'order', id, { patch: dbPatch });
    showToast('Sipariş güncellendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  // Rewards
  const addReward = useCallback(async (r: Partial<Reward>) => {
    const { error } = await createRewardService(r);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('create_reward', 'reward', '', { reward: r });
    showToast('Ödül eklendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const updateReward = useCallback(async (id: string, patch: Partial<Reward>) => {
    const { error } = await updateRewardService(id, patch);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('update_reward', 'reward', id, { patch });
    showToast('Ödül güncellendi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const deleteReward = useCallback(async (id: string) => {
    const { error } = await deleteRewardService(id);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('delete_reward', 'reward', id, {});
    showToast('Ödül silindi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  // Coupons (local only for now)
  const addCoupon = useCallback((c: Coupon) => {
    setCoupons(list => [c, ...list]);
    showToast('Kupon eklendi');
  }, [showToast]);
  const updateCoupon = useCallback((id: string, patch: Partial<Coupon>) => {
    setCoupons(list => list.map(c => c.id === id ? { ...c, ...patch } : c));
    showToast('Kupon güncellendi');
  }, [showToast]);
  const deleteCoupon = useCallback((id: string) => {
    setCoupons(list => list.filter(c => c.id !== id));
    showToast('Kupon silindi');
  }, [showToast]);

  const updateTier = useCallback((name: string, patch: Partial<TierInfo>) => {
    setTiers(list => list.map(t => t.name === name ? { ...t, ...patch } : t));
    showToast('Seviye güncellendi');
  }, [showToast]);

  // Employees (local)
  const addEmployee = useCallback((e: Employee) => {
    setEmployees(list => [e, ...list]);
    showToast('Çalışan eklendi');
  }, [showToast]);
  const updateEmployee = useCallback((id: string, patch: Partial<Employee>) => {
    setEmployees(list => list.map(e => e.id === id ? { ...e, ...patch } : e));
    showToast('Çalışan güncellendi');
  }, [showToast]);
  const deleteEmployee = useCallback((id: string) => {
    setEmployees(list => list.filter(e => e.id !== id));
    showToast('Çalışan silindi');
  }, [showToast]);

  // Challenges (local)
  const addChallenge = useCallback((c: typeof CHALLENGES[number]) => {
    setChallenges(list => [c, ...list]);
    showToast('Görev eklendi');
  }, [showToast]);
  const updateChallenge = useCallback((id: string, patch: Partial<typeof CHALLENGES[number]>) => {
    setChallenges(list => list.map(c => c.id === id ? { ...c, ...patch } : c));
    showToast('Görev güncellendi');
  }, [showToast]);
  const deleteChallenge = useCallback((id: string) => {
    setChallenges(list => list.filter(c => c.id !== id));
    showToast('Görev silindi');
  }, [showToast]);

  const deleteOrder = useCallback(async (orderNumber: string) => {
    const { error } = await deleteOrderByNumber(orderNumber);
    if (error) { showToast('Hata: ' + error); return; }
    await logAdminAction('delete_order', 'order', orderNumber, {});
    showToast('Sipariş silindi'); loadAll();
  }, [showToast, loadAll, logAdminAction]);

  const sendPushNotification = useCallback(async (title: string, body: string, segment: string) => {
    let query = supabase.from('profiles').select('user_id');
    if (segment === 'vip') query = query.in('tier', [...VIP_TIER_FILTER]);
    else if (segment === 'gold') query = query.eq('tier', 'Altın');
    else if (segment === 'inactive') query = query.eq('is_blocked', false);
    else if (segment === 'birthday') query = query.neq('birthday', '');
    const { data, error } = await query;
    if (error) { showToast('Hata: ' + error.message); return 0; }
    if (!data || data.length === 0) { showToast('Hedef kitlede kullanıcı yok'); return 0; }
    const notifs = data.map(u => ({
      user_id: u.user_id, title, body, type: 'admin',
      data: { deep_link: 'home' },
    }));
    const { error: insErr, count } = await insertBulk(notifs);
    if (insErr) { showToast('Hata: ' + insErr); return 0; }
    await logAdminAction('send_push', 'notification', segment, { title, body, count: data.length });
    showToast(`Bildirim ${count} kullanıcıya gönderildi`);
    return count;
  }, [showToast, logAdminAction]);

  const value: AdminState = {
    products, addProduct, updateProduct, deleteProduct,
    stores, addStore, updateStore, deleteStore,
    campaigns, addCampaign, updateCampaign, deleteCampaign,
    coupons, addCoupon, updateCoupon, deleteCoupon,
    customers, updateCustomer, deleteCustomer, blockCustomer,
    orders, updateOrder,
    tiers, updateTier,
    rewards, addReward, updateReward, deleteReward,
    employees, addEmployee, updateEmployee, deleteEmployee,
    challenges, addChallenge, updateChallenge, deleteChallenge,
    qrScans, totalCustomers, totalRevenue, totalOrders,
    showToast, loading, deleteOrder, sendPushNotification,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAdmin() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAdmin must be used within AdminProvider');
  return c;
}

export function genId(prefix = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export type { CampaignRow };

export type { Coupon, AdminCustomer, AdminOrder };
