import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Platform, useWindowDimensions } from 'react-native';
import {
  LayoutDashboard, ShoppingBag, ScanLine, BarChart3, Bell,
  LogOut, Menu as MenuIcon, X, ArrowLeft, Coffee, Store,
  Package, ShoppingCart, PackageCheck, BookOpen, Receipt,
  Wallet, Boxes, Smartphone,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useAdmin } from '@/context/AdminContext';
import {
  fetchStoreOrders,
  updateOrderStatusByNumber,
  fetchOrderByNumber,
} from '@/services/orders';
import { confirmCashPayment } from '@/services/checkout/checkoutService';
import {
  ORDER_STATUS_LABELS_FRANCHISE,
  ORDER_STATUS_BADGE_BG,
  ORDER_STATUS_BADGE_TEXT,
  isFranchiseActiveOrderStatus,
  getFranchiseOrderAction,
} from '@shared/constants/orders';
import { formatOrderTotalDisplay } from '@shared/utils/orderDisplay';
import { fetchDailyBenefitStats, fetchStoreOperationSnapshot } from '@/services/loyalty';
import { resolveOrderBenefit } from '@shared/utils/orderBenefits';
import { OrderBenefitBadge } from '@/components/orders/OrderBenefitBadge';
import { setB2BOrderTapHandler } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import {
  fetchForStorePanel,
  markNotificationRead,
} from '@/services/notifications';
import {
  getNotificationBadge,
  isB2BSource,
  resolveStoreNotificationOrderRef,
} from '@shared/constants/notifications';
import { AdminScanner } from '@/screens/admin/AdminScanner';
import { FranchiseReports } from '@/screens/admin/FranchiseReports';

// B2B screens
import { B2BDashboard } from '@/screens/b2b/B2BDashboard';
import { B2BProducts } from '@/screens/b2b/B2BProducts';
import { B2BCart } from '@/screens/b2b/B2BCart';
import { B2BOrders } from '@/screens/b2b/B2BOrders';
import { B2BOrderDetail } from '@/screens/b2b/B2BOrderDetail';
import { B2BAccount, B2BInvoices } from '@/screens/b2b/B2BAccount';
import { B2BPayments, B2BTemplates, B2BNotifications } from '@/screens/b2b/B2BMore';
import { cartService } from '@/services/b2b';

const statusLabel = (s: string) => ORDER_STATUS_LABELS_FRANCHISE[s] ?? s;
const statusBadge = (s: string) => ORDER_STATUS_BADGE_BG[s] ?? 'bg-ink-100';
const statusBadgeText = (s: string) => ORDER_STATUS_BADGE_TEXT[s] ?? 'text-ink-600';

type FranchisePage = string;

