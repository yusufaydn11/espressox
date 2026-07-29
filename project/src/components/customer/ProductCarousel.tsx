import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Product } from '@/types';
import { colors } from '@shared/design/tokens';

interface ProductCarouselProps {
  title: string;
  products: Product[];
  onSeeAll?: () => void;
  seeAllLabel?: string;
  showHeader?: boolean;
}

export function ProductCarousel({
  title,
  products,
  onSeeAll,
  seeAllLabel = 'Tümü',
  showHeader = true,
}: ProductCarouselProps) {
  if (products.length === 0) return null;

  return (
    <View className={showHeader ? 'mt-8' : 'mt-0'}>
      {showHeader && (
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-xl font-bold text-ink-900 font-display">{title}</Text>
            <View className="h-0.5 w-8 bg-ex-red rounded-full mt-1.5" />
          </View>
          {onSeeAll && (
            <Pressable onPress={onSeeAll} className="flex-row items-center gap-0.5 px-3 py-1.5 rounded-full bg-ex-red/10 active:opacity-60">
              <Text className="text-xs font-bold text-ex-red">{seeAllLabel}</Text>
              <ChevronRight size={14} color={colors.ex.red} />
            </Pressable>
          )}
        </View>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-4 pb-1">
        {products.map(p => (
          <ProductCarouselItem key={p.id} product={p} />
        ))}
      </ScrollView>
    </View>
  );
}

function ProductCarouselItem({ product }: { product: Product }) {
  const { setSelectedProduct, openSheet } = useApp();

  return (
    <Pressable
      onPress={() => { setSelectedProduct(product); openSheet('product'); }}
      className="w-44 shrink-0"
    >
      <View className="rounded-[1.25rem] overflow-hidden bg-white shadow-soft border border-cream-100">
        <View className="relative">
          <Image source={{ uri: product.image }} className="h-40 w-full" resizeMode="cover" />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.25)']}
            className="absolute inset-x-0 bottom-0 h-12"
          />
          {product.category && (
            <View className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-white/90">
              <Text className="text-[9px] font-semibold text-ink-600">{product.category}</Text>
            </View>
          )}
        </View>
        <View className="p-3.5">
          <Text className="text-sm font-bold text-ink-900 leading-tight" numberOfLines={2}>{product.name}</Text>
          <Text className="text-base font-bold text-ex-red mt-1 font-display">₺{product.price.toLocaleString('tr-TR')}</Text>
        </View>
      </View>
    </Pressable>
  );
}
