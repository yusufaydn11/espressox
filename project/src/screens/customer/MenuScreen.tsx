import { useState, useMemo } from 'react';
import { View, Text, TextInput as RNTextInput, ScrollView, Pressable, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Sparkles, Plus, Heart, Coffee, Cookie, GlassWater, IceCream, UtensilsCrossed, LayoutGrid } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useProducts } from '@/lib/hooks';
import {
  mapRetailDbProductsToUi,
  deriveRetailCategories,
  filterRetailProductsByCategory,
  filterRetailProductsBySearch,
} from '@shared/utils/products';
import { RETAIL_SEARCH_PLACEHOLDERS } from '@shared/constants/products';
import type { RetailProductDbRow } from '@shared/types/products';
import { StateWrapper } from '@/components/ui/States';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';
import { AnimatedBlock } from '@/components/customer/AnimatedBlock';
import { PageHeader } from '@/components/customer/PageHeader';
import { SectionLabel } from '@/components/customer/SectionLabel';

const CAT_ICONS: Record<string, typeof Coffee> = {
  'Tümü': LayoutGrid,
  'Espresso': Coffee,
  'Kahve': Coffee,
  'Soğuk': GlassWater,
  'Bubble': IceCream,
  'Creamy': IceCream,
  'Atıştırmalık': Cookie,
  'Yemek': UtensilsCrossed,
};

function getCatIcon(cat: string) {
  const key = Object.keys(CAT_ICONS).find(k => cat.toLowerCase().includes(k.toLowerCase()));
  return CAT_ICONS[key ?? ''] ?? Coffee;
}

export function MenuScreen() {
  const { favorites, toggleFavorite, setSelectedProduct, openSheet } = useApp();
  const { data: dbProducts, error, loading, reload } = useProducts();
  const [active, setActive] = useState<string>('Tümü');
  const [query, setQuery] = useState('');

  const products = useMemo(
    () => mapRetailDbProductsToUi((dbProducts ?? []) as RetailProductDbRow[]),
    [dbProducts],
  );
  const cats = useMemo(() => deriveRetailCategories(products), [products]);
  const filtered = filterRetailProductsBySearch(
    filterRetailProductsByCategory(products, active),
    query,
  );

  return (
    <View className="flex-1 flex-row">
      {/* Sol: kategori menüsü */}
      <View className="w-56 shrink-0 bg-white border-r border-cream-200 py-6">
        <View className="px-5">
          <SectionLabel className="mb-4">Kategoriler</SectionLabel>
        </View>
        <ScrollView showsVerticalScrollIndicator={false}>
          {cats.map(cat => {
            const isActive = active === cat;
            const count = cat === 'Tümü'
              ? products.length
              : products.filter(p => p.category === cat).length;
            const CatIcon = getCatIcon(cat);
            return (
              <Pressable
                key={cat}
                onPress={() => setActive(cat)}
                className={cn(
                  'flex-row items-center gap-2 mx-2 px-2 py-2.5 rounded-xl mb-0.5 active:opacity-80',
                  isActive ? 'bg-ex-red/8' : '',
                )}
              >
                <View className={cn('w-1 h-6 rounded-full', isActive ? 'bg-ex-red' : 'bg-transparent')} />
                <View className={cn(
                  'h-8 w-8 rounded-lg items-center justify-center',
                  isActive ? 'bg-ex-red' : 'bg-cream-50',
                )}>
                  <CatIcon size={15} color={isActive ? '#fff' : colors.ink[400]} />
                </View>
                <Text className={cn('text-sm flex-1', isActive ? 'font-bold text-ex-red' : 'font-medium text-ink-600')}>
                  {cat}
                </Text>
                <View className={cn(
                  'min-w-[22px] h-5 px-1.5 rounded-full items-center justify-center',
                  isActive ? 'bg-ex-red/15' : 'bg-cream-100',
                )}>
                  <Text className={cn('text-[10px] font-semibold', isActive ? 'text-ex-red' : 'text-ink-400')}>{count}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Sağ: ürünler */}
      <View className="flex-1">
        <View className="px-8 pt-8 pb-5 border-b border-cream-200 bg-cream-50/80">
          <PageHeader title="Menü" subtitle={`${active} · ${filtered.length} ürün`} className="mb-4" />
          <View className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl bg-white shadow-soft border border-cream-200 max-w-xl">
            <Search size={18} color={colors.ex.red} />
            <RNTextInput
              value={query}
              onChangeText={setQuery}
              placeholder={RETAIL_SEARCH_PLACEHOLDERS.menu}
              placeholderTextColor={colors.ink[400]}
              className="flex-1 text-sm text-ink-900"
            />
          </View>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-8 py-6">
          <StateWrapper
            loading={loading}
            error={error}
            empty={!loading && !error && filtered.length === 0}
            loadingLabel="Menü yükleniyor…"
            emptyTitle="Sonuç yok"
            emptySubtitle="Başka bir kategori veya arama dene"
            onRetry={reload}
          >
            <View className="flex-row flex-wrap gap-5">
              {filtered.map((p, idx) => {
                const fav = favorites.includes(p.id);
                return (
                  <AnimatedBlock key={p.id} animation="fade-up" delay={Math.min(idx * 40, 400)} className="active:scale-[0.98]" style={{ width: '30%', minWidth: 160 }}>
                    <Pressable onPress={() => { setSelectedProduct(p); openSheet('product'); }}>
                      <View className="rounded-[1.25rem] overflow-hidden bg-white shadow-soft border border-cream-100">
                        <View className="relative aspect-[4/3]">
                          <Image source={{ uri: p.image }} className="w-full h-full" resizeMode="cover" />
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.35)']}
                            className="absolute inset-x-0 bottom-0 h-16"
                          />
                          {p.category && (
                            <View className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-white/90">
                              <Text className="text-[9px] font-semibold text-ink-600">{p.category}</Text>
                            </View>
                          )}
                          {p.aiRecommended && (
                            <View className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-ex-red flex-row items-center gap-1 shadow-red">
                              <Sparkles size={8} color="#fff" />
                              <Text className="text-[8px] font-bold text-white">ÖNERİ</Text>
                            </View>
                          )}
                          <Pressable
                            onPress={() => toggleFavorite(p.id)}
                            className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/95 items-center justify-center shadow-soft"
                          >
                            <Heart size={14} color={fav ? colors.ex.red : colors.ink[400]} fill={fav ? colors.ex.red : 'transparent'} />
                          </Pressable>
                        </View>
                        <View className="p-3.5 flex-row items-center justify-between">
                          <View className="flex-1 mr-2">
                            <Text className="text-sm font-bold text-ink-900" numberOfLines={1}>{p.name}</Text>
                            <Text className="text-base font-bold text-ex-red mt-0.5 font-display">₺{p.price.toLocaleString('tr-TR')}</Text>
                          </View>
                          <Pressable
                            onPress={() => { setSelectedProduct(p); openSheet('product'); }}
                            className="h-9 w-9 rounded-full bg-ex-red items-center justify-center shadow-red active:scale-90"
                          >
                            <Plus size={17} color="#fff" strokeWidth={2.5} />
                          </Pressable>
                        </View>
                      </View>
                    </Pressable>
                  </AnimatedBlock>
                );
              })}
            </View>
          </StateWrapper>
        </ScrollView>
      </View>
    </View>
  );
}
