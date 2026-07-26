import { View, Text, Pressable, Image } from 'react-native';
import { Heart, Plus, Sparkles } from 'lucide-react-native';
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
      <Pressable onPress={open} className="w-72 shrink-0 mr-3 active:opacity-90">
        <View className="relative h-44 w-full rounded-2xl overflow-hidden shadow-card">
          <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
          <View className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
          {product.aiRecommended && (
            <View className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white/90 flex-row items-center gap-0.5">
              <Sparkles size={10} color="#C8102E" />
              <Text className="text-[10px] font-semibold text-ex-red">Önerilen</Text>
            </View>
          )}
          <Pressable
            onPress={() => toggleFavorite(product.id)}
            className="absolute top-3 right-3 h-8 w-8 rounded-full bg-ink-950/40 items-center justify-center active:scale-110"
          >
            <Heart size={15} color={fav ? '#C8102E' : '#fff'} fill={fav ? '#C8102E' : 'transparent'} />
          </Pressable>
          <View className="absolute bottom-3 left-3 right-3">
            <Text className="text-white font-semibold text-sm leading-tight">{product.name}</Text>
            <Text className="text-white/80 text-xs mt-0.5">₺{product.price.toLocaleString('tr-TR')} · {product.calories} kal</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} className="active:opacity-90">
      <View className="relative aspect-square rounded-2xl overflow-hidden shadow-card bg-ink-50">
        <Image source={{ uri: product.image }} className="h-full w-full" resizeMode="cover" />
        <Pressable
          onPress={() => toggleFavorite(product.id)}
          className="absolute top-2.5 right-2.5 h-8 w-8 rounded-full bg-ink-950/40 items-center justify-center active:scale-110"
        >
          <Heart size={15} color={fav ? '#C8102E' : '#fff'} fill={fav ? '#C8102E' : 'transparent'} />
        </Pressable>
        {product.popular && (
          <View className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-ex-red">
            <Text className="text-[9px] font-bold uppercase tracking-wide text-white">Popüler</Text>
          </View>
        )}
        {product.seasonal && !product.popular && (
          <View className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-ink-900">
            <Text className="text-[9px] font-bold uppercase tracking-wide text-white">Mevsimlik</Text>
          </View>
        )}
      </View>
      <View className="pt-2.5 px-0.5">
        <Text className="text-sm font-semibold text-ink-900 leading-tight" numberOfLines={1}>{product.name}</Text>
        <View className="flex-row items-center justify-between mt-1.5">
          <Text className="text-sm font-bold text-ink-900">₺{product.price.toLocaleString('tr-TR')}</Text>
          <Pressable
            onPress={open}
            className="h-7 w-7 rounded-full bg-ex-red items-center justify-center shadow-red active:scale-95"
          >
            <Plus size={14} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
