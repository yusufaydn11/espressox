import { useState, useMemo, useRef } from 'react';
import { View, Text, TextInput as RNTextInput, ScrollView, Pressable, Image } from 'react-native';
import { Search, Sparkles, Star } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useProducts } from '@/lib/hooks';
import {
  mapRetailDbProductsToUi,
  deriveRetailCategories,
  filterRetailProductsByCategory,
  filterRetailProductsBySearch,
  filterRetailRecommendedProducts,
} from '@shared/utils/products';
import { RETAIL_SEARCH_PLACEHOLDERS } from '@shared/constants/products';
import type { RetailProductDbRow } from '@shared/types/products';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StateWrapper } from '@/components/ui/States';
import { cn } from '@/lib/utils';

export function MenuScreen() {
  const { favorites, setSelectedProduct, openSheet } = useApp();
  const { data: dbProducts, error, loading, reload } = useProducts();
  const [active, setActive] = useState<string>('Tümü');
  const [query, setQuery] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const products = useMemo(
    () => mapRetailDbProductsToUi((dbProducts ?? []) as RetailProductDbRow[]),
    [dbProducts],
  );

  const cats = useMemo(() => deriveRetailCategories(products), [products]);

  const filtered = filterRetailProductsBySearch(
    filterRetailProductsByCategory(products, active),
    query,
  );

  const favProducts = products.filter(p => favorites.includes(p.id));
  const recommended = filterRetailRecommendedProducts(products).slice(0, 6);

  const selectCategory = (cat: string) => {
    setActive(cat);
    scrollRef.current?.scrollTo({ x: 0, animated: true });
  };

  return (
    <View className="mx-auto max-w-md w-full px-5 pt-4 pb-32">
      <SectionHeader
        title="Menü"
        subtitle="Siparişini oluştur"
        action={<View className="px-3 py-1.5 rounded-full bg-ink-900 items-center justify-center"><Text className="text-xs font-bold text-white">{products.length} ürün</Text></View>}
      />

      {/* Search */}
      <View className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl bg-white border border-ink-100 shadow-soft mb-4">
        <Search size={18} color="#9494A0" />
        <RNTextInput
          value={query}
          onChangeText={setQuery}
          placeholder={RETAIL_SEARCH_PLACEHOLDERS.menu}
          placeholderTextColor="#9494A0"
          className="flex-1 text-sm text-ink-900"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} className="h-5 w-5 rounded-full bg-ink-100 items-center justify-center">
            <Text className="text-[10px] font-bold text-ink-500">X</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Categories */}
      <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3">
        {cats.map(cat => (
          <PressablePill
            key={cat}
            label={cat}
            active={active === cat}
            onPress={() => selectCategory(cat)}
          />
        ))}
      </ScrollView>

      {/* Recommended (only on All view) */}
      {active === 'Tümü' && !query && recommended.length > 0 && (
        <View className="mb-5">
          <View className="flex-row items-center gap-2 mb-3">
            <Sparkles size={16} color="#C8102E" fill="#C8102E" />
            <Text className="text-sm font-bold text-ink-900">Senin için önerilenler</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-1">
            {recommended.map(p => (
              <Pressable
                key={p.id}
                onPress={() => { setSelectedProduct(p); openSheet('product'); }}
                className="w-44 shrink-0 active:scale-[0.97]"
              >
                <View className="relative h-32 w-44 rounded-2xl overflow-hidden shadow-lifted bg-ink-900">
                  <Image source={{ uri: p.image }} className="h-full w-full" resizeMode="cover" />
                  <View className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
                  <View className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/95 flex-row items-center gap-0.5">
                    <Sparkles size={8} color="#C8102E" />
                    <Text className="text-[8px] font-bold text-ex-red uppercase">Öneri</Text>
                  </View>
                  <View className="absolute bottom-2.5 left-2.5 right-2.5">
                    <Text className="text-white font-semibold text-xs leading-tight" numberOfLines={1}>{p.name}</Text>
                    <Text className="text-white/80 text-[11px] font-medium mt-0.5">₺{p.price.toLocaleString('tr-TR')}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Favorites */}
      {active === 'Tümü' && !query && favProducts.length > 0 && (
        <View className="mb-5">
          <View className="flex-row items-center gap-2 mb-3">
            <Star size={15} color="#C8102E" fill="#C8102E" />
            <Text className="text-sm font-bold text-ink-900">Favorilerin</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4 pb-1">
            {favProducts.map(p => <ProductCard key={p.id} product={p} variant="wide" />)}
          </ScrollView>
        </View>
      )}

      {/* Grid */}
      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        loadingLabel="Menü yükleniyor…"
        emptyTitle="Sonuç yok"
        emptySubtitle="Başka bir arama veya kategori dene"
        onRetry={reload}
      >
        <View className="flex-row flex-wrap gap-3.5">
          {filtered.map(p => (
            <View key={p.id} className="w-[47%]">
              <ProductCard product={p} />
            </View>
          ))}
        </View>
      </StateWrapper>
    </View>
  );
}

function PressablePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'shrink-0 px-4 py-2.5 rounded-full',
        active ? 'bg-ink-900 shadow-soft' : 'bg-white border border-ink-100',
      )}
    >
      <Text className={cn('text-xs font-semibold', active ? 'text-white' : 'text-ink-500')}>{label}</Text>
    </Pressable>
  );
}
