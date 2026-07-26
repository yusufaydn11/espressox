import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { Coffee, Crown, Gift, MapPin, ChevronRight, Flame, Sparkles, QrCode as QrIcon } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useStores, useProducts } from '@/lib/hooks';
import { Card } from '@/components/ui/Card';
import type { Product } from '@/types';

export function HomeScreen() {
  const { setTab, openSheet, points, favorites } = useApp();
  const { profile } = useAuth();
  const { data: stores } = useStores();
  const { data: dbProducts } = useProducts();

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  })();

  const firstName = profile?.full_name?.split(' ')[0] || 'Kahve Sevdalısı';
  const nearestStore = stores?.[0];
  const tier = profile?.tier ?? 'Bronz';

  const products: Product[] = (dbProducts ?? []).slice(0, 6).map(p => ({
    id: p.id, name: p.name, category: p.category, description: p.description,
    price: Number(p.price), image: p.image, rating: Number(p.rating),
    popular: p.popular, seasonal: p.seasonal, aiRecommended: p.ai_recommended,
    calories: p.calories, allergens: p.allergens, sizes: p.sizes, milks: p.milks,
    syrups: p.syrups, toppings: p.toppings, temperature: p.temperature,
    iceLevels: p.ice_levels, nutrition: p.nutrition,
  }));

  const popular = products.filter(p => p.popular).slice(0, 4);
  const favProducts = products.filter(p => favorites.includes(p.id));
  const tierProgress = Math.min(100, (points / 7000) * 100);

  return (
    <View className="mx-auto max-w-md pb-32 w-full">
      <View className="px-5 pt-4">
        <Text className="text-sm text-ink-400">{greeting},</Text>
        <Text className="text-[28px] font-bold text-ink-900 leading-tight mt-0.5">{firstName}</Text>
      </View>

      <View className="px-5 mt-4">
        <Card className="relative overflow-hidden">
          <View className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-ex-red/5" />
          <View className="relative p-5">
            <View className="flex-row items-start justify-between">
              <View>
                <View className="flex-row items-center gap-2">
                  <Crown size={16} color="#C8102E" />
                  <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wider">{tier} Seviye</Text>
                </View>
                <Text className="text-3xl font-bold text-ink-900 mt-2">
                  {points.toLocaleString('tr-TR')}
                  <Text className="text-sm font-normal text-ink-400"> puan</Text>
                </Text>
              </View>
              <Pressable
                onPress={() => openSheet('rewards')}
                className="h-9 w-9 rounded-xl bg-ink-50 items-center justify-center active:bg-ink-100"
              >
                <ChevronRight size={18} color="#6E6E78" />
              </Pressable>
            </View>
            <View className="mt-4">
              <View className="flex-row items-center justify-between mb-1.5">
                <Text className="text-[11px] text-ink-400">Siyah seviyeye</Text>
                <Text className="text-[11px] font-medium text-ex-red">{(7000 - points).toLocaleString('tr-TR')} puan</Text>
              </View>
              <View className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                <View className="h-full rounded-full bg-ex-red" style={{ width: `${tierProgress}%` }} />
              </View>
            </View>
          </View>
        </Card>
      </View>

      <View className="px-5 mt-4 flex-row gap-3">
        <Pressable onPress={() => setTab('menu')} className="flex-1 active:opacity-80">
          <Card className="p-4">
            <View className="h-11 w-11 rounded-2xl bg-ex-red items-center justify-center shadow-red">
              <Coffee size={20} color="#fff" />
            </View>
            <Text className="text-base font-bold text-ink-900 mt-3">Sipariş Ver</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">2 dokunuşla hazır</Text>
          </Card>
        </Pressable>
        <Pressable onPress={() => setTab('qr')} className="flex-1 active:opacity-80">
          <Card className="p-4">
            <View className="h-11 w-11 rounded-2xl bg-ink-900 items-center justify-center">
              <QrIcon size={20} color="#fff" />
            </View>
            <Text className="text-base font-bold text-ink-900 mt-3">QR Kartım</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">Okut, puan kazan</Text>
          </Card>
        </Pressable>
      </View>

      <View className="px-5 mt-4">
        <Card className="p-4 flex-row items-center gap-3">
          <View className="h-10 w-10 rounded-xl bg-ex-red/10 items-center justify-center">
            <Flame size={18} color="#C8102E" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-ink-900">{profile?.streak ?? 14} günlük seri</Text>
            <Text className="text-[11px] text-ink-400">Yarın +50 bonus puan</Text>
          </View>
          <Text className="text-xs font-semibold text-ex-red">Aktif</Text>
        </Card>
      </View>

      {popular.length > 0 && (
        <View className="mt-6">
          <View className="flex-row items-center justify-between px-5 mb-3">
            <Text className="text-lg font-bold text-ink-900">Popüler</Text>
            <Pressable onPress={() => setTab('menu')} className="flex-row items-center gap-0.5">
              <Text className="text-xs font-medium text-ex-red">Tümünü gör </Text>
              <ChevronRight size={14} color="#C8102E" />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 pb-2 gap-3">
            {popular.map(p => <PopularItem key={p.id} product={p} />)}
          </ScrollView>
        </View>
      )}

      {favProducts.length > 0 && (
        <View className="mt-5">
          <View className="flex-row items-center gap-1.5 px-5 mb-3">
            <Sparkles size={16} color="#C8102E" />
            <Text className="text-lg font-bold text-ink-900">Senin için</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 pb-2 gap-3">
            {favProducts.map(p => <PopularItem key={p.id} product={p} />)}
          </ScrollView>
        </View>
      )}

      <View className="px-5 mt-5 gap-2.5">
        <QuickLink icon={Gift} label="Kampanyalar" sub="Sana özel fırsatlar" onClick={() => setTab('campaigns')} />
        {nearestStore && <QuickLink icon={MapPin} label={nearestStore.name} sub={`${nearestStore.hours} · ${nearestStore.open ? 'Açık' : 'Kapalı'}`} onClick={() => openSheet('stores')} />}
        <QuickLink icon={Coffee} label="Siparişlerim" sub="Geçmiş ve aktif siparişler" onClick={() => openSheet('orders')} />
      </View>
    </View>
  );
}

