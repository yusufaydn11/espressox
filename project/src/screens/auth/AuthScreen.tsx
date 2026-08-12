import { useState } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput, ScrollView, useWindowDimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';

type Mode = 'login' | 'signup' | 'forgot' | 'sent';

export function AuthScreen() {
  const { signIn, signUp, resetPassword } = useAuth();
  const { width } = useWindowDimensions();
  const showBrandPanel = Platform.OS === 'web' && width >= 768;
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
      if (password.length < 6) { setError('Şifre en az 6 karakter olmalı'); setLoading(false); return; }
      const { error } = await signUp(email, password, fullName);
      if (error) setError(error); else setMode('sent');
    } else if (mode === 'forgot') {
      const { error } = await resetPassword(email);
      if (error) setError(error); else setMode('sent');
    }
    setLoading(false);
  };

  const titles: Record<Mode, string> = {
    login: 'Tekrar hoş geldin',
    signup: 'Hesap oluştur',
    forgot: 'Şifreni sıfırla',
    sent: 'E-postanı kontrol et',
  };
  const subtitles: Record<Mode, string> = {
    login: 'Kahven seni bekliyor',
    signup: 'Her yudumda puan kazan',
    forgot: 'E-postana sıfırlama linki göndereceğiz',
    sent: 'Gelen kutunu kontrol et',
  };

  return (
    <View className={cn('flex-1 bg-cream-50', showBrandPanel ? 'flex-row' : '')}>
      {showBrandPanel ? (
      <LinearGradient
        colors={[colors.ex.red, colors.ex.redDark]}
        className="w-80 shrink-0 justify-center px-10 relative overflow-hidden"
      >
        <View className="absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10" />
        <View className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-white/5 -ml-16 -mb-16" />
        <View className="relative">
          <View className="h-16 w-16 rounded-2xl bg-white/20 items-center justify-center mb-6">
            <Text className="text-3xl font-extrabold text-white font-display">X</Text>
          </View>
          <Text className="text-3xl font-bold text-white font-display leading-tight">Espresso X</Text>
          <Text className="text-sm text-white/70 mt-3 leading-relaxed">
            Her yudumda puan kazan.{'\n'}Sadakat programın seni bekliyor.
          </Text>
          <View className="mt-8 gap-3">
            {['125+ özel tarif', 'Damga kartı & ödüller', 'QR ile anında puan'].map(t => (
              <View key={t} className="flex-row items-center gap-2">
                <View className="h-1.5 w-1.5 rounded-full bg-white/60" />
                <Text className="text-xs text-white/80">{t}</Text>
              </View>
            ))}
          </View>
        </View>
      </LinearGradient>
      ) : (
        <View className="items-center pt-14 pb-2">
          <View className="h-14 w-14 rounded-2xl bg-ex-red items-center justify-center mb-2">
            <Text className="text-2xl font-extrabold text-white font-display">X</Text>
          </View>
          <Text className="text-lg font-bold text-ink-900 font-display">Espresso X</Text>
        </View>
      )}

      {/* Form */}
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerClassName={cn('flex-grow justify-center py-12', showBrandPanel ? 'px-10' : 'px-5')}
      >
        <View className="bg-white rounded-[1.75rem] p-7 shadow-premium max-w-md w-full self-center border border-cream-200">
          <Text className="text-xl font-bold text-ink-900 font-display">{titles[mode]}</Text>
          <Text className="text-sm text-ink-400 mt-1 mb-6">{subtitles[mode]}</Text>

          {mode === 'sent' ? (
            <View className="items-center py-4">
              <View className="h-14 w-14 rounded-full bg-green-50 items-center justify-center mb-4">
                <CheckCircle2 size={26} color={colors.semantic.success} />
              </View>
              <Text className="text-sm text-ink-500 mb-2 text-center leading-relaxed">
                {email} adresine sıfırlama bağlantısı gönderdik.
              </Text>
              <Text className="text-xs text-ink-400 mb-5 text-center leading-relaxed">
                E-postadaki linke tıkla, yeni şifreni belirle. Gelen kutusunda yoksa spam klasörüne bak.
              </Text>
              <Pressable onPress={() => { setMode('login'); setError(null); }} className="flex-row items-center gap-2">
                <ArrowLeft size={16} color={colors.ex.red} />
                <Text className="text-sm font-semibold text-ex-red">Giriş ekranına dön</Text>
              </Pressable>
            </View>
          ) : (
            <View className="gap-4">
              {mode === 'forgot' && (
                <Pressable onPress={() => { setMode('login'); setError(null); }} className="flex-row items-center gap-2 mb-1">
                  <ArrowLeft size={16} color={colors.ex.red} />
                  <Text className="text-sm font-semibold text-ex-red">Giriş ekranına dön</Text>
                </Pressable>
              )}
              {mode === 'signup' && (
                <Field icon={User} label="Ad Soyad">
                  <RNTextInput value={fullName} onChangeText={setFullName} placeholder="Adın Soyadın" placeholderTextColor={colors.ink[400]} className="flex-1 text-sm text-ink-900" />
                </Field>
              )}
              <Field icon={Mail} label="E-posta">
                <RNTextInput value={email} onChangeText={setEmail} placeholder="ornek@email.com" placeholderTextColor={colors.ink[400]} keyboardType="email-address" autoCapitalize="none" className="flex-1 text-sm text-ink-900" />
              </Field>
              {mode !== 'forgot' && (
                <Field icon={Lock} label="Şifre">
                  <RNTextInput value={password} onChangeText={setPassword} placeholder="••••••••" placeholderTextColor={colors.ink[400]} secureTextEntry={!showPass} className="flex-1 text-sm text-ink-900" />
                  <Pressable onPress={() => setShowPass(s => !s)} hitSlop={8}>
                    {showPass ? <EyeOff size={16} color={colors.ink[400]} /> : <Eye size={16} color={colors.ink[400]} />}
                  </Pressable>
                </Field>
              )}
              {error && (
                <View className="px-3.5 py-2.5 rounded-xl bg-ex-red/5">
                  <Text className="text-xs text-ex-red">{error}</Text>
                </View>
              )}
              {mode === 'login' && (
                <Pressable onPress={() => { setMode('forgot'); setError(null); }}>
                  <Text className="text-xs text-ink-400 text-right">Şifremi unuttum</Text>
                </Pressable>
              )}
              <Pressable
                onPress={handleSubmit}
                disabled={loading}
                className={cn(
                  'flex-row items-center justify-center gap-2 py-4 rounded-full bg-ex-red shadow-red active:opacity-90 active:scale-[0.98]',
                  loading && 'opacity-50',
                )}
              >
                <Text className="text-sm font-bold text-white">
                  {loading ? 'Yükleniyor…' : mode === 'login' ? 'Giriş yap' : mode === 'signup' ? 'Kayıt ol' : 'Gönder'}
                </Text>
                {!loading && <ArrowRight size={16} color="#fff" />}
              </Pressable>
            </View>
          )}

          {mode !== 'sent' && (mode === 'login' || mode === 'signup') && (
            <View className="flex-row justify-center mt-6 pt-5 border-t border-cream-100">
              <Text className="text-sm text-ink-400">{mode === 'login' ? 'Hesabın yok mu? ' : 'Hesabın var mı? '}</Text>
              <Pressable onPress={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}>
                <Text className="text-sm font-bold text-ex-red">{mode === 'login' ? 'Kayıt ol' : 'Giriş yap'}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-medium text-ink-500 mb-1.5">{label}</Text>
      <View className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl bg-cream-50 border border-cream-200">
        <Icon size={16} color={colors.ink[400]} />
        {children}
      </View>
    </View>
  );
}
