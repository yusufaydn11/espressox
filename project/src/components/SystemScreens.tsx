import { View, Text } from 'react-native';
import { Coffee, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export function MaintenanceScreen() {
  return (
    <View className="flex-1 bg-cream-50 items-center justify-center p-8">
      <View className="h-16 w-16 rounded-2xl bg-ink-100 items-center justify-center mb-4">
        <Wrench size={28} color="#6E6E78" />
      </View>
      <Text className="text-xl font-bold text-ink-900 text-center font-display">Bakım Modu</Text>
      <Text className="text-sm text-ink-500 mt-2 text-center max-w-sm leading-relaxed">
        Espresso X kısa süreliğine bakımda. En kısa sürede tekrar hizmetinizdeyiz.
      </Text>
    </View>
  );
}

export function NotFoundScreen({ onGoHome }: { onGoHome: () => void }) {
  return (
    <View className="flex-1 bg-cream-50 items-center justify-center p-8">
      <View className="h-16 w-16 rounded-2xl bg-ex-red/10 items-center justify-center mb-4">
        <Coffee size={28} color="#C8102E" />
      </View>
      <Text className="text-xl font-bold text-ink-900 text-center font-display">Sayfa Bulunamadı</Text>
      <Text className="text-sm text-ink-500 mt-2 text-center max-w-sm">
        Aradığınız ekran mevcut değil veya taşınmış olabilir.
      </Text>
      <Button variant="gold" className="mt-6" onPress={onGoHome}>Ana Sayfaya Dön</Button>
    </View>
  );
}