// Unified navigation — store ops + B2B supply + B2B finance, all in one array.
// B2B items are hardcoded here (not via registry) to guarantee they render.
const navItems: Array<{ id: string; label: string; icon: LucideIcon; group: string; roles: string[]; badge?: 'cart' }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  { id: 'orders', label: 'Siparişler', icon: ShoppingBag, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  { id: 'scanner', label: 'QR Scanner', icon: ScanLine, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  { id: 'reports', label: 'Raporlar', icon: BarChart3, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager'] },
  { id: 'notifications', label: 'Bildirimler', icon: Bell, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  { id: 'b2b_dashboard', label: 'Tedarik Dashboard', icon: LayoutDashboard, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_products', label: 'Ürünler', icon: Package, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_cart', label: 'Sepet', icon: ShoppingCart, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'], badge: 'cart' },
  { id: 'b2b_orders', label: 'Siparişler', icon: PackageCheck, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_templates', label: 'Favori Siparişler', icon: Boxes, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_notifications', label: 'B2B Bildirimleri', icon: Bell, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_account', label: 'Cari Hesap', icon: BookOpen, group: 'Finans', roles: ['franchise'] },
  { id: 'b2b_invoices', label: 'Faturalar', icon: Receipt, group: 'Finans', roles: ['franchise'] },
  { id: 'b2b_payments', label: 'Ödemeler', icon: Wallet, group: 'Finans', roles: ['franchise'] },
];

const GROUP_ORDER = ['Mağaza Operasyon', 'B2B Tedarik', 'Finans'];

function buildNav(role: string): Array<{ id: string; label: string; icon: LucideIcon; group: string; badge?: 'cart' }> {
  return navItems
    .filter(n => n.roles.includes(role))
    .map(n => ({ id: n.id, label: n.label, icon: n.icon, group: n.group, badge: n.badge }));
}

function buildGroups(role: string): string[] {
  const visible = new Set(navItems.filter(n => n.roles.includes(role)).map(n => n.group));
  return GROUP_ORDER.filter(g => visible.has(g));
}

type StoreOrder = {
  id: string;
  user_id: string;
  customer: string;
  items: number;
  total: number;
  status: string;
  type: string;
  time: string;
  created_at: string;
  payment_method?: string | null;
  payment_status?: string | null;
};

type StoreNotif = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
  data: Record<string, unknown> | null;
};

export function FranchiseApp() {
  const { user, signOut, storeId, role, franchiseId } = useAuth();
  const { setPreviewAsCustomer } = useApp();
  const { stores } = useAdmin();
  const [page, setPage] = useState<FranchisePage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1024;
  const showSidebar = isWide || sidebarOpen;
  const [storeName, setStoreName] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [highlightOrderNumber, setHighlightOrderNumber] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [roleLandingDone, setRoleLandingDone] = useState(false);

  useEffect(() => {
    if (isWide) setSidebarOpen(false);
  }, [isWide]);

  const goToCustomer = () => {
    setPreviewAsCustomer(true);
    setSidebarOpen(false);
  };

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(msg);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2600);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const handleSelectOrder = useCallback((orderId: string, source?: string) => {
    if (isB2BSource(source)) {
      setSelectedOrderId(orderId);
      setPage('b2b_order_detail');
    } else {
      setHighlightOrderNumber(orderId);
      setPage('orders');
    }
  }, []);

  useEffect(() => {
    setB2BOrderTapHandler(handleSelectOrder);
    return () => setB2BOrderTapHandler(null);
  }, [handleSelectOrder]);

  useEffect(() => {
    if (roleLandingDone || !role) return;
    if (role === 'franchise' || role === 'store_manager') {
      setPage('b2b_dashboard');
    }
    setRoleLandingDone(true);
  }, [role, roleLandingDone]);

  useEffect(() => {
    if (role !== 'franchise' && role !== 'store_manager') return;
    void cartService.get().then(items => setCartCount(items.length));
  }, [page, role]);

  useEffect(() => {
    if (!storeId) { setStoreName(''); return; }
    let cancelled = false;
    const s = stores.find(st => st.id === storeId);
    if (s) {
      setStoreName(s.name);
      return;
    }
    void supabase.from('stores').select('name').eq('id', storeId).maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setStoreName((data as { name: string }).name);
      });
    return () => { cancelled = true; };
  }, [storeId, stores]);

  // Build nav from unified nav array
  const visibleNav = buildNav(role);
  const visibleGroups = buildGroups(role);

  const current = visibleNav.find(n => n.id === page);

  const roleLabel = role === 'franchise' ? 'Franchise Yetkilisi' : role === 'store_manager' ? 'Mağaza Müdürü' : 'Personel';
  const roleAccent = role === 'franchise' ? 'bg-ex-red' : role === 'store_manager' ? 'bg-gold-500' : 'bg-ink-700';

  const NavButton = ({ item }: { item: { id: string; label: string; icon: LucideIcon; badge?: 'cart' } }) => {
    const active = page === item.id;
    const showCartBadge = item.badge === 'cart' && cartCount > 0;
    return (
      <Pressable
        onPress={() => {
          setPage(item.id);
          setSelectedOrderId(null);
          setSidebarOpen(false);
        }}
        className={cn(
          'w-full flex-row items-center gap-3 px-3.5 py-2.5 rounded-xl',
          active ? 'bg-ex-red shadow-red' : 'bg-transparent active:bg-cream-100',
        )}
      >
        <item.icon size={18} color={active ? '#fff' : '#6E6E78'} />
        <Text className={cn('text-sm font-medium flex-1', active ? 'text-white' : 'text-ink-600')}>{item.label}</Text>
        {showCartBadge && (
          <View className={cn('min-w-[20px] h-5 px-1.5 rounded-full items-center justify-center', active ? 'bg-white' : 'bg-ex-red')}>
            <Text className={cn('text-[10px] font-bold', active ? 'text-ex-red' : 'text-white')}>{cartCount}</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <View className="flex-1 bg-cream-50 flex-row">
      {!isWide && sidebarOpen && (
        <Pressable className="absolute inset-0 z-40 bg-ink-950/40" onPress={() => setSidebarOpen(false)} />
      )}

      <View className={cn(
        'h-full w-64 bg-white border-r border-ink-100 flex-col shrink-0',
        isWide ? 'relative flex' : cn('absolute top-0 left-0 z-50', showSidebar ? 'flex' : 'hidden'),
      )}>
        <View className="p-5 flex-row items-center gap-2.5 border-b border-ink-100 bg-cream-50 shrink-0">
          <View className={cn('h-10 w-10 rounded-xl items-center justify-center shadow-soft shrink-0', roleAccent)}>
            <Store size={18} color="#fff" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-bold text-ink-900 leading-tight" numberOfLines={1}>{storeName || 'Şube Paneli'}</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <View className={cn('h-1.5 w-1.5 rounded-full', roleAccent)} />
              <Text className="text-[10px] text-ink-500 font-medium">{roleLabel}</Text>
            </View>
          </View>
          {!isWide && (
            <Pressable onPress={() => setSidebarOpen(false)} hitSlop={8} className="shrink-0">
              <X size={20} color="#9494A0" />
            </Pressable>
          )}
        </View>

        <View className="px-4 pt-4 pb-2">
          <View className="flex-row items-center gap-2.5 px-3 py-2.5 rounded-xl bg-ink-50">
            <View className="h-8 w-8 rounded-full bg-ex-red/10 items-center justify-center">
              <Text className="text-ex-red text-xs font-bold">{(user?.email ?? '?').charAt(0).toUpperCase()}</Text>
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-xs font-medium text-ink-900" numberOfLines={1}>{user?.email}</Text>
              <Text className="text-[10px] text-ink-400">{roleLabel}</Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1 p-3" showsVerticalScrollIndicator={false} contentContainerClassName="gap-1">
          {visibleGroups.map(group => (
            <View key={group} className="mb-3">
              <Text className="text-[10px] font-semibold text-ink-300 uppercase tracking-wider px-3.5 mb-1.5">{group}</Text>
              <View className="gap-1">
                {visibleNav.filter(n => n.group === group).map(item => <NavButton key={item.id} item={item} />)}
              </View>
            </View>
          ))}
        </ScrollView>

        <View className="p-3 border-t border-ink-100 shrink-0 gap-1">
          <Pressable
            onPress={goToCustomer}
            className="w-full flex-row items-center gap-3 px-3.5 py-2.5 rounded-xl bg-ex-red/10 active:bg-ex-red/15"
          >
            <Smartphone size={18} color="#C8102E" />
            <Text className="text-sm font-semibold text-ex-red">Müşteriye geç</Text>
          </Pressable>
          <Pressable
            onPress={() => signOut()}
            className="w-full flex-row items-center gap-3 px-3.5 py-2.5 rounded-xl active:bg-ink-50"
          >
            <LogOut size={18} color="#6E6E78" />
            <Text className="text-sm font-medium text-ink-500">Çıkış yap</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-1 min-w-0 flex-col">
        <View className="pt-4 pb-3 px-5 border-b border-ink-100 bg-white flex-row items-center justify-between shrink-0">
          <View className="flex-row items-center gap-3 flex-1 min-w-0">
            {!isWide && (
              <Pressable onPress={() => setSidebarOpen(true)} className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center shrink-0">
                <MenuIcon size={20} color="#3D3D42" />
              </Pressable>
            )}
            {page !== 'dashboard' && page !== 'b2b_dashboard' && (
              <Pressable
                onPress={() => { setSelectedOrderId(null); setPage(role === 'franchise' || role === 'store_manager' ? 'b2b_dashboard' : 'dashboard'); }}
                className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center active:bg-cream-200"
              >
                <ArrowLeft size={18} color="#3D3D42" />
              </Pressable>
            )}
            <View className="flex-1 min-w-0">
              <Text className="text-lg font-bold text-ink-900 leading-none font-display" numberOfLines={1}>{current?.label ?? 'Panel'}</Text>
              <Text className="text-[11px] text-ink-400 mt-1" numberOfLines={1}>{storeName} · {roleLabel}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-2">
            {(role === 'franchise' || role === 'store_manager') && cartCount > 0 && (
              <Pressable onPress={() => setPage('b2b_cart')} className="h-9 px-3 rounded-xl bg-ex-red/10 flex-row items-center gap-1.5">
                <ShoppingCart size={14} color="#C8102E" />
                <Text className="text-xs font-bold text-ex-red">{cartCount}</Text>
              </Pressable>
            )}
            <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 border border-green-100">
              <View className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <Text className="text-[10px] font-semibold text-green-700">Aktif</Text>
            </View>
          </View>
        </View>

        <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
          {/* Store Operations */}
          {page === 'dashboard' && <FranchiseDashboard storeId={storeId} storeName={storeName} onGoOrders={() => setPage('orders')} />}
          {page === 'orders' && (
            <FranchiseOrders
              storeId={storeId}
              readOnly={role === 'staff'}
              highlightOrderNumber={highlightOrderNumber}
            />
          )}
          {page === 'scanner' && <AdminScanner />}
          {page === 'reports' && <FranchiseReports storeId={storeId} storeName={storeName} />}
          {page === 'notifications' && <FranchiseNotifications storeId={storeId} onOpenOrder={handleSelectOrder} />}

          {/* B2B */}
          {page === 'b2b_dashboard' && storeId && <B2BDashboard storeId={storeId} storeName={storeName} />}
          {page === 'b2b_products' && <B2BProducts showToast={showToast} />}
          {page === 'b2b_cart' && <B2BCart showToast={showToast} onOrderCreated={() => setPage('b2b_orders')} />}
          {page === 'b2b_orders' && <B2BOrders showToast={showToast} onSelectOrder={handleSelectOrder} />}
          {page === 'b2b_order_detail' && selectedOrderId && <B2BOrderDetail orderId={selectedOrderId} onBack={() => { setSelectedOrderId(null); setPage('b2b_orders'); }} showToast={showToast} />}
          {page === 'b2b_account' && franchiseId && <B2BAccount franchiseId={franchiseId} />}
          {page === 'b2b_invoices' && franchiseId && <B2BInvoices franchiseId={franchiseId} showToast={showToast} />}
          {page === 'b2b_payments' && franchiseId && <B2BPayments franchiseId={franchiseId} />}
          {page === 'b2b_templates' && <B2BTemplates showToast={showToast} />}
          {page === 'b2b_notifications' && storeId && <B2BNotifications storeId={storeId} onOpenOrder={handleSelectOrder} />}
        </ScrollView>
      </View>

      {toast && (
        <View className="absolute bottom-8 inset-x-5 z-50">
          <View className="bg-ink-900 rounded-xl px-4 py-3 shadow-premium">
            <Text className="text-sm font-medium text-white text-center">{toast}</Text>
          </View>
        </View>
      )}
    </View>
  );
}

function StatTile({ label, value, icon, accent }: { label: string; value: string; icon: React.ReactNode; accent?: string }) {
  return (
    <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-4">
      <View className="flex-row items-center justify-between">
        <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide">{label}</Text>
        <View className={cn('h-8 w-8 rounded-lg items-center justify-center', accent ?? 'bg-ex-red/10')}>
          {icon}
        </View>
      </View>
      <Text className="text-2xl font-bold text-ink-900 mt-2">{value}</Text>
    </View>
  );
}

function FranchiseDashboard({ storeId, storeName, onGoOrders }: { storeId: string | null; storeName: string; onGoOrders: () => void }) {
  const [stats, setStats] = useState({ todayOrders: 0, todayRevenue: 0, activeOrders: 0, readyOrders: 0 });
  const [recent, setRecent] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const { data, error } = await fetchStoreOrders(storeId, 50);
    if (error || !data) { setLoading(false); return; }
    const all = data;
    const todayRows = all.filter(o => new Date(o.created_at) >= today);
    setStats({
      todayOrders: todayRows.length,
      todayRevenue: todayRows.reduce((s, o) => s + Number(o.total), 0),
      activeOrders: all.filter(o => isFranchiseActiveOrderStatus(o.status)).length,
      readyOrders: all.filter(o => o.status === 'ready').length,
    });
    setRecent(all.slice(0, 5).map(o => ({
      id: o.order_number,
      user_id: o.user_id,
      customer: 'Müşteri',
      items: o.order_items?.length ?? 0,
      total: Number(o.total),
      status: o.status,
      type: o.order_type,
      time: new Date(o.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      created_at: o.created_at,
    })));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <View className="items-center justify-center py-20"><View className="h-8 w-8 rounded-full border-2 border-ex-red border-t-transparent" /></View>;

  return (
    <View className="max-w-4xl w-full mx-auto gap-6">
      <View>
        <Text className="text-lg font-bold text-ink-900">Hoş geldin, {storeName || 'Şube'} ekibi</Text>
        <Text className="text-sm text-ink-400 mt-0.5">Bugünkü şube performansın</Text>
      </View>

      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[140px]"><StatTile label="Bugün sipariş" value={String(stats.todayOrders)} icon={<ShoppingBag size={16} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[140px]"><StatTile label="Bugün ciro" value={`₺${stats.todayRevenue.toLocaleString('tr-TR')}`} icon={<Coffee size={16} color="#16a34a" />} accent="bg-green-50" /></View>
        <View className="flex-1 min-w-[140px]"><StatTile label="Aktif sipariş" value={String(stats.activeOrders)} icon={<BarChart3 size={16} color="#d97706" />} accent="bg-amber-50" /></View>
        <View className="flex-1 min-w-[140px]"><StatTile label="Hazır" value={String(stats.readyOrders)} icon={<ShoppingBag size={16} color="#2563eb" />} accent="bg-blue-50" /></View>
      </View>

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-sm font-bold text-ink-900">Son siparişler</Text>
          <Pressable onPress={onGoOrders}><Text className="text-xs font-medium text-ex-red">Tümünü gör</Text></Pressable>
        </View>
        {recent.length === 0 ? (
          <Text className="text-sm text-ink-400 py-6 text-center">Henüz sipariş yok</Text>
        ) : (
          <View>
            {recent.map((o, i) => (
              <View key={o.id} className={cn('flex-row items-center gap-3 py-2.5', i > 0 && 'border-t border-ink-50')}>
                <View className="h-9 w-9 rounded-xl bg-ink-900 items-center justify-center shrink-0"><Coffee size={15} color="#fff" /></View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{o.id}</Text>
                  <Text className="text-[11px] text-ink-400">{o.items} ürün · {o.time}</Text>
                </View>
                <View className={cn('px-2 py-1 rounded-full', statusBadge(o.status))}>
                  <Text className="text-[10px] font-semibold">{statusLabel(o.status)}</Text>
                </View>
                <Text className="text-sm font-semibold text-ex-red">₺{o.total.toLocaleString('tr-TR')}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function FranchiseOrders({
  storeId,
  readOnly,
  highlightOrderNumber,
}: {
  storeId: string | null;
  readOnly?: boolean;
  highlightOrderNumber?: string | null;
}) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [opSnapshot, setOpSnapshot] = useState<Awaited<ReturnType<typeof fetchStoreOperationSnapshot>> | null>(null);
  const [dailyStats, setDailyStats] = useState<{ freeOrders: number; stampRedemptions: number; rewardRedemptions: number } | null>(null);

  const load = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const [{ data, error }, snap, statsRes] = await Promise.all([
      fetchStoreOrders(storeId, 100),
      fetchStoreOperationSnapshot(storeId).catch(() => null),
      fetchDailyBenefitStats({ storeId }),
    ]);
    if (statsRes.data) {
      setDailyStats({
        freeOrders: statsRes.data.freeOrders,
        stampRedemptions: statsRes.data.stampRedemptions,
        rewardRedemptions: statsRes.data.rewardRedemptions,
      });
    }
    setOpSnapshot(snap);
    if (error || !data) { setLoading(false); return; }
    const userIds = [...new Set(data.map(o => o.user_id))];
    const { data: profiles } = userIds.length
      ? await supabase.from('profiles').select('user_id, full_name').in('user_id', userIds)
      : { data: [] as { user_id: string; full_name: string }[] };
    const nameMap = new Map((profiles ?? []).map(p => [p.user_id, p.full_name || 'Müşteri']));
    setOrders(data.map(o => ({
      id: o.order_number,
      user_id: o.user_id,
      customer: nameMap.get(o.user_id) ?? 'Müşteri',
      items: o.order_items?.length ?? 0,
      total: Number(o.total),
      status: o.status,
      type: o.order_type,
      time: new Date(o.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      created_at: o.created_at,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
    })));
    setLoading(false);
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!highlightOrderNumber) return;
    setExpandedOrder(highlightOrderNumber);
    const match = orders.find(o => o.id === highlightOrderNumber);
    if (match && !isFranchiseActiveOrderStatus(match.status)) {
      setFilter('all');
    }
  }, [highlightOrderNumber, orders]);

  const runAction = useCallback(async (order: StoreOrder) => {
    const action = getFranchiseOrderAction(order);
    if (!action || action.kind === 'waiting') return;
    setUpdating(order.id);
    if (action.kind === 'confirm_cash') {
      const { error } = await confirmCashPayment(order.id);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: 'confirmed', payment_status: 'paid' } : o));
      }
    } else {
      const { error } = await updateOrderStatusByNumber(order.id, action.nextStatus);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: action.nextStatus } : o));
      }
    }
    setUpdating(null);
  }, []);

  const visible = filter === 'active'
    ? orders.filter(o => isFranchiseActiveOrderStatus(o.status))
    : orders;

  if (loading) return <View className="items-center justify-center py-20"><View className="h-8 w-8 rounded-full border-2 border-ex-red border-t-transparent" /></View>;

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      {dailyStats && (
        <View className="flex-row flex-wrap gap-2">
          {[
            { label: 'Ücretsiz sipariş', value: dailyStats.freeOrders },
            { label: 'Damga ödülü', value: dailyStats.stampRedemptions },
            { label: 'Puan ödülü', value: dailyStats.rewardRedemptions },
          ].map(s => (
            <View key={s.label} className="px-3 py-2 rounded-xl bg-green-50 border border-green-100">
              <Text className="text-[10px] text-green-700 font-semibold uppercase">{s.label}</Text>
              <Text className="text-lg font-bold text-green-800">{s.value}</Text>
            </View>
          ))}
        </View>
      )}

      <View className="flex-row gap-2 p-1 bg-ink-100 rounded-2xl self-start">
        <Pressable onPress={() => setFilter('active')} className={cn('px-4 py-2 rounded-xl', filter === 'active' ? 'bg-white shadow-card' : '')}>
          <Text className={cn('text-sm font-medium', filter === 'active' ? 'text-ink-900' : 'text-ink-500')}>Aktif</Text>
        </Pressable>
        <Pressable onPress={() => setFilter('all')} className={cn('px-4 py-2 rounded-xl', filter === 'all' ? 'bg-white shadow-card' : '')}>
          <Text className={cn('text-sm font-medium', filter === 'all' ? 'text-ink-900' : 'text-ink-500')}>Tümü</Text>
        </Pressable>
      </View>

      {visible.length === 0 ? (
        <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-10 items-center">
          <ShoppingBag size={32} color="#C8C4CC" />
          <Text className="text-sm text-ink-400 mt-3">{filter === 'active' ? 'Aktif sipariş yok' : 'Sipariş bulunamadı'}</Text>
        </View>
      ) : (
        <View className="gap-3">
          {visible.map(o => {
            const benefit = opSnapshot ? resolveOrderBenefit(
              { total: o.total, points_earned: 0, user_id: o.user_id, store_id: storeId, created_at: o.created_at },
              opSnapshot,
            ) : null;
            const action = getFranchiseOrderAction(o);
            const isExpanded = expandedOrder === o.id;
            const isHighlighted = highlightOrderNumber === o.id;
            return (
            <View key={o.id} className={cn(
              'rounded-2xl bg-white border shadow-card p-4',
              benefit && benefit.kind !== 'paid' ? 'border-green-200 bg-green-50/30' : 'border-ink-100',
              isHighlighted && 'border-ex-red ring-2 ring-ex-red/20',
            )}>
              <Pressable onPress={() => setExpandedOrder(prev => prev === o.id ? null : o.id)}>
              <View className="flex-row items-start gap-3">
                <View className="h-11 w-11 rounded-xl bg-ink-900 items-center justify-center shrink-0"><Coffee size={18} color="#fff" /></View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-sm font-bold text-ink-900">{o.id}</Text>
                    {benefit && benefit.kind !== 'paid' && <OrderBenefitBadge benefit={benefit} compact />}
                    <View className={cn('px-2 py-0.5 rounded-full', statusBadge(o.status))}>
                      <Text className={cn('text-[10px] font-semibold', statusBadgeText(o.status))}>{statusLabel(o.status)}</Text>
                    </View>
                  </View>
                  <Text className="text-[11px] text-ink-400 mt-0.5">{o.customer} · {o.items} ürün · {o.type} · {o.time}</Text>
                  {benefit && benefit.kind !== 'paid' && (
                    <Text className="text-[10px] text-green-700 mt-0.5">{benefit.detail}</Text>
                  )}
                </View>
                <Text className={cn('text-base font-bold', benefit && benefit.kind !== 'paid' ? 'text-green-700' : 'text-ex-red')}>
                  {formatOrderTotalDisplay(o.total, n => `₺${n.toLocaleString('tr-TR')}`)}
                </Text>
              </View>
              {isExpanded && <OrderLineItems orderNumber={o.id} />}
              </Pressable>
              {!readOnly && action && (
              <View className="flex-row flex-wrap items-stretch gap-2 mt-3">
                {action.kind === 'waiting' ? (
                  <View className="min-w-[140px] flex-grow px-4 py-2.5 rounded-xl bg-ink-100">
                    <Text className="text-sm font-medium text-ink-500 text-center">{action.label}</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => void runAction(o)}
                    disabled={updating === o.id}
                    className={cn(
                      'min-w-[140px] flex-grow flex-row items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl disabled:opacity-40',
                      action.kind === 'confirm_cash' ? 'bg-purple-600 active:bg-purple-700' : 'bg-ex-red active:bg-ex-redDark',
                    )}
                  >
                    {updating === o.id
                      ? <View className="h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                      : <Text className="text-sm font-medium text-white">{action.label}</Text>}
                  </Pressable>
                )}
              </View>
              )}
            </View>
          );})}
        </View>
      )}
    </View>
  );
}

