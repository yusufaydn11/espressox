import { useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { UserX, Download, AlertTriangle, CheckCircle2, Shield } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { SUPPORT_EMAIL } from '@shared/constants/support';

type Phase = 'menu' | 'confirm-delete' | 'deleting' | 'deleted';

export function AccountSettingsSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const { deleteAccount, user } = useAuth();
  const open = sheet === 'account';
  const [phase, setPhase] = useState<Phase>('menu');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = async () => {
    setConfirmOpen(false);
    setPhase('deleting');
    const { error } = await deleteAccount();
    if (error) {
      setPhase('menu');
      showToast('Hesap silinemedi: ' + error);
      return;
    }
    setPhase('deleted');
  };

  const handleExportRequest = () => {
    showToast(`Veri indirme talebi için ${SUPPORT_EMAIL} adresine yazın`);
  };

  const reset = () => {
    setPhase('menu');
    closeSheet();
  };

  return (
    <>
      <Sheet open={open} onClose={reset} title="Hesap ve Veri Yönetimi">
        {phase === 'menu' && (
          <View className="gap-5">
            <View className="flex-row items-start gap-2 p-3 rounded-xl bg-cream-100">
              <Shield size={15} color="#C8102E" />
              <Text className="text-[11px] text-ink-400 leading-relaxed flex-1">
                KVKK ve GDPR kapsamında verilerinizi yönetin. Hesabınızı sildiğinizde kişisel bilgileriniz kaldırılır; yasal saklama gerektiren sipariş kayıtları anonim olarak tutulabilir.
              </Text>
            </View>

            <Card className="p-4">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="h-10 w-10 rounded-2xl bg-cream-100 items-center justify-center">
                  <Download size={18} color="#525258" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink-900">Verilerimi indir</Text>
                  <Text className="text-[11px] text-ink-400">KVKK kapsamında veri taşınabilirliği talebi oluşturun</Text>
                </View>
              </View>
              <Button variant="outline" full size="sm" onPress={handleExportRequest}><Download size={14} /> Talep oluştur</Button>
            </Card>

            <Card className="p-4 border-ex-red/20">
              <View className="flex-row items-center gap-3 mb-3">
                <View className="h-10 w-10 rounded-2xl bg-red-100 items-center justify-center">
                  <UserX size={18} color="#C8102E" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-ink-900">Hesabımı sil</Text>
                  <Text className="text-[11px] text-ink-400">Hesabınız ve tüm verileriniz kalıcı olarak silinir</Text>
                </View>
              </View>
              <View className="flex-row items-start gap-2 p-2.5 rounded-xl bg-red-50 mb-3">
                <AlertTriangle size={14} color="#C8102E" />
                <Text className="text-[11px] text-ex-red leading-relaxed flex-1">
                  Bu işlem geri alınamaz. Sadakat puanlarınız, ödülleriniz ve sipariş geçmişiniz kalıcı olarak silinecek.
                </Text>
              </View>
              <Button variant="outline" full size="sm" onPress={() => setConfirmOpen(true)} className="border-ex-red/30">
                <UserX size={14} /> Hesabımı sil
              </Button>
            </Card>

            <Text className="text-center text-[10px] text-ink-400">Giriş yapan: {user?.email}</Text>
          </View>
        )}

        {phase === 'deleting' && (
          <View className="py-12 items-center">
            <View className="h-16 w-16 rounded-3xl bg-red-100 items-center justify-center mb-4">
              <ActivityIndicator size="large" color="#C8102E" />
            </View>
            <Text className="text-lg font-semibold text-ink-900">Hesabınız siliniyor…</Text>
            <Text className="text-sm text-ink-400 mt-1">Lütfen bekleyin</Text>
          </View>
        )}

        {phase === 'deleted' && (
          <View className="py-12 items-center">
            <View className="h-16 w-16 rounded-3xl bg-green-100 items-center justify-center mb-4">
              <CheckCircle2 size={28} color="#16a34a" />
            </View>
            <Text className="text-lg font-semibold text-ink-900">Hesabınız silindi</Text>
            <Text className="text-sm text-ink-400 mt-1 mb-5">Kişisel verileriniz kaldırıldı. Sipariş kayıtları yasal yükümlülükler kapsamında anonim saklanabilir.</Text>
            <Button variant="gold" onPress={reset}>Tamam</Button>
          </View>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        title="Hesabını sil"
        confirmLabel="Evet, sil"
        message="Bu işlem geri alınamaz. Tüm puan, ödül ve sipariş geçmişiniz silinecek. Onaylıyor musun?"
      />
    </>
  );
}
