import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, ScrollView, Pressable, Text } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { cn } from '@/lib/utils';
import { usePagination } from '@/lib/usePagination';
import {
  productService, cartService, orderService,
  getEffectivePrice, hasActiveCampaign,
  type B2BProduct, type B2BProductStock, type B2BCartItem,
} from '@/services/b2b';
import {
  findB2BStockQty,
  filterB2BProductsByCategory,
  filterB2BProductsBySearch,
  deriveB2BCategories,
} from '@shared/utils/b2b';
import { B2B_PRODUCT_SEARCH_PLACEHOLDER } from '@shared/constants/b2b';
import {
  B2BScreenWrapper, B2BSectionTitle, B2BSearchBar, B2BErrorState, B2BEmptyState,
  B2BProductGridSkeleton, B2BProductCard,
} from '@/components/b2b';

const FAV_KEY = 'b2b_favorite_product_ids';

type ToastFn = (msg: string) => void;

export function B2BProducts({ showToast }: { showToast: ToastFn }) {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [stock, setStock] = useState<B2BProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<B2BCartItem[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [lastOrderProductIds, setLastOrderProductIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, s, c, favRaw, orders] = await Promise.all([
        productService.getActive(),
        productService.getStock(),
        cartService.get(),
        AsyncStorage.getItem(FAV_KEY),
        orderService.listWithItems().catch(() => []),
      ]);
      setProducts(p); setStock(s); setCart(c);
      if (favRaw) setFavorites(new Set(JSON.parse(favRaw) as string[]));
      const lastOrder = orders[0];
      if (lastOrder?.b2b_order_items?.length) {
        setLastOrderProductIds(
          lastOrder.b2b_order_items
            .map(i => i.product_id)
            .filter((id): id is string => !!id)
            .slice(0, 6),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => deriveB2BCategories(products), [products]);
  const filtered = useMemo(
    () => filterB2BProductsBySearch(filterB2BProductsByCategory(products, category), search),
    [products, search, category],
  );
  const { pageItems, page, setPage, totalPages, hasPrev, hasNext, total } = usePagination(filtered, 12);
  const getStockQty = (productId: string) => findB2BStockQty(stock, productId);

  const addToCart = async (p: B2BProduct) => {
    const items = await cartService.add({
      id: p.id, sku: p.sku, name: p.name, unit: p.unit,
      price: getEffectivePrice(p), min_order_qty: p.min_order_qty,
    });
    setCart(items);
    showToast(`${p.name} sepete eklendi`);
  };

  const toggleFavorite = async (productId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      void AsyncStorage.setItem(FAV_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  if (loading) {
    return (
      <B2BScreenWrapper>
        <B2BProductGridSkeleton />
      </B2BScreenWrapper>
    );
  }
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;

  const favProducts = products.filter(p => favorites.has(p.id)).slice(0, 4);
  const suggestedProducts = products.filter(p => lastOrderProductIds.includes(p.id)).slice(0, 4);

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Tedarik Ürünleri" subtitle="Merkez depodan tedarik edilebilir ürünler" />

      {suggestedProducts.length > 0 && (
        <View className="mb-5">
          <Text className="text-sm font-bold text-ink-900 mb-3">Son Siparişten Öneri</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
            {suggestedProducts.map(p => (
              <View key={`suggest-${p.id}`} className="w-64">
                <B2BProductCard
                  product={p}
                  stockQty={getStockQty(p.id)}
                  effectivePrice={getEffectivePrice(p)}
                  hasCampaign={hasActiveCampaign(p)}
                  cartQty={cart.find(i => i.product_id === p.id)?.quantity}
                  isFavorite={favorites.has(p.id)}
                  onAdd={() => void addToCart(p)}
                  onToggleFavorite={() => void toggleFavorite(p.id)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {favProducts.length > 0 && (
        <View className="mb-5">
          <Text className="text-sm font-bold text-ink-900 mb-3">Favori Ürünler</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
            {favProducts.map(p => (
              <View key={p.id} className="w-64">
                <B2BProductCard
                  product={p}
                  stockQty={getStockQty(p.id)}
                  effectivePrice={getEffectivePrice(p)}
                  hasCampaign={hasActiveCampaign(p)}
                  cartQty={cart.find(i => i.product_id === p.id)?.quantity}
                  isFavorite
                  onAdd={() => void addToCart(p)}
                  onToggleFavorite={() => void toggleFavorite(p.id)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View className="mb-3"><B2BSearchBar value={search} onChange={setSearch} placeholder={B2B_PRODUCT_SEARCH_PLACEHOLDER} /></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 mb-4">
        {categories.map(c => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            className={cn('px-3.5 py-2 rounded-full border', category === c ? 'bg-ink-900 border-ink-900' : 'bg-white border-ink-200')}
          >
            <Text className={cn('text-xs font-semibold', category === c ? 'text-white' : 'text-ink-500')}>
              {c === 'all' ? 'Tümü' : c}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <B2BEmptyState preset="products" />
      ) : (
        <View className="gap-4">
          {pageItems.map(p => (
            <B2BProductCard
              key={p.id}
              product={p}
              stockQty={getStockQty(p.id)}
              effectivePrice={getEffectivePrice(p)}
              hasCampaign={hasActiveCampaign(p)}
              cartQty={cart.find(i => i.product_id === p.id)?.quantity}
              isFavorite={favorites.has(p.id)}
              onAdd={() => void addToCart(p)}
              onToggleFavorite={() => void toggleFavorite(p.id)}
            />
          ))}
        </View>
      )}

      {totalPages > 1 && (
        <View className="flex-row items-center justify-between mt-4 px-1">
          <Text className="text-xs text-ink-400">{total} ürün · Sayfa {page + 1}/{totalPages}</Text>
          <View className="flex-row gap-2">
            <Pressable disabled={!hasPrev} onPress={() => setPage(page - 1)} className={cn('h-9 w-9 rounded-xl items-center justify-center', hasPrev ? 'bg-ink-100' : 'bg-ink-50 opacity-40')}>
              <ChevronLeft size={16} color="#3D3D42" />
            </Pressable>
            <Pressable disabled={!hasNext} onPress={() => setPage(page + 1)} className={cn('h-9 w-9 rounded-xl items-center justify-center', hasNext ? 'bg-ink-100' : 'bg-ink-50 opacity-40')}>
              <ChevronRight size={16} color="#3D3D42" />
            </Pressable>
          </View>
        </View>
      )}
    </B2BScreenWrapper>
  );
}
