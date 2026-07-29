import { View, Text, Pressable } from 'react-native';
import { Mail, RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { colors } from '@shared/design/tokens';

export function EmailVerificationScreen() {
  const { user } = useAuth();

  const resend = async () => {
    if (!user?.email) return;
    await supabase.auth.resend({ type: 'signup', email: user.email });
  };

  return (
    <View className="flex-1 bg-cream-50 items-center justify-center p-6">
      <View className="h-16 w-16 rounded-2xl bg-ex-red/10 items-center justify-center mb-4">
        <Mail size={28} color={colors.ex.red} />
      </View>
      <Text className="text-xl font-bold text-ink-900 text-center">E-postanı doğrula</Text>
      <Text className="text-sm text-ink-500 mt-2 text-center leading-relaxed max-w-sm">
        {user?.email ?? 'E-posta adresine'} gönderilen doğrulama linkine tıkla. Doğrulama sonrası uygulamayı yenile.
      </Text>
      <View className="mt-6 gap-3 w-full max-w-xs">
        <Button variant="gold" full onPress={() => { if (typeof window !== 'undefined') window.location.reload(); }}>
          Yenile
        </Button>
        <Pressable onPress={() => void resend()} className="flex-row items-center justify-center gap-2 py-3">
          <RefreshCw size={14} color={colors.ex.red} />
          <Text className="text-sm font-semibold text-ex-red">Doğrulama e-postasını tekrar gönder</Text>
        </Pressable>
      </View>
    </View>
  );
}
