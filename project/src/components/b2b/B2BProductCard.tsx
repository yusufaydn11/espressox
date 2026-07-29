import { View, Text, Pressable, Image } from 'react-native';
import { Package, ShoppingCart, Tag, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { b2bFormatTRY, type B2BProduct } from '@/services/b2b';

interface B2BProductCardProps {
  product: B2BProduct;
  stockQty: number;
  effectivePrice: number;
  hasCampaign: boolean;
  cartQty?: number;
  isFavorite?: boolean;
  onAdd: () => void;
  onToggleFavorite?: () => void;
}

export function B2BProductCard({
  product,
  stockQty,
  effectivePrice,
  hasCampaign,
  cartQty,
  isFavorite,
  onAdd,
  onToggleFavorite,
}: B2BProductCardProps) {
  const inStock = stockQty > 0;
  const lowStock = inStock && stockQty <= 10;

  return (
    <View className="rounded-3xl bg-white border border-ink-100 shadow-soft overflow-hidden">
      <View className="relative h-40 bg-cream-100">
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Package size={40} color="#D4D0C6" />
          </View>
        )}
        <View className="absolute top-3 left-3 flex-row gap-1.5">
          {hasCampaign && (
            <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-ex-red shadow-red">
              <Tag size={10} color="#fff" />
              <Text className="text-[10px] font-bold text-white">{product.campaign_label || 'Kampanya'}</Text>
            </View>
          )}
          {lowStock && (
            <View className="px-2 py-1 rounded-full bg-amber-500">
              <Text className="text-[10px] font-bold text-white">Az stok</Text>
            </View>
          )}
          {!inStock && (
            <View className="px-2 py-1 rounded-full bg-ink-900/80">
              <Text className="text-[10px] font-bold text-white">Stokta yok</Text>
            </View>
          )}
        </View>
        {onToggleFavorite && (
          <Pressable
            onPress={onToggleFavorite}
            className="absolute top-3 right-3 h-9 w-9 rounded-full bg-white/95 items-center justify-center shadow-soft active:scale-95"
          >
            <Heart size={16} color={isFavorite ? '#C8102E' : '#9494A0'} fill={isFavorite ? '#C8102E' : 'transparent'} />
          </Pressable>
        )}
      </View>

      <View className="p-4">
        <Text className="text-[10px] text-ink-400 font-mono">{product.sku}</Text>
        <Text className="text-base font-bold text-ink-900 mt-0.5 leading-tight" numberOfLines={2}>{product.name}</Text>
        <View className="flex-row items-center gap-2 mt-1.5 flex-wrap">
          <Text className="text-[11px] text-ink-500">{product.unit}</Text>
          <Text className="text-[11px] text-ink-300">·</Text>
          <Text className="text-[11px] text-ink-500">KDV %{product.vat_rate}</Text>
          {inStock && <Text className="text-[11px] text-green-600 font-medium">Stok: {stockQty}</Text>}
        </View>

        <View className="flex-row items-end justify-between mt-3">
          <View>
            {hasCampaign && (
              <Text className="text-xs text-ink-400 line-through">{b2bFormatTRY(product.price)}</Text>
            )}
            <Text className="text-xl font-bold text-ink-900">{b2bFormatTRY(effectivePrice)}</Text>
            <Text className="text-[10px] text-ink-400">Min. {product.min_order_qty} {product.unit}</Text>
          </View>
          <Pressable
            onPress={onAdd}
            disabled={!inStock}
            className={cn(
              'flex-row items-center gap-2 px-4 py-2.5 rounded-2xl',
              inStock ? (cartQty ? 'bg-ink-900' : 'bg-ex-red shadow-red') : 'bg-ink-100',
            )}
          >
            <ShoppingCart size={16} color={inStock ? '#fff' : '#9494A0'} />
            <Text className="text-sm font-semibold text-white">
              {cartQty ? `${cartQty} adet` : 'Ekle'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
