import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { CheckCircle2 } from 'lucide-react';
import { AppProvider, useApp } from '@/context/AppContext';
import { AdminPreviewBanner } from '@/components/AdminPreviewBanner';
import { MaintenanceScreen } from '@/components/SystemScreens';
import { AdminProvider } from '@/context/AdminContext';
import { AdminToastProvider, useAdminToast } from '@/context/AdminToastContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CustomerApp } from '@/screens/customer/CustomerApp';
import { AdminApp } from '@/screens/admin/AdminApp';
import { FranchiseApp } from '@/screens/admin/FranchiseApp';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import { PasswordResetScreen } from '@/screens/auth/PasswordResetScreen';
import { EmailVerificationScreen } from '@/screens/auth/EmailVerificationScreen';
import { Toast } from '@/components/ui/Toast';
import { PasswordResetSheet } from '@/screens/customer/PasswordResetSheet';
import { supabase } from '@/lib/supabase';
import { applyRecoveryHash } from '@/lib/authRedirect';
import { usePushNotifications } from '@/lib/notifications';
import { colors } from '@shared/design/tokens';

function AdminToast() {
  const { toast } = useAdminToast();
  if (!toast) return null;
  return (
    <View className="absolute bottom-24 left-0 right-0 items-center z-[80]">
      <View className="flex-row items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-ink-900 shadow-premium">
        <CheckCircle2 size={18} color="#E11D38" />
        <Text className="text-sm font-medium text-white">{toast}</Text>
      </View>
    </View>
  );
}

function LoadingScreen() {
  return (
    <View className="flex-1 bg-cream-50 items-center justify-center">
      <View className="items-center">
        <View className="h-16 w-16 rounded-2xl bg-ex-red items-center justify-center shadow-red mb-4">
          <Text className="text-2xl font-extrabold text-white font-display">X</Text>
        </View>
        <ActivityIndicator size="small" color={colors.ex.red} />
        <Text className="text-sm text-ink-400 mt-3">Espresso X yükleniyor…</Text>
      </View>
    </View>
  );
}

/** Mobil deep link ile gelen recovery URL'lerini işler */
function MobileRecoveryHandler() {
  const { pendingPasswordReset } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleUrl = async (url: string) => {
      if (!url.includes('access_token') && !url.includes('reset')) return;
      const hash = url.includes('#') ? url.split('#')[1] ?? '' : '';
      if (!hash.includes('access_token')) return;
      const ok = await applyRecoveryHash(hash, async (accessToken, refreshToken) => {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      });
      if (ok) handledRef.current = true;
    };

    Linking.getInitialURL().then(url => {
      if (url && !handledRef.current) void handleUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => void handleUrl(url));
    return () => sub.remove();
  }, [pendingPasswordReset]);

  return null;
}

function PasswordResetOverlay() {
  return <PasswordResetSheet />;
}

function Shell() {
  const { user, loading, isAdmin, isFranchise, isStoreManager, isStaff, profile, pendingPasswordReset, isInternal } = useAuth();
  const { previewAsCustomer } = useApp();

  usePushNotifications();

  if ((process.env as Record<string, string | undefined>).EXPO_PUBLIC_MAINTENANCE_MODE === 'true') {
    return <MaintenanceScreen />;
  }

  if (loading) return <LoadingScreen />;

  // E-posta linkinden gelen şifre sıfırlama — giriş ekranına atma
  if (pendingPasswordReset && user) {
    return (
      <>
        <PasswordResetScreen />
        <Toast />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        <MobileRecoveryHandler />
        <Toast />
      </>
    );
  }

  if (profile?.is_blocked) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-xl font-bold text-ink-900 text-center">Hesap Engellendi</Text>
        <Text className="text-sm text-ink-500 mt-2 text-center">Hesabınız askıya alınmıştır. Destek ekibiyle iletişime geçin.</Text>
      </View>
    );
  }

  const requireEmailVerify = (process.env as Record<string, string | undefined>).EXPO_PUBLIC_REQUIRE_EMAIL_VERIFY === 'true';
  const emailConfirmed = user.email_confirmed_at ?? user.confirmed_at;
  if (requireEmailVerify && !emailConfirmed) {
    return (
      <>
        <EmailVerificationScreen />
        <Toast />
      </>
    );
  }

  // Admin/franchise → müşteri önizleme
  if (isInternal && previewAsCustomer) {
    return (
      <AdminToastProvider>
        <View className="flex-1 flex-col">
          <AdminPreviewBanner />
          <CustomerApp />
        </View>
        <MobileRecoveryHandler />
        <PasswordResetOverlay />
        <Toast />
        <AdminToast />
      </AdminToastProvider>
    );
  }

  if (isFranchise || isStoreManager || isStaff) {
    return (
      <AdminToastProvider>
        <AdminProvider>
          <MobileRecoveryHandler />
          <FranchiseApp />
          <AdminToast />
          <PasswordResetOverlay />
        </AdminProvider>
      </AdminToastProvider>
    );
  }

  if (isAdmin) {
    return (
      <AdminToastProvider>
        <AdminProvider>
          <MobileRecoveryHandler />
          <AdminApp />
          <AdminToast />
          <PasswordResetOverlay />
        </AdminProvider>
      </AdminToastProvider>
    );
  }

  return (
    <AdminToastProvider>
      <CustomerApp />
      <MobileRecoveryHandler />
      <PasswordResetOverlay />
      <Toast />
      <AdminToast />
    </AdminToastProvider>
  );
}

export default function App() {
  return (
    <>
      <StatusBar style="dark" />
      <AuthProvider>
        <AppProvider>
          <Shell />
        </AppProvider>
      </AuthProvider>
    </>
  );
}
