import { useEffect, useState, lazy, Suspense } from 'react';
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

const RewardsSheet = lazy(() => import('@/screens/customer/RewardsSheet').then(m => ({ default: m.RewardsSheet })));
const OrdersSheet = lazy(() => import('@/screens/customer/OrdersSheet').then(m => ({ default: m.OrdersSheet })));
const OrderDetailSheet = lazy(() => import('@/screens/customer/OrderDetailSheet').then(m => ({ default: m.OrderDetailSheet })));
const PromotionsSheet = lazy(() => import('@/screens/customer/PromotionsSheet').then(m => ({ default: m.PromotionsSheet })));
const StoresSheet = lazy(() => import('@/screens/customer/StoresSheet').then(m => ({ default: m.StoresSheet })));
const AiAssistantSheet = lazy(() => import('@/screens/customer/AiAssistantSheet').then(m => ({ default: m.AiAssistantSheet })));
const NotificationSettingsSheet = lazy(() => import('@/screens/customer/NotificationSettingsSheet').then(m => ({ default: m.NotificationSettingsSheet })));
const NotificationCenterSheet = lazy(() => import('@/screens/customer/NotificationCenterSheet').then(m => ({ default: m.NotificationCenterSheet })));
const AccountSettingsSheet = lazy(() => import('@/screens/customer/AccountSettingsSheet').then(m => ({ default: m.AccountSettingsSheet })));
const PasswordResetSheet = lazy(() => import('@/screens/customer/PasswordResetSheet').then(m => ({ default: m.PasswordResetSheet })));
const AddressesSheet = lazy(() => import('@/screens/customer/AddressesSheet').then(m => ({ default: m.AddressesSheet })));

function LazySheet({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

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
      <LazySheet><PromotionsSheet /></LazySheet>
      <LazySheet><StoresSheet /></LazySheet>
      <LazySheet><AiAssistantSheet /></LazySheet>
      <LazySheet><NotificationSettingsSheet /></LazySheet>
      <LazySheet><NotificationCenterSheet /></LazySheet>
      <LazySheet><AccountSettingsSheet /></LazySheet>
      <LazySheet><PasswordResetSheet /></LazySheet>
      <LazySheet><RewardsSheet /></LazySheet>
      <LazySheet><OrdersSheet /></LazySheet>
      <LazySheet><OrderDetailSheet /></LazySheet>
      <LazySheet><AddressesSheet /></LazySheet>

      {onboardingChecked && showOnboarding && user?.id && (
        <OnboardingFlow userId={user.id} onComplete={() => setShowOnboarding(false)} />
      )}
    </View>
  );
}
