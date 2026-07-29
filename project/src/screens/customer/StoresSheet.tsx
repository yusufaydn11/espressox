import { View, Text, Pressable, Linking } from 'react-native';
import { Navigation, Clock, Wifi, Car, Coffee, MapPin, Phone, MessageCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useStores } from '@/lib/hooks';
import { StateWrapper } from '@/components/ui/States';
import { cn } from '@/lib/utils';
import type { Store } from '@/lib/supabase';

const busyLabels: Record<string, string> = { quiet: 'Sakin', moderate: 'Orta', busy: 'Yoğun' };

export function StoresSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const open = sheet === 'stores';
  const { data: stores, error, loading, reload } = useStores();

  const getDirections = async (store: Store) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${store.lat},${store.lng}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
      showToast(`${store.name} için yol tarifi açılıyor`);
    } else {
      showToast('Harita uygulaması açılamadı');
    }
  };

  const callStore = async (phone: string) => {
    const supported = await Linking.canOpenURL(`tel:${phone}`);
    if (supported) await Linking.openURL(`tel:${phone}`);
  };

  const openWhatsApp = async (whatsapp: string) => {
    const url = `https://wa.me/${whatsapp.replace(/\D/g, '')}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="Mağazalar">
      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && (stores?.length ?? 0) === 0}
        loadingLabel="Mağazalar yükleniyor…"
        emptyTitle="Mağaza bulunamadı"
        onRetry={reload}
      >
        <View className="h-40 rounded-2xl overflow-hidden mb-5 bg-cream-200 items-center justify-center">
          <Coffee size={32} color="#C8102E" />
          <Text className="text-xs text-ink-400 mt-2">Yakınında {stores?.length ?? 0} mağaza</Text>
        </View>

        <View className="gap-3">
          {stores?.map(store => (
            <View key={store.id} className="p-4 rounded-2xl border border-ink-100 bg-white">
              <View className="flex-row items-start justify-between mb-2">
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-semibold text-ink-900">{store.name}</Text>
                  <Text className="text-xs text-ink-400" numberOfLines={1}>{store.address}</Text>
                </View>
                <View className={cn('px-2 py-0.5 rounded-full', store.open ? 'bg-green-100' : 'bg-red-100')}>
                  <Text className={cn('text-[10px] font-bold uppercase', store.open ? 'text-green-700' : 'text-ex-red')}>{store.open ? 'Açık' : 'Kapalı'}</Text>
                </View>
              </View>

              <View className="flex-row items-center gap-3 mb-3">
                <View className="flex-row items-center gap-1"><MapPin size={11} color="#9494A0" /><Text className="text-[11px] text-ink-400" numberOfLines={1}>{store.address.split(',').slice(-2).join(',').trim()}</Text></View>
                <View className="flex-row items-center gap-1"><Clock size={11} color="#9494A0" /><Text className="text-[11px] text-ink-400">{store.hours}</Text></View>
              </View>

              <View className="mb-3">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Text className="text-[10px] font-medium text-ink-500">Yoğunluk</Text>
                  <Text className={cn('text-[10px] font-bold', store.busy === 'quiet' ? 'text-green-600' : store.busy === 'moderate' ? 'text-ex-red' : 'text-red-500')}>{busyLabels[store.busy] ?? 'Orta'}</Text>
                </View>
                <View className="flex-row gap-1">
                  {[0, 1, 2].map(i => (
                    <View key={i} className={cn('h-1.5 flex-1 rounded-full', store.busy === 'quiet' && i < 1 ? 'bg-green-500' : store.busy === 'moderate' && i < 2 ? 'bg-ex-red' : store.busy === 'busy' ? 'bg-red-500' : 'bg-ink-200')} />
                  ))}
                </View>
              </View>

              <View className="flex-row flex-wrap gap-2 mb-3">
                {store.wifi && <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-ink-50"><Wifi size={10} color="#525258" /><Text className="text-[10px] text-ink-600">WiFi</Text></View>}
                {store.parking && <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-ink-50"><Car size={10} color="#525258" /><Text className="text-[10px] text-ink-600">Otopark</Text></View>}
                {store.drive_thru && <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-ink-50"><Coffee size={10} color="#525258" /><Text className="text-[10px] text-ink-600">Drive-thru</Text></View>}
              </View>

              <View className="flex-row gap-2 mb-3">
                {store.phone && (
                  <Pressable onPress={() => callStore(store.phone!)} className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-xl bg-ink-50 active:bg-ink-100">
                    <Phone size={12} color="#525258" /><Text className="text-xs font-medium text-ink-700">Ara</Text>
                  </Pressable>
                )}
                {store.whatsapp && (
                  <Pressable onPress={() => openWhatsApp(store.whatsapp!)} className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-xl bg-green-100 active:bg-green-200">
                    <MessageCircle size={12} color="#16a34a" /><Text className="text-xs font-medium text-green-700">WhatsApp</Text>
                  </Pressable>
                )}
              </View>

              <Button size="sm" variant="outline" full onPress={() => getDirections(store)}>
                <Navigation size={13} /> Yol tarifi al
              </Button>
            </View>
          ))}
        </View>
      </StateWrapper>
    </Sheet>
  );
}
