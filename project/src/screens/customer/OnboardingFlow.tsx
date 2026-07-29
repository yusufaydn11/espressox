import { useState, useCallback } from 'react';
import { View, Text, Pressable, Modal, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { Coffee, Crown, Bell, MapPin, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { markOnboardingComplete } from '@/lib/onboarding';
import { saveExpoPushToken } from '@/services/notifications';
import * as Constants from 'expo-constants';

const STEPS = [
  {
    id: 'brand',
    icon: Coffee,
    title: 'Espresso X\'e hoş geldin',
    body: 'Türkiye\'nin premium kahve deneyimi. Her yudumda kalite, her siparişte sadakat.',
  },
  {
    id: 'loyalty',
    icon: Crown,
    title: 'Sadakat kartın hazır',
    body: 'Sipariş ver, puan kazan. Damga kartını doldur, ödülleri kullan. Seviye atladıkça ayrıcalıklar artar.',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Siparişini kaçırma',
    body: 'Sipariş hazır olduğunda ve kampanyalarda anında haberdar ol.',
  },
  {
    id: 'location',
    icon: MapPin,
    title: 'Yakındaki mağazalar',
    body: 'Konum izni ile en yakın Espresso X şubesini bul, hızlıca sipariş ver.',
  },
] as const;

interface OnboardingFlowProps {
  userId: string;
  onComplete: () => void;
}

export function OnboardingFlow({ userId, onComplete }: OnboardingFlowProps) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  const finish = useCallback(async () => {
    await markOnboardingComplete(userId);
    onComplete();
  }, [userId, onComplete]);

  const requestNotifications = async () => {
    if (Platform.OS === 'web') return;
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus === 'granted') {
      try {
        const token = (
          await Notifications.getExpoPushTokenAsync({
            projectId: Constants.default.expoConfig?.extra?.eas?.projectId as string | undefined,
          })
        ).data;
        if (token) await saveExpoPushToken(userId, token);
      } catch {
        // Token registration is best-effort during onboarding
      }
    }
  };

  const requestLocation = async () => {
    if (Platform.OS === 'web') return;
    await Location.requestForegroundPermissionsAsync();
  };

  const handleNext = async () => {
    setBusy(true);
    try {
      if (current.id === 'notifications') await requestNotifications();
      if (current.id === 'location') await requestLocation();
      if (isLast) {
        await finish();
      } else {
        setStep(s => s + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSkip = async () => {
    if (isLast) {
      await finish();
      return;
    }
    setStep(s => s + 1);
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <LinearGradient colors={['#FAF9F6', '#F5F3EF']} className="flex-1">
        <View className="flex-1 px-6 pt-16 pb-10 justify-between">
          <View>
            <View className="flex-row items-center gap-2 mb-10">
              <View className="h-10 w-10 rounded-xl bg-ex-red items-center justify-center shadow-red">
                <Text className="text-lg font-extrabold text-white">X</Text>
              </View>
              <Text className="text-lg font-bold text-ink-900">Espresso X</Text>
              <View className="ml-auto flex-row gap-1.5">
                {STEPS.map((_, i) => (
                  <View
                    key={i}
                    className="h-1.5 rounded-full"
                    style={{
                      width: i === step ? 20 : 8,
                      backgroundColor: i <= step ? '#C8102E' : '#E0E0E4',
                    }}
                  />
                ))}
              </View>
            </View>

            <View className="h-20 w-20 rounded-3xl bg-ex-red/10 items-center justify-center mb-6">
              <Icon size={36} color="#C8102E" />
            </View>
            <Text className="text-3xl font-bold text-ink-900 font-display leading-tight">
              {current.title}
            </Text>
            <Text className="text-base text-ink-500 mt-3 leading-relaxed">{current.body}</Text>

            {current.id === 'loyalty' && (
              <View className="mt-6 p-4 rounded-2xl bg-white border border-ink-100 shadow-card">
                <View className="flex-row items-center gap-2">
                  <Sparkles size={16} color="#C8102E" />
                  <Text className="text-sm font-semibold text-ink-900">Her ₺100 = 20 puan</Text>
                </View>
                <Text className="text-xs text-ink-400 mt-1">5 damga = ücretsiz içecek ödülü</Text>
              </View>
            )}
          </View>

          <View className="gap-3">
            <Button variant="primary" size="lg" full onPress={handleNext} disabled={busy}>
              {isLast ? 'Başla' : current.id === 'notifications' || current.id === 'location' ? 'İzin ver ve devam' : 'Devam'}
              {!isLast && <ChevronRight size={18} color="#fff" />}
            </Button>
            {(current.id === 'notifications' || current.id === 'location') && (
              <Pressable onPress={handleSkip} className="py-3 items-center active:opacity-60">
                <Text className="text-sm font-medium text-ink-500">Şimdilik atla</Text>
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>
    </Modal>
  );
}
