import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { Coffee, Crown, Gift, MapPin, ChevronRight, Flame, Sparkles, QrCode as QrIcon, Star } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useStores, useProducts } from '@/lib/hooks';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { TIERS } from '@shared/constants/loyalty';
import { formatPoints } from '@shared/utils/loyalty';
import { mapRetailDbProductsToUi, filterRetailPopularProducts } from '@shared/utils/products';
import type { RetailProductDbRow } from '@shared/types/products';
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

  const products = mapRetailDbProductsToUi((dbProducts ?? []).slice(0, 6) as RetailProductDbRow[]);

  const popular = filterRetailPopularProducts(products).slice(0, 4);
  const favProducts = products.filter(p => favorites.includes(p.id));
  const siyahMin = TIERS.find(t => t.name === 'Siyah')?.minPoints ?? 7000;
  const tierProgress = Math.min(100, (points / siyahMin) * 100);

  return (
    <View className="mx-auto max-w-md pb-32 w-full">
      {/* Greeting */}
      <View className="px-5 pt-5">
        <Text className="text-sm text-ink-400 font-medium">{greeting},</Text>
        <Text className="text-[30px] font-bold text-ink-900 leading-tight mt-0.5 font-display">{firstName}</Text>
      </View>

      {/* Loyalty hero card */}
      <View className="px-5 mt-5">
        <Card className="relative overflow-hidden">
          <View className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-ex-red/8" />
          <View className="absolute -right-6 -bottom-10 h-28 w-28 rounded-full bg-ex-red/5" />
          <View className="relative p-5">
            <View className="flex-row items-start justify-between">
              <View>
                <View className="flex-row items-center gap-1.5">
                  <Crown size={15} color="#C8102E" fill="#C8102E" />
                  <Text className="text-[11px] font-bold text-ex-red uppercase tracking-widest">{tier} Üye</Text>
                </View>
                <Text className="text-[34px] font-bold text-ink-900 mt-2 font-display leading-none">
                  {formatPoints(points)}
                  <Text className="text-base font-normal text-ink-400 font-sans"> puan</Text>
                </Text>
              </View>
              <Pressable
                onPress={() => openSheet('rewards')}
                className="h-10 w-10 rounded-2xl bg-ink-50 items-center justify-center active:bg-ink-100 active:scale-90"
              >
                <ChevronRight size={18} color="#6E6E78" />
              </Pressable>
            </View>
            <View className="mt-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[11px] text-ink-400 font-medium">Siyah seviyeye</Text>
                <Text className="text-[11px] font-bold text-ex-red">{formatPoints(siyahMin - points)} puan</Text>
              </View>
              <View className="h-2 rounded-full bg-ink-100 overflow-hidden">
                <View className="h-full rounded-full bg-red-gradient" style={{ width: `${tierProgress}%` }} />
              </View>
            </View>
          </View>
        </Card>
      </View>

      {/* Quick actions */}
      <View className="px-5 mt-4 flex-row gap-3">
        <Pressable onPress={() => setTab('menu')} className="flex-1 active:scale-[0.97]">
          <Card className="p-4 relative overflow-hidden">
            <View className="absolute top-0 right-0 h-16 w-16 rounded-full bg-ex-red/5 -mr-8 -mt-8" />
            <View className="relative h-12 w-12 rounded-2xl bg-red-gradient items-center justify-center shadow-red">
              <Coffee size={22} color="#fff" />
            </View>
            <Text className="text-base font-bold text-ink-900 mt-3">Sipariş Ver</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">2 dokunuşla hazır</Text>
          </Card>
        </Pressable>
        <Pressable onPress={() => setTab('qr')} className="flex-1 active:scale-[0.97]">
          <Card className="p-4 relative overflow-hidden">
            <View className="absolute top-0 right-0 h-16 w-16 rounded-full bg-ink-900/5 -mr-8 -mt-8" />
            <View className="relative h-12 w-12 rounded-2xl bg-ink-900 items-center justify-center shadow-soft">
              <QrIcon size={22} color="#fff" />
            </View>
            <Text className="text-base font-bold text-ink-900 mt-3">QR Kartım</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">Okut, puan kazan</Text>
          </Card>
        </Pressable>
      </View>

      {/* Streak banner */}
      <View className="px-5 mt-3">
        <Card className="p-4 flex-row items-center gap-3 relative overflow-hidden">
          <View className="absolute left-0 top-0 bottom-0 w-1 bg-ex-red" />
          <View className="h-11 w-11 rounded-2xl bg-ex-red/10 items-center justify-center">
            <Flame size={20} color="#C8102E" fill="#C8102E" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink-900">{profile?.streak ?? 14} günlük seri</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">Yarın +50 bonus puan kazanırsın</Text>
          </View>
          <View className="px-2.5 py-1 rounded-full bg-ex-red/10">
            <Text className="text-[10px] font-bold text-ex-red uppercase tracking-wide">Aktif</Text>
          </View>
        </Card>
      </View>

      {/* Popular */}
      {popular.length > 0 && (
        <View className="mt-7">
          <View className="flex-row items-center justify-between px-5 mb-3.5">
            <View className="flex-row items-center gap-2">
              <View className="h-6 w-1 rounded-full bg-ex-red" />
              <Text className="text-xl font-bold text-ink-900 font-display">Popüler</Text>
            </View>
            <Pressable onPress={() => setTab('menu')} className="flex-row items-center gap-0.5 active:opacity-60">
              <Text className="text-xs font-semibold text-ex-red">Tümünü gör</Text>
              <ChevronRight size={14} color="#C8102E" />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 pb-2 gap-3.5">
            {popular.map(p => <PopularItem key={p.id} product={p} />)}
          </ScrollView>
        </View>
      )}

      {/* Favorites / For you */}
      {favProducts.length > 0 && (
        <View className="mt-6">
          <View className="flex-row items-center gap-2 px-5 mb-3.5">
            <Sparkles size={18} color="#C8102E" fill="#C8102E" />
            <Text className="text-xl font-bold text-ink-900 font-display">Senin için</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 pb-2 gap-3.5">
            {favProducts.map(p => <PopularItem key={p.id} product={p} />)}
          </ScrollView>
        </View>
      )}

      {/* Quick links */}
      <View className="px-5 mt-6 gap-2.5">
        {nearestStore && <QuickLink icon={MapPin} label={nearestStore.name} sub={`${nearestStore.hours} · ${nearestStore.open ? 'Açık' : 'Kapalı'}`} badge={nearestStore.open ? 'Açık' : 'Kapalı'} onClick={() => openSheet('stores')} />}
        <QuickLink icon={Gift} label="Kampanyalar" sub="Sana özel fırsatlar" onClick={() => setTab('campaigns')} />
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
      className="w-40 shrink-0 active:scale-[0.97]"
    >
      <View className="relative h-44 w-40 rounded-3xl overflow-hidden bg-ink-100 shadow-lifted">
        <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
        <View className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
        {product.aiRecommended && (
          <View className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-white/95 flex-row items-center gap-0.5 shadow-soft">
            <Sparkles size={9} color="#C8102E" />
            <Text className="text-[9px] font-bold text-ex-red">ÖNERİLEN</Text>
          </View>
        )}
        <View className="absolute bottom-3 left-3 right-3">
          <Text className="text-white font-semibold text-sm leading-tight" numberOfLines={1}>{product.name}</Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Text className="text-white font-bold text-sm">₺{product.price.toLocaleString('tr-TR')}</Text>
            <View className="h-1 w-1 rounded-full bg-white/50" />
            <View className="flex-row items-center gap-0.5">
              <Star size={8} color="#FFD66B" fill="#FFD66B" />
              <Text className="text-white/80 text-[10px]">{product.rating}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function QuickLink({ icon: Icon, label, sub, badge, onClick }: { icon: typeof Gift; label: string; sub: string; badge?: string; onClick: () => void }) {
  return (
    <Pressable
      onPress={onClick}
      className="active:scale-[0.98]"
    >
      <Card className="p-4 flex-row items-center gap-3.5">
        <View className="h-11 w-11 rounded-2xl bg-cream-100 items-center justify-center">
          <Icon size={19} color="#C8102E" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-ink-900" numberOfLines={1}>{label}</Text>
          <Text className="text-[11px] text-ink-400 mt-0.5" numberOfLines={1}>{sub}</Text>
        </View>
        {badge && (
          <View className={cn('px-2 py-0.5 rounded-full', badge === 'Açık' ? 'bg-green-50' : 'bg-red-50')}>
            <Text className={cn('text-[10px] font-bold uppercase tracking-wide', badge === 'Açık' ? 'text-green-600' : 'text-ex-red')}>{badge}</Text>
          </View>
        )}
        <ChevronRight size={18} color="#C4C4CC" />
      </Card>
    </Pressable>
  );
}
