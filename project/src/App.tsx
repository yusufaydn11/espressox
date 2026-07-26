import { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, ActivityIndicator, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { Coffee, CheckCircle2, ArrowLeft } from 'lucide-react-native';
import { AppProvider, useApp } from '@/context/AppContext';
import { AdminProvider, useAdmin } from '@/context/AdminContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CustomerApp } from '@/screens/customer/CustomerApp';
import { AdminApp } from '@/screens/admin/AdminApp';
import { FranchiseApp } from '@/screens/admin/FranchiseApp';
import { AuthScreen } from '@/screens/auth/AuthScreen';
import { Toast } from '@/components/ui/Toast';
import { usePushNotifications } from '@/lib/notifications';

function AdminToast() {
  const { toast } = useAdmin();
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
  const { resetPassword } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.hostname === 'reset' || parsed.path === 'reset') {
        openSheet('account');
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url && !handledRef.current) {
        handledRef.current = true;
        handleUrl(url);
      }
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => sub.remove();
  }, [openSheet, resetPassword]);

  return null;
}

function Shell() {
  const { role, setRole } = useApp();
  const { user, loading, isAdmin, isFranchise } = useAuth();

  usePushNotifications();

  if (loading) return <LoadingScreen />;
  if (!user) return <AuthScreen />;

  if (isFranchise) {
    return (
      <AdminProvider>
        <FranchiseApp />
        <AdminToast />
      </AdminProvider>
    );
  }

  const showAdmin = role === 'admin' && isAdmin;

  return (
    <AdminProvider>
      {showAdmin ? <AdminApp /> : <CustomerApp />}
      <DeepLinkHandler />
      <Toast />
      <AdminToast />
    </AdminProvider>
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
