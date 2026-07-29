import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator } from 'react-native';
import * as Linking from 'expo-linking';
import { Coffee, CheckCircle2 } from 'lucide-react';
import { AppProvider, useApp } from '@/context/AppContext';
import { AdminProvider } from '@/context/AdminContext';
import { AdminToastProvider, useAdminToast } from '@/context/AdminToastContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CustomerApp } from '@/screens/customer/CustomerApp';
import { AdminApp } from '@/screens/admin/AdminApp';
import { FranchiseApp } from '@/screens/admin/FranchiseApp';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import { Toast } from '@/components/ui/Toast';
import { PasswordResetSheet } from '@/screens/customer/PasswordResetSheet';
import { supabase } from '@/lib/supabase';
import { usePushNotifications } from '@/lib/notifications';

function AdminToast() {
  const { toast } = useAdminToast();
  if (!toast) return null;
  return (
    <View className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[80]">
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
        <View className="h-16 w-16 rounded-2xl bg-ex-red items-center justify-center shadow-red mb-3">
          <Coffee size={28} color="#fff" />
        </View>
        <View className="flex-row items-center gap-2">
          <ActivityIndicator size="small" color="#9494A0" />
          <Text className="text-sm text-ink-400">Yükleniyor…</Text>
        </View>
      </View>
    </View>
  );
}

function DeepLinkHandler() {
  const { openSheet } = useApp();
  const handledRef = useRef(false);

  useEffect(() => {
    const handleUrl = async (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.hostname !== 'reset' && parsed.path !== 'reset') return;

      const hash = url.includes('#') ? url.split('#')[1] : '';
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
      openSheet('reset-password');
    };

    Linking.getInitialURL().then((url) => {
      if (url && !handledRef.current) {
        handledRef.current = true;
        void handleUrl(url);
      }
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      void handleUrl(url);
    });

    return () => sub.remove();
  }, [openSheet]);

  return null;
}

function PasswordResetOverlay() {
  return <PasswordResetSheet />;
}

function Shell() {
  const { user, loading, isAdmin, isFranchise, isStoreManager, isStaff, profile } = useAuth();

  usePushNotifications();

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  if (profile?.is_blocked) {
    return (
      <View className="flex-1 bg-cream-50 items-center justify-center p-6">
        <Text className="text-xl font-bold text-ink-900 text-center">Hesap Engellendi</Text>
        <Text className="text-sm text-ink-500 mt-2 text-center">Hesabınız askıya alınmıştır. Destek ekibiyle iletişime geçin.</Text>
      </View>
    );
  }

  if (isFranchise || isStoreManager || isStaff) {
    return (
      <AdminToastProvider>
        <AdminProvider>
          <DeepLinkHandler />
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
          <DeepLinkHandler />
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
      <DeepLinkHandler />
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
