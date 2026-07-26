import { useState, useMemo } from 'react';
import { View, Text, TextInput as RNTextInput, ScrollView, FlatList } from 'react-native';
import { Search } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { useProducts } from '@/lib/hooks';
import { ProductCard } from '@/components/ProductCard';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { StateWrapper } from '@/components/ui/States';
import { cn } from '@/lib/utils';
import type { Product as ProductType } from '@/types';

export function MenuScreen() {
  const { favorites } = useApp();
  const { data: dbProducts, error, loading, reload } = useProducts();
  const [active, setActive] = useState<string>('Tümü');
  const [query, setQuery] = useState('');

  const products: ProductType[] = useMemo(() => {
    if (!dbProducts) return [];
    return dbProducts.map(p => ({
      id: p.id, name: p.name, category: p.category, description: p.description,
      price: Number(p.price), image: p.image, rating: Number(p.rating),
      popular: p.popular, seasonal: p.seasonal, aiRecommended: p.ai_recommended,
      calories: p.calories, allergens: p.allergens, sizes: p.sizes, milks: p.milks,
      syrups: p.syrups, toppings: p.toppings, temperature: p.temperature,
      iceLevels: p.ice_levels, nutrition: p.nutrition,
    }));
  }, [dbProducts]);

  const cats = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => set.add(p.category));
    return ['Tümü', ...Array.from(set).sort()];
  }, [products]);

  const filtered = products.filter(p => {
    if (active !== 'Tümü' && p.category !== active) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const favProducts = products.filter(p => favorites.includes(p.id));

  return (
    <View className="mx-auto max-w-md w-full px-5 pt-4 pb-32">
      <SectionHeader title="Menü" subtitle="Siparişini oluştur" />

      <View className="flex-row items-center gap-3 px-4 py-3.5 rounded-2xl bg-white border border-ink-100 mb-4">
        <Search size={18} color="#9494A0" />
        <RNTextInput
          value={query}
          onChangeText={setQuery}
          placeholder="İçecek ara…"
          placeholderTextColor="#9494A0"
          className="flex-1 text-sm text-ink-900"
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3">
        {cats.map(cat => (
          <PressablePill
            key={cat}
            label={cat}
            active={active === cat}
            onPress={() => setActive(cat)}
          />
        ))}
      </ScrollView>

      {active === 'Tümü' && !query && favProducts.length > 0 && (
        <View className="mb-5">
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Favorilerin</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4 pb-1">
            {favProducts.map(p => <ProductCard key={p.id} product={p} variant="wide" />)}
          </ScrollView>
        </View>
      )}

      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && filtered.length === 0}
        loadingLabel="Menü yükleniyor…"
        emptyTitle="Sonuç yok"
        emptySubtitle="Başka bir arama veya kategori dene"
        onRetry={reload}
      >
        <View className="flex-row flex-wrap gap-4">
          {filtered.map(p => (
            <View key={p.id} className="w-[48%]">
              <ProductCard product={p} />
            </View>
          ))}
        </View>
      </StateWrapper>
    </View>
  );
}

import { Pressable } from 'react-native';

function PressablePill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={cn(
        'shrink-0 px-4 py-2 rounded-full',
        active ? 'bg-ex-red' : 'bg-white border border-ink-100',
      )}
    >
      <Text className={cn('text-xs font-medium', active ? 'text-white' : 'text-ink-500')}>{label}</Text>
    </Pressable>
  );
}
