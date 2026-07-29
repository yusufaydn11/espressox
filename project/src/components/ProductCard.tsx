import { View, Text, Pressable, Image } from 'react-native';
import { Heart, Plus, Sparkles, Star } from 'lucide-react';
import type { Product } from '@/types';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  onClick?: () => void;
  variant?: 'default' | 'wide';
}

export function ProductCard({ product, onClick, variant = 'default' }: ProductCardProps) {
  const { favorites, toggleFavorite, setSelectedProduct, openSheet } = useApp();
  const fav = favorites.includes(product.id);

  const open = () => {
    if (onClick) return onClick();
    setSelectedProduct(product);
    openSheet('product');
  };

  if (variant === 'wide') {
    return (
      <Pressable onPress={open} className="w-72 shrink-0 mr-3 active:scale-[0.98]">
        <View className="relative h-48 w-full rounded-3xl overflow-hidden shadow-lifted bg-ink-900">
          <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
          <View className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
          {product.aiRecommended && (
            <View className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/95 flex-row items-center gap-1 shadow-soft">
              <Sparkles size={10} color="#C8102E" />
              <Text className="text-[10px] font-bold text-ex-red tracking-wide">ÖNERİLEN</Text>
            </View>
          )}
          <Pressable
            onPress={() => toggleFavorite(product.id)}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/15 items-center justify-center active:scale-110"
          >
            <Heart size={16} color={fav ? '#C8102E' : '#fff'} fill={fav ? '#C8102E' : 'transparent'} />
          </Pressable>
          <View className="absolute bottom-4 left-4 right-4">
            <Text className="text-white font-display text-base font-semibold leading-tight">{product.name}</Text>
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-white/90 text-sm font-medium">₺{product.price.toLocaleString('tr-TR')}</Text>
              <View className="h-1 w-1 rounded-full bg-white/40" />
              <Text className="text-white/70 text-xs">{product.calories} kal</Text>
            </View>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} className="active:scale-[0.98]">
      <View className="relative aspect-square rounded-3xl overflow-hidden shadow-lifted bg-ink-50">
        <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
        <View className="absolute inset-0 bg-gradient-to-t from-ink-950/40 via-transparent to-transparent" />
        <Pressable
          onPress={() => toggleFavorite(product.id)}
          className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-white/20 items-center justify-center active:scale-110"
        >
          <Heart size={15} color={fav ? '#C8102E' : '#fff'} fill={fav ? '#C8102E' : 'transparent'} />
        </Pressable>
        {product.popular && (
          <View className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-ex-red shadow-red">
            <Text className="text-[9px] font-bold uppercase tracking-wider text-white">Popüler</Text>
          </View>
        )}
        {product.seasonal && !product.popular && (
          <View className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-ink-900/80">
            <Text className="text-[9px] font-bold uppercase tracking-wider text-white">Mevsimlik</Text>
          </View>
        )}
      </View>
      <View className="pt-3 px-0.5">
        <Text className="text-sm font-semibold text-ink-900 leading-tight" numberOfLines={1}>{product.name}</Text>
        <View className="flex-row items-center gap-1 mt-0.5">
          <Star size={10} color="#C8102E" fill="#C8102E" />
          <Text className="text-[11px] text-ink-400">{product.rating}</Text>
        </View>
        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-base font-bold text-ink-900">₺{product.price.toLocaleString('tr-TR')}</Text>
          <Pressable
            onPress={open}
            className="h-8 w-8 rounded-full bg-ink-900 items-center justify-center shadow-soft active:scale-90"
          >
            <Plus size={15} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
