import { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, Platform, useWindowDimensions } from 'react-native';
import {
  LayoutDashboard, TrendingUp, Users, ShoppingBag, Coffee, Megaphone, Gift,
  Bell, Tag, MapPin, UserCog, BarChart3, Menu as MenuIcon, X,
  ArrowLeft, ScanLine, Store, Smartphone,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAdmin } from '@/context/AdminContext';
import { cn } from '@/lib/utils';
import { LoadingState } from '@/components/ui/States';
import { colors } from '@shared/design/tokens';

import { AdminDashboard } from '@/screens/admin/AdminDashboard';
import { AdminSales } from '@/screens/admin/AdminSales';
import { AdminCustomers } from '@/screens/admin/AdminCustomers';
import { AdminOrders } from '@/screens/admin/AdminOrders';
import { AdminProducts } from '@/screens/admin/AdminProducts';
import { AdminCampaigns } from '@/screens/admin/AdminCampaigns';
import { AdminLoyalty } from '@/screens/admin/AdminLoyalty';
import { AdminPush } from '@/screens/admin/AdminPush';
import { AdminCoupons } from '@/screens/admin/AdminCoupons';
import { AdminStores } from '@/screens/admin/AdminStores';
import { AdminEmployees } from '@/screens/admin/AdminEmployees';
import { AdminAnalytics } from '@/screens/admin/AdminAnalytics';
import { AdminScanner } from '@/screens/admin/AdminScanner';
import { AdminFranchise } from '@/screens/admin/AdminFranchise';

type AdminPage =
  | 'dashboard' | 'sales' | 'customers' | 'orders' | 'products' | 'campaigns'
  | 'loyalty' | 'push' | 'coupons' | 'stores' | 'employees' | 'analytics' | 'scanner' | 'franchise';

const nav: { id: AdminPage; label: string; icon: typeof LayoutDashboard; group: string }[] = [
  { id: 'dashboard', label: 'Panel', icon: LayoutDashboard, group: 'Genel Bakış' },
  { id: 'scanner', label: 'QR Tara', icon: ScanLine, group: 'Genel Bakış' },
  { id: 'sales', label: 'Satışlar', icon: TrendingUp, group: 'Genel Bakış' },
  { id: 'analytics', label: 'Analitik', icon: BarChart3, group: 'Genel Bakış' },
  { id: 'orders', label: 'Siparişler', icon: ShoppingBag, group: 'Operasyonlar' },
  { id: 'products', label: 'Ürünler', icon: Coffee, group: 'Operasyonlar' },
  { id: 'stores', label: 'Mağazalar', icon: MapPin, group: 'Operasyonlar' },
  { id: 'franchise', label: 'Franchise', icon: Store, group: 'Operasyonlar' },
  { id: 'employees', label: 'Personel', icon: UserCog, group: 'Operasyonlar' },
  { id: 'customers', label: 'Müşteriler', icon: Users, group: 'CRM' },
  { id: 'campaigns', label: 'Kampanyalar', icon: Megaphone, group: 'Pazarlama' },
  { id: 'push', label: 'Bildirim', icon: Bell, group: 'Pazarlama' },
  { id: 'coupons', label: 'Kuponlar', icon: Tag, group: 'Pazarlama' },
  { id: 'loyalty', label: 'Sadakat', icon: Gift, group: 'Pazarlama' },
];

const groups = ['Genel Bakış', 'Operasyonlar', 'CRM', 'Pazarlama'];

