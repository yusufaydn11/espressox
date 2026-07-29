import { View, Text } from 'react-native';
import { Gift, MapPin, RotateCcw, Flame, Megaphone } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useStores, useProducts, useOrders, useCampaigns, useLoyaltyStamps } from '@/lib/hooks';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { SectionHeader } from '@/components/ui/SectionHeader';
import {
  HomeHero,
  ProductCarousel,
  HomeQuickLink,
  HomeSkeleton,
  CustomerEmptyCard,
  ScreenWrapper,
} from '@/components/customer';
import { TIERS } from '@shared/constants/loyalty';
import { mapRetailDbProductsToUi, filterRetailPopularProducts } from '@shared/utils/products';
import type { RetailProductDbRow } from '@shared/types/products';
import { formatPrice } from '@/lib/utils';
import type { Store } from '@/lib/supabase';
import { colors } from '@shared/design/tokens';

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

  if (loading) {
    return (
      <ScreenWrapper width="wide">
        <HomeSkeleton />
      </ScreenWrapper>
    );
  }

  if (error) {
    return (
      <ScreenWrapper width="wide">
        <ErrorState message={error} onRetry={reloadProducts} />
      </ScreenWrapper>
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
    <ScreenWrapper width="wide">
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
        <View className="mt-6">
          <Card className="p-4 flex-row items-center gap-3">
            <View className="h-10 w-10 rounded-xl bg-ex-red/10 items-center justify-center">
              <Flame size={18} color={colors.ex.red} fill={colors.ex.red} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink-900">{profile?.streak} günlük seri</Text>
              <Text className="text-xs text-ink-400 mt-0.5">Bonus puan için devam et</Text>
            </View>
          </Card>
        </View>
      )}

      <View className="mt-6">
        {popular.length > 0 ? (
          <>
            <SectionHeader title="Popüler" underline actionLabel="Tümü" onAction={() => setTab('menu')} />
            <ProductCarousel title="" products={popular} showHeader={false} />
          </>
        ) : (
          <CustomerEmptyCard preset="products" actionLabel="Menüye git" onAction={() => setTab('menu')} />
        )}
      </View>

      <View className="mt-6">
        <SectionHeader title="Favori ürünler" subtitle="Senin için seçtiklerimiz" underline />
        {favProducts.length > 0 ? (
          <ProductCarousel title="" products={favProducts} showHeader={false} />
        ) : (
          <CustomerEmptyCard preset="favorites" actionLabel="Menüyü keşfet" onAction={() => setTab('menu')} />
        )}
      </View>

      <View className="mt-6">
        <SectionHeader
          title="Tekrar sipariş"
          subtitle="Son siparişinden hızlıca devam et"
          actionLabel="Tümü"
          onAction={() => openSheet('orders')}
          underline
        />
        {!ordersLoading && lastOrder ? (
          <Card className="p-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 min-w-0">
                <Text className="text-xs text-ink-400">{lastOrder.order_number}</Text>
                <Text className="text-sm font-bold text-ink-900 mt-0.5" numberOfLines={1}>
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
          <CustomerEmptyCard preset="orders" actionLabel="Sipariş ver" onAction={() => setTab('menu')} />
        )}
      </View>

      <View className="mt-6 flex-row flex-wrap gap-3">
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
          <Card className="p-4 h-16 justify-center flex-1 min-w-[280px]">
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
          <HomeQuickLink
            icon={Gift}
            label="Kampanyalar"
            sub="Fırsatları keşfet"
            onPress={() => setTab('campaigns')}
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
    </ScreenWrapper>
  );
}
