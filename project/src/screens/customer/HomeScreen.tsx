import { View, Text } from 'react-native';
import { Gift, MapPin, RotateCcw, Flame, Megaphone } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useStores, useProducts, useOrders, useCampaigns, useLoyaltyStamps } from '@/lib/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import {
  HomeHero,
  ProductCarousel,
  HomeQuickLink,
  HomeSectionHeader,
  HomeSkeleton,
  CustomerEmptyCard,
} from '@/components/customer';
import { TIERS } from '@shared/constants/loyalty';
import { mapRetailDbProductsToUi, filterRetailPopularProducts } from '@shared/utils/products';
import type { RetailProductDbRow } from '@shared/types/products';
import { formatPrice } from '@/lib/utils';
import type { Store } from '@/lib/supabase';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function normalizeTierName(tier: string): string {
  const map: Record<string, string> = {
    Gumus: 'Gümüş',
    Gümüş: 'Gümüş',
    Altin: 'Altın',
    Altın: 'Altın',
  };
  return map[tier] ?? tier;
}

function getTierProgress(tier: string, points: number) {
  const normalized = normalizeTierName(tier);
  const idx = TIERS.findIndex(t => t.name === normalized);
  const current = idx >= 0 ? TIERS[idx] : TIERS[0];
  const next = idx >= 0 ? TIERS[idx + 1] : TIERS[1];

  if (!next) {
    return { progress: 100, pointsToNext: 0, label: 'En üst seviye' };
  }

  const range = next.minPoints - current.minPoints;
  const progress = range > 0
    ? Math.min(100, ((points - current.minPoints) / range) * 100)
    : 0;

  return {
    progress,
    pointsToNext: Math.max(0, next.minPoints - points),
    label: `${next.name} seviyeye`,
  };
}

function pickFeaturedStore(stores: Store[] | null | undefined, favoriteStoreId?: string | null): Store | undefined {
  if (!stores?.length) return undefined;
  if (favoriteStoreId) {
    const fav = stores.find(s => s.id === favoriteStoreId);
    if (fav) return fav;
  }
  return stores[0];
}

