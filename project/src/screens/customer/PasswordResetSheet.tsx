import { useState } from 'react';
import { View, Text } from 'react-native';
import { Lock, CheckCircle2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

export function PasswordResetSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const { updatePassword, user } = useAuth();
  const open = sheet === 'reset-password';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const reset = () => {
    setPassword('');
    setConfirm('');
    setDone(false);
    closeSheet();
  };

  const handleSave = async () => {
    if (password.length < 6) {
      showToast('Şifre en az 6 karakter olmalı');
      return;
    }
    if (password !== confirm) {
      showToast('Şifreler eşleşmiyor');
      return;
    }
    setSaving(true);
    const { error } = await updatePassword(password);
    setSaving(false);
    if (error) {
      showToast('Şifre güncellenemedi: ' + error);
      return;
    }
    setDone(true);
    showToast('Şifreniz güncellendi');
  };

  return (
    <Sheet open={open} onClose={reset} title="Yeni Şifre Belirle">
      {!user ? (
        <View className="py-8 items-center">
          <Text className="text-sm text-ink-500 text-center">Şifre sıfırlama bağlantısı geçersiz veya süresi dolmuş. Yeni bağlantı isteyin.</Text>
          <Button variant="gold" className="mt-4" onPress={reset}>Kapat</Button>
        </View>
      ) : done ? (
        <View className="py-8 items-center">
          <View className="h-16 w-16 rounded-3xl bg-green-100 items-center justify-center mb-4">
            <CheckCircle2 size={28} color="#16a34a" />
          </View>
          <Text className="text-lg font-semibold text-ink-900">Şifre güncellendi</Text>
          <Text className="text-sm text-ink-400 mt-1 mb-5 text-center">Artık yeni şifrenizle giriş yapabilirsiniz.</Text>
          <Button variant="gold" onPress={reset}>Tamam</Button>
        </View>
      ) : (
        <View className="gap-4">
          <View className="flex-row items-start gap-2 p-3 rounded-xl bg-cream-100">
            <Lock size={15} color="#C8102E" />
            <Text className="text-[11px] text-ink-400 leading-relaxed flex-1">
              {user.email} hesabı için yeni bir şifre belirleyin.
            </Text>
          </View>
          <View>
            <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">Yeni şifre</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="En az 6 karakter"
              placeholderTextColor="#9494A0"
              secureTextEntry
            />
          </View>
          <View>
            <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">Şifre tekrar</Text>
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Şifrenizi tekrar girin"
              placeholderTextColor="#9494A0"
              secureTextEntry
            />
          </View>
          <Button full onPress={handleSave} disabled={saving || !password || !confirm}>
            Şifreyi kaydet
          </Button>
        </View>
      )}
    </Sheet>
  );
}
