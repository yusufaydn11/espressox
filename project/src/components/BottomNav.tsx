import { View, Text, Pressable } from 'react-native';
import { Home, Coffee, QrCode, Gift, User } from 'lucide-react';
import { useApp, type Tab } from '@/context/AppContext';
import { cn } from '@/lib/utils';

const tabs: { id: Tab; label: string; icon: typeof Home; a11yLabel: string }[] = [
  { id: 'home', label: 'Ana Sayfa', icon: Home, a11yLabel: 'Ana sayfa sekmesi' },
  { id: 'menu', label: 'Sipariş', icon: Coffee, a11yLabel: 'Sipariş ve menü sekmesi' },
  { id: 'qr', label: 'QR', icon: QrCode, a11yLabel: 'QR kod kartım sekmesi' },
  { id: 'campaigns', label: 'Kampanyalar', icon: Gift, a11yLabel: 'Kampanyalar ve ödüller sekmesi' },
  { id: 'profile', label: 'Profil', icon: User, a11yLabel: 'Profil ve ayarlar sekmesi' },
];

export function BottomNav() {
  const { tab, setTab } = useApp();
  return (
    <View className="absolute bottom-0 inset-x-0 z-40 pb-5 pt-2 px-4">
      <View className="flex-row items-center justify-around px-2 py-2 rounded-[1.5rem] bg-white/90 border border-ink-100 shadow-lifted">
        {tabs.map(({ id, label, icon: Icon, a11yLabel }) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={a11yLabel}
              className="flex-col items-center gap-0.5 px-3 py-1.5 active:opacity-70"
            >
              <View className={cn('h-8 w-8 items-center justify-center rounded-xl', active && 'bg-ex-red/10')}>
                <Icon
                  size={20}
                  color={active ? '#C8102E' : '#C4C4CC'}
                  strokeWidth={active ? 2.5 : 2}
                />
              </View>
              <Text className={cn('text-[9px] font-medium', active ? 'text-ex-red' : 'text-ink-400')}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
