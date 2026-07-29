import { useState } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lock, CheckCircle2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';

export function PasswordResetScreen() {
  const { user, updatePassword, completePasswordReset } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSave = async () => {
    setError(null);
    if (password.length < 6) {
      setError('Şifre en az 6 karakter olmalı');
      return;
    }
    if (password !== confirm) {
      setError('Şifreler eşleşmiyor');
      return;
    }
    setLoading(true);
    const { error: err } = await updatePassword(password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    setDone(true);
  };

  return (
    <View className="flex-1 flex-row bg-cream-50">
      <LinearGradient
        colors={[colors.ex.red, colors.ex.redDark]}
        className="w-80 shrink-0 justify-center px-10 relative overflow-hidden"
      >
        <View className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
        <View className="relative">
          <View className="h-16 w-16 rounded-2xl bg-white/20 items-center justify-center mb-6">
            <Lock size={28} color="#fff" />
          </View>
          <Text className="text-3xl font-bold text-white font-display leading-tight">Yeni şifre</Text>
          <Text className="text-sm text-white/70 mt-3 leading-relaxed">
            Hesabın için güvenli bir şifre belirle.
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-grow justify-center px-10 py-12"
      >
        <View className="bg-white rounded-[1.75rem] p-7 shadow-premium max-w-md w-full self-center border border-cream-200">
          {done ? (
            <View className="items-center py-4">
              <View className="h-14 w-14 rounded-full bg-green-50 items-center justify-center mb-4">
                <CheckCircle2 size={26} color={colors.semantic.success} />
              </View>
              <Text className="text-xl font-bold text-ink-900 font-display">Şifre güncellendi</Text>
              <Text className="text-sm text-ink-400 mt-2 mb-6 text-center">
                Artık yeni şifrenle giriş yapabilirsin.
              </Text>
              <Pressable
                onPress={() => completePasswordReset()}
                className="flex-row items-center justify-center gap-2 py-4 px-8 rounded-full bg-ex-red shadow-red active:opacity-90"
              >
                <Text className="text-sm font-bold text-white">Uygulamaya devam et</Text>
                <ArrowRight size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <>
              <Text className="text-xl font-bold text-ink-900 font-display">Şifreni belirle</Text>
              <Text className="text-sm text-ink-400 mt-1 mb-6">
                {user?.email ?? 'Hesabın'} için yeni şifre oluştur
              </Text>
              <View className="gap-4">
                <Field label="Yeni şifre">
                  <RNTextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="En az 6 karakter"
                    placeholderTextColor={colors.ink[400]}
                    secureTextEntry
                    className="flex-1 text-sm text-ink-900"
                  />
                </Field>
                <Field label="Şifre tekrar">
                  <RNTextInput
                    value={confirm}
                    onChangeText={setConfirm}
                    placeholder="Şifrenizi tekrar girin"
                    placeholderTextColor={colors.ink[400]}
                    secureTextEntry
                    className="flex-1 text-sm text-ink-900"
                  />
                </Field>
                {error && (
                  <View className="px-3.5 py-2.5 rounded-xl bg-ex-red/5">
                    <Text className="text-xs text-ex-red">{error}</Text>
                  </View>
                )}
                <Pressable
                  onPress={handleSave}
                  disabled={loading || !password || !confirm}
                  className={cn(
                    'flex-row items-center justify-center gap-2 py-4 rounded-full bg-ex-red shadow-red active:opacity-90',
                    (loading || !password || !confirm) && 'opacity-50',
                  )}
                >
                  <Text className="text-sm font-bold text-white">
                    {loading ? 'Kaydediliyor…' : 'Şifreyi kaydet'}
                  </Text>
                  {!loading && <ArrowRight size={16} color="#fff" />}
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-medium text-ink-500 mb-1.5">{label}</Text>
      <View className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl bg-cream-50 border border-cream-200">
        <Lock size={16} color={colors.ink[400]} />
        {children}
      </View>
    </View>
  );
}
