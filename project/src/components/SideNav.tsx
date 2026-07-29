import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Home, Coffee, QrCode, Gift, User, Bell, Crown, ShoppingBag, Sparkles,
} from 'lucide-react';
import { useApp, type Tab } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/lib/hooks';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';
import { formatPrice } from '@/lib/utils';

const NAV: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Ana Sayfa', icon: Home },
  { id: 'menu', label: 'Menü & Sipariş', icon: Coffee },
  { id: 'qr', label: 'QR Kartım', icon: QrCode },
  { id: 'campaigns', label: 'Kampanyalar', icon: Gift },
  { id: 'profile', label: 'Profilim', icon: User },
];

export function SideNav() {
  const { tab, setTab, points, openSheet, cartCount, cartTotal } = useApp();
  const { profile } = useAuth();
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter(n => !n.is_read).length;

  return (
    <View className="w-64 shrink-0 bg-white border-r border-cream-200 h-full flex-col shadow-soft">
      {/* Logo */}
      <LinearGradient
        colors={['#FFFFFF', colors.cream[50]]}
        className="px-5 pt-8 pb-6 border-b border-cream-100"
      >
        <View className="flex-row items-center gap-3">
          <LinearGradient
            colors={[colors.ex.red, colors.ex.redDark]}
            className="h-12 w-12 rounded-2xl items-center justify-center shadow-red"
          >
            <Text className="text-lg font-extrabold text-white font-display">X</Text>
          </LinearGradient>
          <View>
            <Text className="text-lg font-bold text-ink-900 font-display leading-tight">Espresso X</Text>
            <View className="flex-row items-center gap-1 mt-0.5">
              <Sparkles size={9} color={colors.ex.red} />
              <Text className="text-[10px] text-ink-400 tracking-widest uppercase">Sadakat Programı</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Navigasyon */}
      <View className="flex-1 py-5 px-3 gap-1">
        <Text className="px-3 text-[11px] font-bold text-ink-400 uppercase tracking-widest mb-2">Menü</Text>
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              className={cn(
                'flex-row items-center gap-3 px-2 py-2.5 rounded-xl active:opacity-80',
                active ? 'bg-ex-red/8' : 'bg-transparent',
              )}
            >
              <View className={cn(
                'w-1 h-7 rounded-full ml-0.5',
                active ? 'bg-ex-red' : 'bg-transparent',
              )} />
              <View className={cn(
                'h-9 w-9 rounded-xl items-center justify-center',
                active ? 'bg-ex-red shadow-red' : 'bg-cream-50',
              )}>
                <Icon size={17} color={active ? '#fff' : colors.ink[500]} strokeWidth={active ? 2.5 : 2} />
              </View>
              <Text className={cn(
                'text-sm flex-1',
                active ? 'font-bold text-ex-red' : 'font-medium text-ink-600',
              )}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Alt bölüm */}
      <View className="px-3 pb-6 pt-3 border-t border-cream-100 gap-2.5">
        {cartCount > 0 && (
          <Pressable
            onPress={() => openSheet('cart')}
            className="overflow-hidden rounded-2xl active:opacity-90"
          >
            <LinearGradient
              colors={[colors.ink[900], colors.ink[800]]}
              className="flex-row items-center gap-3 px-4 py-3.5"
            >
              <View className="h-9 w-9 rounded-xl bg-ex-red items-center justify-center">
                <ShoppingBag size={16} color="#fff" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-bold text-white">{cartCount} ürün sepette</Text>
                <Text className="text-xs text-white/60">{formatPrice(cartTotal)}</Text>
              </View>
              <Text className="text-xs font-bold text-ex-redLight">Gör →</Text>
            </LinearGradient>
          </Pressable>
        )}

        <Pressable
          onPress={() => openSheet('notification-inbox')}
          className="flex-row items-center gap-3 px-3 py-3 rounded-xl bg-cream-50 border border-cream-200 active:bg-cream-100"
        >
          <View className="relative h-9 w-9 rounded-xl bg-white items-center justify-center">
            <Bell size={17} color={colors.ink[500]} />
            {unread > 0 && (
              <View className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-ex-red border-2 border-white" />
            )}
          </View>
          <Text className="text-sm font-medium text-ink-600 flex-1">Bildirimler</Text>
          {unread > 0 && (
            <View className="min-w-[22px] h-5 px-1.5 rounded-full bg-ex-red items-center justify-center">
              <Text className="text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </Pressable>

        <LinearGradient
          colors={[colors.ex.red, colors.ex.redDark]}
          className="rounded-2xl p-4 shadow-red overflow-hidden"
        >
          <View className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/10" />
          <View className="flex-row items-center gap-1.5 mb-2">
            <Crown size={12} color="#fff" fill="#fff" />
            <Text className="text-[10px] font-bold text-white/90 uppercase tracking-widest">{profile?.tier ?? 'Bronz'} Üye</Text>
          </View>
          <Text className="text-3xl font-bold text-white font-display leading-none">{points.toLocaleString('tr-TR')}</Text>
          <Text className="text-xs text-white/70 mt-1">sadakat puanın</Text>
        </LinearGradient>
      </View>
    </View>
  );
}
