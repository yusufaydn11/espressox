import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { Sparkles, Star, ChevronRight } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { Product } from '@/types';

interface ProductCarouselProps {
  title: string;
  products: Product[];
  icon?: 'sparkles' | 'none';
  onSeeAll?: () => void;
  seeAllLabel?: string;
  showHeader?: boolean;
}

export function ProductCarousel({
  title,
  products,
  icon = 'none',
  onSeeAll,
  seeAllLabel = 'Tümünü gör',
  showHeader = true,
}: ProductCarouselProps) {
  if (products.length === 0) return null;

  return (
    <View className={showHeader ? 'mt-7' : 'mt-0'}>
      {showHeader && (
        <View className="flex-row items-center justify-between px-5 mb-3.5">
          <View className="flex-row items-center gap-2">
            {icon === 'sparkles' ? (
              <Sparkles size={18} color="#C8102E" fill="#C8102E" />
            ) : (
              <View className="h-6 w-1 rounded-full bg-ex-red" />
            )}
            <Text className="text-xl font-bold text-ink-900 font-display">{title}</Text>
          </View>
          {onSeeAll && (
            <Pressable onPress={onSeeAll} className="flex-row items-center gap-0.5 active:opacity-60">
              <Text className="text-xs font-semibold text-ex-red">{seeAllLabel}</Text>
              <ChevronRight size={14} color="#C8102E" />
            </Pressable>
          )}
        </View>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="px-5 pb-2 gap-3.5"
      >
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
      onPress={() => {
        setSelectedProduct(product);
        openSheet('product');
      }}
      className="w-40 shrink-0 active:scale-[0.97]"
    >
      <View className="relative h-44 w-40 rounded-3xl overflow-hidden bg-ink-100 shadow-lifted">
        <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
        <View className="absolute inset-0 bg-gradient-to-t from-ink-950/75 via-ink-950/10 to-transparent" />
        {product.aiRecommended && (
          <View className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-white/95 flex-row items-center gap-0.5 shadow-soft">
            <Sparkles size={9} color="#C8102E" />
            <Text className="text-[9px] font-bold text-ex-red">ÖNERİLEN</Text>
          </View>
        )}
        <View className="absolute bottom-3 left-3 right-3">
          <Text className="text-white font-semibold text-sm leading-tight" numberOfLines={1}>
            {product.name}
          </Text>
          <View className="flex-row items-center gap-1.5 mt-0.5">
            <Text className="text-white font-bold text-sm">
              ₺{product.price.toLocaleString('tr-TR')}
            </Text>
            <View className="h-1 w-1 rounded-full bg-white/50" />
            <View className="flex-row items-center gap-0.5">
              <Star size={8} color="#D4AF37" fill="#D4AF37" />
              <Text className="text-white/80 text-[10px]">{product.rating}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
