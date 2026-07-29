import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  LayoutDashboard, ShoppingBag, ScanLine, BarChart3, Bell,
  LogOut, Menu as MenuIcon, X, ArrowLeft, Coffee, Store,
  Package, ShoppingCart, PackageCheck, BookOpen, Receipt,
  Wallet, Boxes,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import {
  fetchStoreOrders,
  updateOrderStatusByNumber,
} from '@/services/orders';
import {
  ORDER_STATUS_LABELS_FRANCHISE,
  ORDER_STATUS_BADGE_BG,
  ORDER_STATUS_BADGE_TEXT,
  nextOrderStatus,
} from '@shared/constants/orders';
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

const statusLabel = (s: string) => ORDER_STATUS_LABELS_FRANCHISE[s] ?? s;
const statusBadge = (s: string) => ORDER_STATUS_BADGE_BG[s] ?? 'bg-ink-100';
const statusBadgeText = (s: string) => ORDER_STATUS_BADGE_TEXT[s] ?? 'text-ink-600';
const nextStatus = nextOrderStatus;

type FranchisePage = string;

// Unified navigation — store ops + B2B supply + B2B finance, all in one array.
// B2B items are hardcoded here (not via registry) to guarantee they render.
const navItems: Array<{ id: string; label: string; icon: LucideIcon; group: string; roles: string[] }> = [
  // ── Mağaza Operasyon ──
  { id: 'dashboard', label: 'Şube Paneli', icon: LayoutDashboard, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  { id: 'orders', label: 'Müşteri Siparişleri', icon: ShoppingBag, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  { id: 'scanner', label: 'QR Tara', icon: ScanLine, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  { id: 'reports', label: 'Raporlar', icon: BarChart3, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager'] },
  { id: 'notifications', label: 'Şube Bildirimleri', icon: Bell, group: 'Mağaza Operasyon', roles: ['franchise', 'store_manager', 'staff'] },
  // ── B2B Tedarik ──
  { id: 'b2b_dashboard', label: 'Tedarik Dashboard', icon: LayoutDashboard, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_products', label: 'Ürünler', icon: Package, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_cart', label: 'Sepet', icon: ShoppingCart, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_orders', label: 'Siparişlerim', icon: PackageCheck, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_templates', label: 'Favori Siparişler', icon: Boxes, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  { id: 'b2b_notifications', label: 'B2B Bildirimleri', icon: Bell, group: 'B2B Tedarik', roles: ['franchise', 'store_manager'] },
  // ── B2B Finans ──
  { id: 'b2b_account', label: 'Cari Hesap', icon: BookOpen, group: 'B2B Finans', roles: ['franchise'] },
  { id: 'b2b_invoices', label: 'Faturalar', icon: Receipt, group: 'B2B Finans', roles: ['franchise'] },
  { id: 'b2b_payments', label: 'Ödemeler', icon: Wallet, group: 'B2B Finans', roles: ['franchise'] },
];

const GROUP_ORDER = ['Mağaza Operasyon', 'B2B Tedarik', 'B2B Finans'];

function buildNav(role: string): Array<{ id: string; label: string; icon: LucideIcon; group: string }> {
  return navItems
    .filter(n => n.roles.includes(role))
    .map(n => ({ id: n.id, label: n.label, icon: n.icon, group: n.group }));
}

function buildGroups(role: string): string[] {
  const visible = new Set(navItems.filter(n => n.roles.includes(role)).map(n => n.group));
  return GROUP_ORDER.filter(g => visible.has(g));
}

type StoreOrder = {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: string;
  type: string;
  time: string;
  created_at: string;
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
  const { stores } = useAdmin();
  const [page, setPage] = useState<FranchisePage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

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
      setPage('orders');
    }
  }, []);

  useEffect(() => {
    setB2BOrderTapHandler(handleSelectOrder);
    return () => setB2BOrderTapHandler(null);
  }, [handleSelectOrder]);

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

  const NavButton = ({ item }: { item: { id: string; label: string; icon: LucideIcon } }) => {
    const active = page === item.id;
    return (
      <Pressable
        onPress={() => {
          setPage(item.id);
          setSelectedOrderId(null);
          setSidebarOpen(false);
        }}
        className={cn(
          'w-full flex-row items-center gap-3 px-3.5 py-2.5 rounded-xl',
          active ? 'bg-ex-red' : 'bg-transparent',
        )}
      >
        <item.icon size={18} color={active ? '#fff' : '#6E6E78'} />
        <Text className={cn('text-sm font-medium', active ? 'text-white' : 'text-ink-500')}>{item.label}</Text>
      </Pressable>
    );
  };

  const roleLabel = role === 'franchise' ? 'Franchise Yetkilisi' : role === 'store_manager' ? 'Mağaza Müdürü' : 'Personel';

  return (
    <View className="flex-1 bg-cream-50 flex-row">
      {sidebarOpen && (
        <Pressable className="absolute inset-0 z-40 bg-ink-950/40" onPress={() => setSidebarOpen(false)} />
      )}

      <View className={cn(
        'absolute top-0 left-0 z-50 h-full w-64 bg-white border-r border-ink-100',
        sidebarOpen ? 'flex' : 'hidden',
      )}>
        <View className="p-5 flex-row items-center gap-2.5 border-b border-ink-100">
          <View className="h-10 w-10 rounded-xl bg-ex-red items-center justify-center shadow-red">
            <Store size={18} color="#fff" />
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-sm font-bold text-ink-900 leading-tight" numberOfLines={1}>{storeName || 'Şube Paneli'}</Text>
            <Text className="text-[10px] text-ex-red mt-0.5 font-medium tracking-wide">{roleLabel}</Text>
          </View>
          <Pressable onPress={() => setSidebarOpen(false)} className="ml-auto"><X size={20} color="#9494A0" /></Pressable>
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

        <View className="p-3 border-t border-ink-100">
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
        <View className="pt-12 pb-3 px-5 border-b border-ink-100 bg-white/90 flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            {page !== 'dashboard' && page !== 'b2b_dashboard' && (
              <Pressable
                onPress={() => { setSelectedOrderId(null); setPage(role === 'franchise' || role === 'store_manager' ? 'b2b_dashboard' : 'dashboard'); }}
                className="h-9 w-9 rounded-xl bg-ink-50 items-center justify-center active:bg-ink-100"
              >
                <ArrowLeft size={18} color="#3D3D42" />
              </Pressable>
            )}
            <Pressable onPress={() => setSidebarOpen(true)}><MenuIcon size={22} color="#3D3D42" /></Pressable>
            <View>
              <Text className="text-xl font-bold text-ink-900 leading-none">{current?.label ?? 'Panel'}</Text>
              <Text className="text-[11px] text-ink-400 mt-1" numberOfLines={1}>{storeName}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50">
            <View className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <Text className="text-xs font-medium text-green-700">Şube aktif</Text>
          </View>
        </View>

        <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
          {/* Store Operations */}
          {page === 'dashboard' && <FranchiseDashboard storeId={storeId} storeName={storeName} onGoOrders={() => setPage('orders')} />}
          {page === 'orders' && <FranchiseOrders storeId={storeId} readOnly={role === 'staff'} />}
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
          {page === 'b2b_invoices' && franchiseId && <B2BInvoices franchiseId={franchiseId} />}
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
      activeOrders: all.filter(o => o.status === 'preparing' || o.status === 'ready').length,
      readyOrders: all.filter(o => o.status === 'ready').length,
    });
    setRecent(all.slice(0, 5).map(o => ({
      id: o.order_number,
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

function FranchiseOrders({ storeId, readOnly }: { storeId: string | null; readOnly?: boolean }) {
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const load = useCallback(async () => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await fetchStoreOrders(storeId, 100);
    if (error || !data) { setLoading(false); return; }
    const all = data;
    setOrders(all.map(o => ({
      id: o.order_number,
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

  const advance = useCallback(async (orderNumber: string, currentStatus: string) => {
    const next = nextStatus(currentStatus);
    if (!next) return;
    setUpdating(orderNumber);
    const { error } = await updateOrderStatusByNumber(orderNumber, next);
    if (!error) {
      setOrders(prev => prev.map(o => o.id === orderNumber ? { ...o, status: next } : o));
    }
    setUpdating(null);
  }, []);

  const visible = filter === 'active'
    ? orders.filter(o => o.status === 'preparing' || o.status === 'ready')
    : orders;

  if (loading) return <View className="items-center justify-center py-20"><View className="h-8 w-8 rounded-full border-2 border-ex-red border-t-transparent" /></View>;

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
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
          {visible.map(o => (
            <View key={o.id} className="rounded-2xl bg-white border border-ink-100 shadow-card p-4">
              <View className="flex-row items-start gap-3">
                <View className="h-11 w-11 rounded-xl bg-ink-900 items-center justify-center shrink-0"><Coffee size={18} color="#fff" /></View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-sm font-bold text-ink-900">{o.id}</Text>
                    <View className={cn('px-2 py-0.5 rounded-full', statusBadge(o.status))}>
                      <Text className={cn('text-[10px] font-semibold', statusBadgeText(o.status))}>{statusLabel(o.status)}</Text>
                    </View>
                  </View>
                  <Text className="text-[11px] text-ink-400 mt-0.5">{o.items} ürün · {o.type} · {o.time}</Text>
                </View>
                <Text className="text-base font-bold text-ex-red">₺{o.total.toLocaleString('tr-TR')}</Text>
              </View>
              {!readOnly && (
              <View className="flex-row items-center gap-2 mt-3">
                {o.status !== 'delivered' && o.status !== 'cancelled' && o.status !== 'picked-up' && (
                  <Pressable
                    onPress={() => advance(o.id, o.status)}
                    disabled={updating === o.id}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-ex-red active:bg-ex-redDark active:scale-[0.98] disabled:opacity-40"
                  >
                    {updating === o.id
                      ? <View className="h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                      : <Text className="text-sm font-medium text-white">{nextStatus(o.status) === 'ready' ? 'Hazır olarak işaretle' : nextStatus(o.status) === 'picked-up' ? 'Teslim alındı' : 'Sıradaki adım'}</Text>}
                  </Pressable>
                )}
                {o.status === 'picked-up' && (
                  <Pressable
                    onPress={() => advance(o.id, o.status)}
                    disabled={updating === o.id}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-green-600 active:bg-green-700 active:scale-[0.98] disabled:opacity-40"
                  >
                    {updating === o.id
                      ? <View className="h-4 w-4 rounded-full border-2 border-white border-t-transparent" />
                      : <Text className="text-sm font-medium text-white">Teslim edildi olarak işaretle</Text>}
                  </Pressable>
                )}
              </View>
              )}
            </View>
          ))}
        </View>
      )}
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
    const orderId = n.data?.order_id as string | undefined;
    const source = n.data?.source as string | undefined;
    if (orderId) onOpenOrder(orderId, source);
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
          const orderId = n.data?.order_id as string | undefined;
          const isB2B = isB2BSource(n.data?.source as string | undefined);
          const badge = getNotificationBadge(n.is_read);
          return (
            <Pressable key={n.id} onPress={() => handlePress(n)} disabled={!orderId}>
              <View className={cn('rounded-2xl border shadow-card p-4', n.is_read ? 'bg-white border-ink-100' : 'bg-white border-ex-red/20', orderId && 'active:opacity-70')}>
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
                      {orderId && <View className="flex-row items-center gap-1"><View className="h-1 w-1 rounded-full bg-ink-300" /><Text className="text-[11px] text-ex-red font-medium">Siparişe Git</Text></View>}
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