function OrderLineItems({ orderNumber }: { orderNumber: string }) {
  const [lines, setLines] = useState<Array<{ name: string; quantity: number; unit_price: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchOrderByNumber(orderNumber).then(({ data }) => {
      setLines((data?.order_items ?? []).map(i => ({
        name: i.name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
      })));
      setLoading(false);
    });
  }, [orderNumber]);

  if (loading) {
    return (
      <View className="mt-3 pt-3 border-t border-ink-100 items-center py-2">
        <View className="h-4 w-4 rounded-full border-2 border-ex-red border-t-transparent" />
      </View>
    );
  }

  if (lines.length === 0) {
    return (
      <View className="mt-3 pt-3 border-t border-ink-100">
        <Text className="text-xs text-ink-400">Ürün detayı yok</Text>
      </View>
    );
  }

  return (
    <View className="mt-3 pt-3 border-t border-ink-100 gap-1.5">
      <Text className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-0.5">Sipariş içeriği</Text>
      {lines.map((line, idx) => (
        <View key={`${line.name}-${idx}`} className="flex-row items-center justify-between">
          <Text className="text-sm text-ink-700 flex-1" numberOfLines={2}>{line.quantity}x {line.name}</Text>
          <Text className="text-sm font-medium text-ink-900 ml-2">₺{(line.unit_price * line.quantity).toLocaleString('tr-TR')}</Text>
        </View>
      ))}
    </View>
  );
}

