import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { ShoppingBag } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { formatPrice } from '@/lib/utils';
import { CustomerHeader } from '@/components/CustomerHeader';
import { BottomNav } from '@/components/BottomNav';
import { HomeScreen } from '@/screens/customer/HomeScreen';
import { MenuScreen } from '@/screens/customer/MenuScreen';
import { QrScreen } from '@/screens/customer/QrScreen';
import { CampaignsScreen } from '@/screens/customer/CampaignsScreen';
import { ProfileScreen } from '@/screens/customer/ProfileScreen';
import { RewardsSheet } from '@/screens/customer/RewardsSheet';
import { OrdersSheet } from '@/screens/customer/OrdersSheet';
import { ProductDetailSheet } from '@/screens/customer/ProductDetailSheet';
import { CartSheet, CheckoutSheet, TrackingSheet } from '@/screens/customer/OrderSheets';
import { PromotionsSheet } from '@/screens/customer/PromotionsSheet';
import { StoresSheet } from '@/screens/customer/StoresSheet';
import { AiAssistantSheet } from '@/screens/customer/AiAssistantSheet';
import { NotificationSettingsSheet } from '@/screens/customer/NotificationSettingsSheet';
import { NotificationCenterSheet } from '@/screens/customer/NotificationCenterSheet';
import { AccountSettingsSheet } from '@/screens/customer/AccountSettingsSheet';
import { PasswordResetSheet } from '@/screens/customer/PasswordResetSheet';
import { OnboardingFlow } from '@/screens/customer/OnboardingFlow';
import { hasCompletedOnboarding } from '@/lib/onboarding';

export function CustomerApp() {
  const { tab, cartCount, cartTotal, openSheet } = useApp();
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    void hasCompletedOnboarding(user.id).then(done => {
      setShowOnboarding(!done);
      setOnboardingChecked(true);
    });
  }, [user?.id]);

  return (
    <View className="flex-1 bg-cream-50">
      <CustomerHeader />
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-32">
        {tab === 'home' && <HomeScreen />}
        {tab === 'menu' && <MenuScreen />}
        {tab === 'qr' && <QrScreen />}
        {tab === 'campaigns' && <CampaignsScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </ScrollView>

      {cartCount > 0 && tab !== 'menu' && (
        <Pressable
          onPress={() => openSheet('cart')}
          className="absolute bottom-24 inset-x-5 z-30"
        >
          <View className="flex-row items-center justify-between px-5 py-3.5 rounded-2xl bg-ink-900 shadow-premium">
            <View className="flex-row items-center gap-3">
              <View className="relative h-9 w-9 rounded-xl bg-ex-red items-center justify-center">
                <ShoppingBag size={17} color="#fff" />
                <View className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 items-center justify-center rounded-full bg-white">
                  <Text className="text-ex-red text-[9px] font-bold">{cartCount}</Text>
                </View>
              </View>
              <View>
                <Text className="text-sm font-semibold text-white leading-none">Siparişi gör</Text>
                <Text className="text-[11px] text-ink-300 mt-0.5">{cartCount} ürün · {formatPrice(cartTotal)}</Text>
              </View>
            </View>
            <Text className="text-sm font-semibold text-ex-redLight">Ödemeye geç →</Text>
          </View>
        </Pressable>
      )}

      <BottomNav />

      <ProductDetailSheet />
      <CartSheet />
      <CheckoutSheet />
      <TrackingSheet />
      <PromotionsSheet />
      <StoresSheet />
      <AiAssistantSheet />
      <NotificationSettingsSheet />
      <NotificationCenterSheet />
      <AccountSettingsSheet />
      <PasswordResetSheet />
      <RewardsSheet />
      <OrdersSheet />

      {onboardingChecked && showOnboarding && user?.id && (
        <OnboardingFlow
          userId={user.id}
          onComplete={() => setShowOnboarding(false)}
        />
      )}
    </View>
  );
}
