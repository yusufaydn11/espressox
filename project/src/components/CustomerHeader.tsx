import { View, Text } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Crown } from 'lucide-react';

export function CustomerHeader() {
  const { points } = useApp();
  const { profile } = useAuth();

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
    </View>
  );
}
