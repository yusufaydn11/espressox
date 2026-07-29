import { View, Text, Pressable } from 'react-native';
import { ChevronLeft, Bell } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useNotifications } from '@/lib/hooks';
import { colors } from '@shared/design/tokens';

const TAB_TITLES: Record<string, string> = {
  menu: 'Menü',
  qr: 'QR Kartım',
  campaigns: 'Kampanyalar',
  profile: 'Profil',
};

interface CustomerHeaderProps {
  tab: string;
}

export function CustomerHeader({ tab }: CustomerHeaderProps) {
  const { setTab, openSheet } = useApp();
  const { data: notifications } = useNotifications();
  const unread = (notifications ?? []).filter(n => !n.is_read).length;
  const title = TAB_TITLES[tab];

  if (!title) return null;

  return (
    <View className="bg-cream-50">
      <View className="px-5 pt-14 pb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3 flex-1">
          <Pressable
            onPress={() => setTab('home')}
            className="h-9 w-9 rounded-full bg-white shadow-soft items-center justify-center active:scale-95"
          >
            <ChevronLeft size={20} color={colors.ink[600]} />
          </Pressable>
          <Text className="text-xl font-bold text-ink-900 font-display">{title}</Text>
        </View>
        <Pressable
          onPress={() => openSheet('notification-inbox')}
          className="relative h-9 w-9 rounded-full bg-white shadow-soft items-center justify-center active:scale-95"
        >
          <Bell size={17} color={colors.ink[500]} />
          {unread > 0 && (
            <View className="absolute top-0 right-0 h-2 w-2 rounded-full bg-ex-red border border-white" />
          )}
        </Pressable>
      </View>
    </View>
  );
}
