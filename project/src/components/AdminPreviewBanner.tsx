import { View, Text, Pressable, Platform } from 'react-native';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

/** Admin/franchise kullanıcı müşteri modundayken üst banner */
export function AdminPreviewBanner() {
  const { previewAsCustomer, setPreviewAsCustomer } = useApp();
  const { isInternal } = useAuth();

  if (!previewAsCustomer || !isInternal) return null;

  return (
    <View className="bg-ink-900 px-5 py-2.5 flex-row items-center justify-between shrink-0">
      <Text className="text-sm text-white/90">Müşteri uygulaması önizlemesi</Text>
      <Pressable
        onPress={() => setPreviewAsCustomer(false)}
        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 active:bg-white/20"
      >
        <ArrowLeft size={14} color="#fff" />
        <Text className="text-xs font-bold text-white">Panele dön</Text>
      </Pressable>
    </View>
  );
}

/** Web'de geniş ekran mı */
export function useIsWideWeb(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
}