function PopularItem({ product }: { product: Product }) {
  const { setSelectedProduct, openSheet } = useApp();
  return (
    <Pressable
      onPress={() => { setSelectedProduct(product); openSheet('product'); }}
      className="w-36 shrink-0 active:opacity-80"
    >
      <View className="relative h-36 w-36 rounded-2xl overflow-hidden bg-ink-100">
        <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
        {product.aiRecommended && (
          <View className="absolute top-2 left-2 flex-row items-center gap-0.5 px-2 py-0.5 rounded-full bg-white/90">
            <Sparkles size={9} color="#C8102E" />
            <Text className="text-[9px] font-bold text-ex-red">Önerilen</Text>
          </View>
        )}
      </View>
      <Text className="text-sm font-semibold text-ink-900 mt-2" numberOfLines={1}>{product.name}</Text>
      <Text className="text-xs text-ex-red font-medium mt-0.5">₺{product.price.toLocaleString('tr-TR')}</Text>
    </Pressable>
  );
}

function QuickLink({ icon: Icon, label, sub, onClick }: { icon: typeof Gift; label: string; sub: string; onClick: () => void }) {
  return (
    <Pressable
      onPress={onClick}
      className="flex-1 active:opacity-80"
    >
      <Card className="p-4 flex-row items-center gap-3.5">
        <View className="h-10 w-10 rounded-xl bg-ink-50 items-center justify-center">
          <Icon size={18} color="#6E6E78" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-semibold text-ink-900" numberOfLines={1}>{label}</Text>
          <Text className="text-[11px] text-ink-400" numberOfLines={1}>{sub}</Text>
        </View>
        <ChevronRight size={18} color="#C4C4CC" />
      </Card>
    </Pressable>
  );
}
