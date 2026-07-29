import { View, Text, Pressable } from 'react-native';
import { Bell } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useNotifications } from '@/lib/hooks';
import { Crown } from 'lucide-react';

export function CustomerHeader() {
  const { points, openSheet } = useApp();
  const { profile } = useAuth();
  const { data: notifications } = useNotifications();

  const unread = (notifications ?? []).filter(n => !n.is_read).length;

  return (
    <View className="px-5 pt-14 pb-2.5 flex-row items-center gap-2.5 bg-cream-50/90 border-b border-ink-100">
      <View className="h-9 w-9 rounded-xl bg-ex-red items-center justify-center shadow-red">
        <Text className="text-base font-extrabold text-white leading-none">X</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-bold text-ink-900 leading-none">Espresso X</Text>
        <View className="flex-row items-center gap-1 mt-1">
          <Crown size={9} color="#C8102E" />
          <Text className="text-[10px] text-ink-400 leading-none">
            {profile?.tier ?? 'Bronz'} · {points.toLocaleString('tr-TR')} puan
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => openSheet('notification-inbox')}
        className="relative h-10 w-10 rounded-xl bg-white border border-ink-100 items-center justify-center active:bg-cream-100"
        accessibilityLabel="Bildirim merkezi"
      >
        <Bell size={18} color="#525258" />
        {unread > 0 && (
          <View className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-ex-red items-center justify-center border-2 border-cream-50">
            <Text className="text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}