function FranchiseNotifications({ storeId, onOpenOrder }: { storeId: string | null; onOpenOrder: (orderId: string, source?: string) => void }) {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<(StoreNotif & { data: Record<string, unknown> | null })[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await fetchForStorePanel(user.id, storeId, 30);
    if (error || !data) { setLoading(false); return; }
    setNotifs(data.map(n => ({
      id: n.id,
      title: n.title,
      body: n.body,
      created_at: n.created_at,
      is_read: n.is_read,
      data: n.data as Record<string, unknown> | null,
    })));
    setLoading(false);
  }, [storeId, user?.id]);

  useEffect(() => { load(); }, [load]);

  const handlePress = async (n: StoreNotif & { data: Record<string, unknown> | null }) => {
    if (!n.is_read) {
      await markNotificationRead(n.id);
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
    }
    const orderRef = resolveStoreNotificationOrderRef({ body: n.body, data: n.data });
    const source = n.data?.source as string | undefined;
    if (orderRef) onOpenOrder(orderRef, source);
  };

  if (loading) return <View className="items-center justify-center py-20"><View className="h-8 w-8 rounded-full border-2 border-ex-red border-t-transparent" /></View>;

  return (
    <View className="max-w-3xl w-full mx-auto gap-3">
      <Text className="text-lg font-bold text-ink-900">Şube bildirimleri</Text>
      {notifs.length === 0 ? (
        <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-10 items-center">
          <Bell size={32} color="#C8C4CC" />
          <Text className="text-sm text-ink-400 mt-3">Bu şubeye ait bildirim yok</Text>
        </View>
      ) : (
        notifs.map(n => {
          const orderRef = resolveStoreNotificationOrderRef({ body: n.body, data: n.data });
          const isB2B = isB2BSource(n.data?.source as string | undefined);
          const badge = getNotificationBadge(n.is_read);
          return (
            <Pressable key={n.id} onPress={() => handlePress(n)} disabled={!orderRef}>
              <View className={cn('rounded-2xl border shadow-card p-4', n.is_read ? 'bg-white border-ink-100' : 'bg-white border-ex-red/20', orderRef && 'active:opacity-70')}>
                <View className="flex-row items-start gap-3">
                  <View className={cn('h-9 w-9 rounded-xl items-center justify-center shrink-0', badge.container)}>
                    <Bell size={16} color={badge.iconColor} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-semibold text-ink-900">{n.title}</Text>
                      {isB2B && <View className="px-1.5 py-0.5 rounded bg-ex-red/10"><Text className="text-[10px] font-bold text-ex-red">B2B</Text></View>}
                    </View>
                    <Text className="text-sm text-ink-500 mt-0.5">{n.body}</Text>
                    <View className="flex-row items-center gap-2 mt-1.5">
                      <Text className="text-[11px] text-ink-300">{new Date(n.created_at).toLocaleString('tr-TR')}</Text>
                      {orderRef && <View className="flex-row items-center gap-1"><View className="h-1 w-1 rounded-full bg-ink-300" /><Text className="text-[11px] text-ex-red font-medium">Siparişe Git</Text></View>}
                    </View>
                  </View>
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}
