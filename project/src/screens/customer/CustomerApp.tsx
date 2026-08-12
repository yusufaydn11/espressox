import { useEffect, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { SideNav } from '@/components/SideNav';
import { ThemeCanvas } from '@/components/customer/ThemeCanvas';
import { HomeScreen } from '@/screens/customer/HomeScreen';
import { MenuScreen } from '@/screens/customer/MenuScreen';
import { QrScreen } from '@/screens/customer/QrScreen';
import { CampaignsScreen } from '@/screens/customer/CampaignsScreen';
import { ProfileScreen } from '@/screens/customer/ProfileScreen';
import { ProductDetailSheet } from '@/screens/customer/ProductDetailSheet';
import { CartSheet, CheckoutSheet, TrackingSheet } from '@/screens/customer/OrderSheets';
import { OnboardingFlow } from '@/screens/customer/OnboardingFlow';
import { hasCompletedOnboarding } from '@/lib/onboarding';
import { RewardsSheet } from '@/screens/customer/RewardsSheet';
import { OrdersSheet } from '@/screens/customer/OrdersSheet';
import { OrderDetailSheet } from '@/screens/customer/OrderDetailSheet';
import { PromotionsSheet } from '@/screens/customer/PromotionsSheet';
import { StoresSheet } from '@/screens/customer/StoresSheet';
import { AiAssistantSheet } from '@/screens/customer/AiAssistantSheet';
import { NotificationSettingsSheet } from '@/screens/customer/NotificationSettingsSheet';
import { NotificationCenterSheet } from '@/screens/customer/NotificationCenterSheet';
import { AccountSettingsSheet } from '@/screens/customer/AccountSettingsSheet';
import { PasswordResetSheet } from '@/screens/customer/PasswordResetSheet';
import { AddressesSheet } from '@/screens/customer/AddressesSheet';

export function CustomerApp() {
  const { tab } = useApp();
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
    <View className="flex-1 flex-row bg-cream-50">
      <SideNav />

      <ThemeCanvas className="flex-1">
        {tab === 'menu' ? (
          <MenuScreen />
        ) : (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
            {tab === 'home' && <HomeScreen />}
            {tab === 'qr' && <QrScreen />}
            {tab === 'campaigns' && <CampaignsScreen />}
            {tab === 'profile' && <ProfileScreen />}
          </ScrollView>
        )}
      </ThemeCanvas>

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
      <OrderDetailSheet />
      <AddressesSheet />

      {onboardingChecked && showOnboarding && user?.id && (
        <OnboardingFlow userId={user.id} onComplete={() => setShowOnboarding(false)} />
      )}
    </View>
  );
}