export function HomeScreen() {
  const { setTab, openSheet, points, favorites, showToast } = useApp();
  const { profile } = useAuth();
  const { data: stores, loading: storesLoading, error: storesError } = useStores();
  const { data: dbProducts, loading: productsLoading, error: productsError, reload: reloadProducts } = useProducts();
  const { data: orders, loading: ordersLoading } = useOrders();
  const { data: campaigns, loading: campaignsLoading } = useCampaigns();
  const { data: stamps } = useLoyaltyStamps();

  const loading = productsLoading && !dbProducts;
  const error = productsError;

  if (loading) return <HomeSkeleton />;

  if (error) {
    return (
      <View className="mx-auto max-w-md pb-32 w-full">
        <ErrorState message={error} onRetry={reloadProducts} />
      </View>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0] || 'Kahve Sevdalısı';
  const tier = profile?.tier ?? 'Bronz';
  const tierMeta = getTierProgress(tier, points);
  const products = mapRetailDbProductsToUi((dbProducts ?? []) as RetailProductDbRow[]);
  const popular = filterRetailPopularProducts(products).slice(0, 6);
  const favProducts = products.filter(p => favorites.includes(p.id)).slice(0, 6);
  const featuredStore = pickFeaturedStore(stores, profile?.favorite_store_id);
  const stampCount = stamps?.filter(s => !s.redeemed).length ?? 0;
  const lastOrder = orders?.[0];
  const campaignPreview = campaigns?.slice(0, 2) ?? [];

  return (
    <View className="mx-auto max-w-md pb-32 w-full">
      <HomeHero
        greeting={getGreeting()}
        firstName={firstName}
        tier={tier}
        points={points}
        tierProgress={tierMeta.progress}
        pointsToNextTier={tierMeta.pointsToNext}
        nextTierLabel={tierMeta.label}
        stampCount={stampCount}
        onOpenRewards={() => openSheet('rewards')}
        onOpenQr={() => setTab('qr')}
        onOrder={() => setTab('menu')}
      />

      {(profile?.streak ?? 0) > 0 && (
        <View className="px-5 mt-3">
          <Card className="p-4 flex-row items-center gap-3 relative overflow-hidden">
            <View className="absolute left-0 top-0 bottom-0 w-1 bg-ex-red rounded-l-2xl" />
            <View className="h-11 w-11 rounded-2xl bg-ex-red/10 items-center justify-center">
              <Flame size={20} color="#C8102E" fill="#C8102E" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink-900">{profile?.streak} günlük seri</Text>
              <Text className="text-[11px] text-ink-400 mt-0.5">Serini koru, bonus puan kazan</Text>
            </View>
            <View className="px-2.5 py-1 rounded-full bg-ex-red/10">
              <Text className="text-[10px] font-bold text-ex-red uppercase tracking-wide">Aktif</Text>
            </View>
          </Card>
        </View>
      )}

      {popular.length > 0 ? (
        <ProductCarousel
          title="Popüler"
          products={popular}
          onSeeAll={() => setTab('menu')}
        />
      ) : (
        <View className="px-5 mt-7">
          <CustomerEmptyCard preset="products" actionLabel="Menüye git" onAction={() => setTab('menu')} />
        </View>
      )}

      <View className="mt-6">
        <HomeSectionHeader title="Favori ürünler" subtitle="Senin için seçtiklerimiz" />
        {favProducts.length > 0 ? (
          <ProductCarousel title="" products={favProducts} icon="sparkles" showHeader={false} />
        ) : (
          <View className="px-5">
            <CustomerEmptyCard
              preset="favorites"
              actionLabel="Menüyü keşfet"
              onAction={() => setTab('menu')}
            />
          </View>
        )}
      </View>

      <View className="mt-6 px-5">
        <HomeSectionHeader
          title="Tekrar sipariş"
          subtitle="Son siparişinden hızlıca devam et"
          actionLabel="Tümü"
          onAction={() => openSheet('orders')}
        />
        {!ordersLoading && lastOrder ? (
          <Card className="p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 min-w-0">
                <Text className="text-xs text-ink-400">{lastOrder.order_number}</Text>
                <Text className="text-sm font-semibold text-ink-900 mt-0.5" numberOfLines={1}>
                  {lastOrder.store_name}
                </Text>
                <Text className="text-xs text-ink-500 mt-1" numberOfLines={2}>
                  {lastOrder.order_items?.slice(0, 2).map(i => i.name).join(' · ')}
                </Text>
              </View>
              <Text className="text-sm font-bold text-ex-red ml-2">
                {formatPrice(Number(lastOrder.total))}
              </Text>
            </View>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 self-start"
              onPress={() => showToast(`${lastOrder.order_number} yeniden sipariş ediliyor…`)}
            >
              <RotateCcw size={13} /> Tekrar sipariş
            </Button>
          </Card>
        ) : (
          <CustomerEmptyCard
            preset="orders"
            actionLabel="Sipariş ver"
            onAction={() => setTab('menu')}
          />
        )}
      </View>

      <View className="px-5 mt-6 gap-2.5">
        {featuredStore && !storesError && (
          <HomeQuickLink
            icon={MapPin}
            label={featuredStore.name}
            sub={`${featuredStore.hours} · ${featuredStore.open ? 'Açık' : 'Kapalı'}`}
            badge={featuredStore.open ? 'Açık' : 'Kapalı'}
            onPress={() => openSheet('stores')}
          />
        )}
        {storesLoading && !featuredStore && (
          <Card className="p-4 h-16 justify-center">
            <Text className="text-xs text-ink-400">Mağazalar yükleniyor…</Text>
          </Card>
        )}

        {!campaignsLoading && campaignPreview.length > 0 ? (
          campaignPreview.map(c => (
            <HomeQuickLink
              key={c.id}
              icon={Megaphone}
              label={c.title || c.name || 'Kampanya'}
              sub={c.message ?? 'Sana özel fırsat'}
              onPress={() => setTab('campaigns')}
            />
          ))
        ) : !campaignsLoading ? (
          <CustomerEmptyCard
            preset="campaigns"
            actionLabel="Kampanyalara git"
            onAction={() => setTab('campaigns')}
          />
        ) : (
          <HomeQuickLink icon={Gift} label="Kampanyalar" sub="Yükleniyor…" onPress={() => setTab('campaigns')} />
        )}

        <HomeQuickLink
          icon={Gift}
          label="Siparişlerim"
          sub="Geçmiş ve aktif siparişler"
          onPress={() => openSheet('orders')}
        />
      </View>
    </View>
  );
}
