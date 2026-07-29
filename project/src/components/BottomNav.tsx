import { View, Text, Pressable } from 'react-native';
import { Home, Coffee, QrCode, Gift, User } from 'lucide-react';
import { useApp, type Tab } from '@/context/AppContext';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';

const tabs: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Ana Sayfa', icon: Home },
  { id: 'menu', label: 'Menü', icon: Coffee },
  { id: 'qr', label: 'QR', icon: QrCode },
  { id: 'campaigns', label: 'Fırsat', icon: Gift },
  { id: 'profile', label: 'Profil', icon: User },
];

export function BottomNav() {
  const { tab, setTab } = useApp();

  return (
    <View className="absolute bottom-0 inset-x-0 z-40 pb-6 px-5">
      <View className="flex-row items-center justify-between bg-white/95 rounded-full px-2 py-2 shadow-lifted border border-cream-200">
        {tabs.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          const isQr = id === 'qr';
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              className={cn('items-center flex-1 py-1 active:opacity-70', isQr && '-mt-5')}
            >
              {isQr ? (
                <View className={cn(
                  'h-12 w-12 rounded-full items-center justify-center shadow-red mb-0.5',
                  active ? 'bg-ex-red' : 'bg-red-gradient',
                )}>
                  <Icon size={22} color="#fff" strokeWidth={2.5} />
                </View>
              ) : (
                <View className={cn(
                  'h-9 w-9 rounded-full items-center justify-center mb-0.5',
                  active && 'bg-ex-red/10',
                )}>
                  <Icon size={20} color={active ? colors.ex.red : colors.ink[400]} strokeWidth={active ? 2.5 : 2} />
                </View>
              )}
              <Text className={cn(
                'text-[9px] font-medium',
                active ? 'text-ex-red font-semibold' : 'text-ink-400',
              )}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
