import { useState } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Coffee, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'signup' | 'forgot' | 'sent';

export function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else if (mode === 'signup') {
      if (password.length < 6) {
        setError('Şifre en az 6 karakter olmalı');
        setLoading(false);
        return;
      }
      const { error } = await signUp(email, password, fullName);
      if (error) setError(error);
      else setMode('sent');
    } else if (mode === 'forgot') {
      const { error } = await resetPassword(email);
      if (error) setError(error);
      else setMode('sent');
    }
    setLoading(false);
  };

  const titles: Record<Mode, string> = {
    login: 'Tekrar hoş geldin',
    signup: 'Aramıza katıl',
    forgot: 'Şifreni sıfırla',
    sent: 'E-postanı kontrol et',
  };
  const subtitles: Record<Mode, string> = {
    login: 'Kahveni hazırlamak için giriş yap',
    signup: 'İlk yudumdan itibaren puan kazanmaya başla',
    forgot: 'Şifre sıfırlama bağlantısı göndereceğiz',
    sent: 'Gelen kutunu kontrol et — bağlantı gönderildi',
  };

  return (
    <View className="flex-1 bg-cream-50">
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="flex-1"
      >
        <View className="relative h-48 overflow-hidden bg-ink-900">
          <View className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-ex-red opacity-15" />
          <View className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-ex-red opacity-10" />
          <View className="flex-1 items-center justify-center pt-10">
            <View className="items-center">
              <View className="h-16 w-16 rounded-2xl bg-ex-red items-center justify-center shadow-red mb-2">
                <Coffee size={28} color="#fff" />
              </View>
              <Text className="text-2xl font-bold text-white">Espresso X</Text>
              <Text className="text-[11px] text-ink-300 mt-0.5 tracking-widest uppercase">Kahvenin Sanatı</Text>
            </View>
          </View>
        </View>

        <View className="flex-1 px-5 pt-8 pb-8">
          <View className="w-full max-w-sm self-center">
            <Text className="text-2xl font-bold text-ink-900">{titles[mode]}</Text>
            <Text className="text-sm text-ink-400 mt-1 mb-6">{subtitles[mode]}</Text>

            {mode === 'sent' ? (
              <View className="items-center py-8">
                <View className="h-16 w-16 rounded-2xl bg-green-50 items-center justify-center mb-4">
                  <CheckCircle2 size={28} color="#16a34a" />
                </View>
                <Text className="text-sm text-ink-500 mb-5 text-center">
                  {email} adresine bir bağlantı gönderdik. E-postanı kontrol edip şifreni sıfırla.
                </Text>
                <Pressable
                  onPress={() => { setMode('login'); setEmail(''); }}
                  className="flex-row items-center gap-2"
                >
                  <ArrowLeft size={16} color="#C8102E" />
                  <Text className="text-sm font-medium text-ex-red">Giriş ekranına dön</Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-3.5">
                {mode === 'signup' && (
                  <Field icon={User} label="Ad Soyad">
                    <RNTextInput
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Adın Soyadın"
                      placeholderTextColor="#9494A0"
                      className="flex-1 text-sm text-ink-900"
                    />
                  </Field>
                )}

                <Field icon={Mail} label="E-posta">
                  <RNTextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="ornek@email.com"
                    placeholderTextColor="#9494A0"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    className="flex-1 text-sm text-ink-900"
                  />
                </Field>

                {mode !== 'forgot' && (
                  <Field icon={Lock} label="Şifre">
                    <RNTextInput
                      value={password}
                      onChangeText={setPassword}
                      placeholder="••••••••"
                      placeholderTextColor="#9494A0"
                      secureTextEntry={!showPass}
                      className="flex-1 text-sm text-ink-900"
                    />
                    <Pressable onPress={() => setShowPass(s => !s)} hitSlop={8} accessibilityRole="button" accessibilityLabel={showPass ? 'Şifreyi gizle' : 'Şifreyi göster'}>
                      {showPass ? <EyeOff size={16} color="#9494A0" /> : <Eye size={16} color="#9494A0" />}
                    </Pressable>
                  </Field>
                )}

                {error && (
                  <View className="px-3.5 py-2.5 rounded-xl bg-red-50 border border-ex-red/20">
                    <Text className="text-xs text-ex-red">{error}</Text>
                  </View>
                )}

                {mode === 'login' && (
                  <Pressable onPress={() => { setMode('forgot'); setError(null); }}>
                    <Text className="text-xs text-ink-400">Şifremi unuttum</Text>
                  </Pressable>
                )}

                <Pressable
                  onPress={handleSubmit}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityLabel={mode === 'login' ? 'Giriş yap' : mode === 'signup' ? 'Hesap oluştur' : 'Sıfırlama bağlantısı gönder'}
                  accessibilityState={{ disabled: loading }}
                  className={cn(
                    'flex-row items-center justify-center gap-2 py-3.5 rounded-2xl bg-ex-red shadow-red active:bg-ex-redDark active:scale-[0.98]',
                    loading && 'opacity-50',
                  )}
                >
                  {loading ? (
                    <Text className="text-sm font-semibold text-white">Yükleniyor…</Text>
                  ) : (
                    <>
                      <Text className="text-sm font-semibold text-white">
                        {mode === 'login' ? 'Giriş yap' : mode === 'signup' ? 'Hesap oluştur' : 'Sıfırlama bağlantısı gönder'}
                      </Text>
                      <ArrowRight size={16} color="#fff" />
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {mode !== 'sent' && (mode === 'login' || mode === 'signup') ? (
              <View className="flex-row justify-center mt-5">
                <Text className="text-xs text-ink-400">
                  {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
                </Text>
                <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
                  <Text className="text-xs font-semibold text-ex-red">
                    {mode === 'login' ? 'Kayıt ol' : 'Giriş yap'}
                  </Text>
                </Pressable>
              </View>
            ) : mode !== 'sent' && (
              <Pressable
                onPress={() => { setMode('login'); setError(null); }}
                className="mt-5 flex-row items-center gap-2"
              >
                <ArrowLeft size={16} color="#9494A0" />
                <Text className="text-sm text-ink-400">Geri dön</Text>
              </Pressable>
            )}

            <Text className="text-center text-[10px] text-ink-300 mt-5 leading-relaxed">
              Devam ederek Kullanım Şartları ve Gizlilik Politikası'nı kabul etmiş olursun.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">{label}</Text>
      <View className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl bg-white border border-ink-200">
        <Icon size={16} color="#9494A0" />
        {children}
      </View>
    </View>
  );
}
