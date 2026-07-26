import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Bell, BellOff, Megaphone, Gift, ShoppingBag, Star, Info } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Modal';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useNotificationPrefs, updateNotificationPrefs } from '@/lib/hooks';
import type { NotificationPrefsRow } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function NotificationSettingsSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const { user } = useAuth();
  const open = sheet === 'notifications';
  const { data: prefs, loading, reload } = useNotificationPrefs();
  const [local, setLocal] = useState<NotificationPrefsRow | null>(null);

  useEffect(() => { if (prefs) setLocal(prefs); }, [prefs]);

  const update = async (field: keyof NotificationPrefsRow, value: boolean) => {
    if (!user || !local) return;
    if (field !== 'master_enabled' && !local.master_enabled) {
      showToast('Önce bildirimleri açın');
      return;
    }
    setLocal(prev => prev ? { ...prev, [field]: value } : prev);
    const { error } = await updateNotificationPrefs(user.id, { [field]: value });
    if (error) showToast('Güncelleme başarısız');
    else { showToast('Bildirim tercihi güncellendi'); reload(); }
  };

  const categories = [
    { id: 'order_updates' as const, label: 'Sipariş güncellemeleri', desc: 'Sipariş durumu, hazırlık ve teslimat bildirimleri', icon: ShoppingBag },
    { id: 'promotions' as const, label: 'Kampanya ve indirimler', desc: 'Mutlu saat, mevsimsel kampanya ve özel fırsatlar', icon: Megaphone },
    { id: 'rewards' as const, label: 'Ödül ve puan', desc: 'Puan kazançları, ödül açılışı ve seviye yükselmeleri', icon: Gift },
    { id: 'challenges' as const, label: 'Görev hatırlatmaları', desc: 'Haftalık görevler ve seri uyarıları', icon: Star },
  ];

  return (
    <Sheet open={open} onClose={closeSheet} title="Bildirim Ayarları">
      {loading ? (
        <View className="py-8 items-center"><ActivityIndicator size="small" color="#C8102E" /></View>
      ) : (
        <View className="gap-5">
          <Card className="bg-red-50 border-ex-red/20">
            <View className="flex-row items-center gap-3">
              <View className="h-11 w-11 rounded-2xl bg-ex-red items-center justify-center shadow-red">
                {local?.master_enabled ? <Bell size={20} color="#fff" /> : <BellOff size={20} color="#fff" />}
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink-900">Bildirimler</Text>
                <Text className="text-xs text-ink-400">{local?.master_enabled ? 'Açık — aşağıdaki kategorileri yönetin' : 'Kapalı'}</Text>
              </View>
              <Toggle checked={local?.master_enabled ?? true} onChange={() => update('master_enabled', !(local?.master_enabled ?? true))} />
            </View>
          </Card>

          <View className="flex-row items-start gap-2 p-3 rounded-xl bg-cream-100">
            <Info size={15} color="#9494A0" />
            <Text className="text-[11px] text-ink-400 leading-relaxed flex-1">
              Bildirim izni, cihazınızın ayarlarından da yönetilebilir. Sipariş güncellemeleri bildirimler kapalı olsa bile uygulama içinde görünür.
            </Text>
          </View>

          <View className={cn(!local?.master_enabled && 'opacity-40')}>
            <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3">Bildirim Kategorileri</Text>
            <View className="gap-2.5">
              {categories.map(p => (
                <View key={p.id} className="flex-row items-center gap-3 p-3 rounded-2xl border border-ink-100 bg-white">
                  <View className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center shrink-0">
                    <p.icon size={16} color="#525258" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium text-ink-900">{p.label}</Text>
                    <Text className="text-[11px] text-ink-400 leading-tight mt-0.5">{p.desc}</Text>
                  </View>
                  <Toggle checked={local?.[p.id] ?? false} onChange={() => update(p.id, !(local?.[p.id] ?? false))} />
                </View>
              ))}
            </View>
          </View>

          <Text className="text-center text-[10px] text-ink-400">
            Espresso X, spam bildirim göndermez. Tercihlerinizi istediğiniz zaman değiştirebilirsiniz.
          </Text>
        </View>
      )}
    </Sheet>
  );
}