export function AdminApp() {
  const { setPreviewAsCustomer } = useApp();
  const { loading } = useAdmin();
  const [page, setPage] = useState<AdminPage>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { width } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && width >= 1024;
  const showSidebar = isWide || sidebarOpen;

  useEffect(() => {
    if (isWide) setSidebarOpen(false);
  }, [isWide]);

  const current = nav.find(n => n.id === page)!;

  const goToCustomer = () => {
    setPreviewAsCustomer(true);
    setSidebarOpen(false);
  };

  return (
    <View className="flex-1 bg-cream-50 flex-row">
      {!isWide && sidebarOpen && (
        <Pressable className="absolute inset-0 z-40 bg-ink-950/40" onPress={() => setSidebarOpen(false)} />
      )}

      <View className={cn(
        'h-full w-72 bg-white border-r border-ink-100 flex-col shrink-0',
        isWide ? 'relative flex' : cn('absolute top-0 left-0 z-50', showSidebar ? 'flex' : 'hidden'),
      )}>
        <View className="p-5 flex-row items-center gap-2.5 border-b border-ink-100 shrink-0">
          <View className="h-10 w-10 rounded-xl bg-ex-red items-center justify-center shadow-red">
            <Text className="text-lg font-extrabold text-white leading-none">X</Text>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-base font-bold text-ink-900 leading-none">Espresso X</Text>
            <Text className="text-[10px] text-ex-red mt-1 font-medium tracking-wide">HQ Yönetim</Text>
          </View>
          {!isWide && (
            <Pressable onPress={() => setSidebarOpen(false)} hitSlop={8}>
              <X size={20} color={colors.ink[400]} />
            </Pressable>
          )}
        </View>

        <ScrollView className="flex-1 p-3" showsVerticalScrollIndicator={false}>
          {groups.map(group => (
            <View key={group} className="mb-3">
              <Text className="text-[10px] font-semibold text-ink-300 uppercase tracking-wider px-3.5 mb-1.5">{group}</Text>
              <View className="gap-1">
                {nav.filter(n => n.group === group).map(item => {
                  const active = page === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => { setPage(item.id); setSidebarOpen(false); }}
                      className={cn(
                        'flex-row items-center gap-3 px-3.5 py-2.5 rounded-xl active:opacity-90',
                        active ? 'bg-ex-red' : 'bg-transparent',
                      )}
                    >
                      <item.icon size={18} color={active ? '#fff' : colors.ink[500]} />
                      <Text className={cn('text-sm font-medium', active ? 'text-white' : 'text-ink-500')}>{item.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View className="p-3 border-t border-ink-100 shrink-0 gap-1">
          <Pressable
            onPress={goToCustomer}
            className="flex-row items-center gap-3 px-3.5 py-2.5 rounded-xl bg-ex-red/10 active:bg-ex-red/15"
          >
            <Smartphone size={18} color={colors.ex.red} />
            <Text className="text-sm font-semibold text-ex-red">Müşteriye geç</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-1 min-w-0 flex-col">
        <View className="pt-4 pb-3 px-5 border-b border-ink-100 bg-white flex-row items-center justify-between shrink-0">
          <View className="flex-row items-center gap-3 flex-1 min-w-0">
            {!isWide && (
              <Pressable
                onPress={() => setSidebarOpen(true)}
                className="h-9 w-9 rounded-xl bg-ink-50 items-center justify-center active:bg-ink-100 shrink-0"
              >
                <MenuIcon size={20} color={colors.ink[700]} />
              </Pressable>
            )}
            {page !== 'dashboard' && (
              <Pressable
                onPress={() => setPage('dashboard')}
                className="h-9 w-9 rounded-xl bg-ink-50 items-center justify-center active:bg-ink-100 shrink-0"
              >
                <ArrowLeft size={18} color={colors.ink[700]} />
              </Pressable>
            )}
            <View className="flex-1 min-w-0">
              <Text className="text-xl font-bold text-ink-900 leading-none" numberOfLines={1}>{current.label}</Text>
              <Text className="text-[11px] text-ink-400 mt-1">{current.group}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 shrink-0">
            <View className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <Text className="text-xs font-medium text-green-700">Sistem aktif</Text>
          </View>
        </View>

        <ScrollView className="flex-1 p-5" showsVerticalScrollIndicator={false}>
          {loading && page !== 'dashboard' ? (
            <LoadingState label="Veriler yükleniyor…" />
          ) : (
            <>
              {page === 'dashboard' && <AdminDashboard />}
              {page === 'sales' && <AdminSales />}
              {page === 'customers' && <AdminCustomers />}
              {page === 'orders' && <AdminOrders />}
              {page === 'products' && <AdminProducts />}
              {page === 'campaigns' && <AdminCampaigns />}
              {page === 'loyalty' && <AdminLoyalty />}
              {page === 'push' && <AdminPush />}
              {page === 'coupons' && <AdminCoupons />}
              {page === 'stores' && <AdminStores />}
              {page === 'employees' && <AdminEmployees />}
              {page === 'analytics' && <AdminAnalytics />}
              {page === 'scanner' && <AdminScanner />}
              {page === 'franchise' && <AdminFranchise />}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  );
}
