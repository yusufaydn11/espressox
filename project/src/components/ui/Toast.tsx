import { View, Text } from 'react-native';
import { useApp } from '@/context/AppContext';
import { CheckCircle2 } from 'lucide-react-native';

export function Toast() {
  const { toast } = useApp();
  if (!toast) return null;
  return (
    <View className="absolute bottom-28 left-1/2 -translate-x-1/2 z-[60]">
      <View className="flex-row items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-ink-900 shadow-premium">
        <CheckCircle2 size={18} color="#E11D38" />
        <Text className="text-sm font-medium text-white">{toast}</Text>
      </View>
    </View>
  );
}
