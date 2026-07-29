import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable, Image, TextInput, ScrollView } from 'react-native';
import { Package, ShoppingCart, Tag, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  productService, cartService,
  b2bFormatTRY, getEffectivePrice, hasActiveCampaign,
  type B2BProduct, type B2BProductStock, type B2BCartItem,
} from '@/services/b2b';
import { B2BScreenWrapper, B2BSectionTitle, B2BSearchBar, B2BLoadingSpinner, B2BErrorState, B2BEmptyState } from '@/components/b2b';

type ToastFn = (msg: string) => void;

export function B2BProducts({ showToast }: { showToast: ToastFn }) {
  const [products, setProducts] = useState<B2BProduct[]>([]);
  const [stock, setStock] = useState<B2BProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [cart, setCart] = useState<B2BCartItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [p, s] = await Promise.all([productService.getActive(), productService.getStock()]);
      setProducts(p); setStock(s);
      setCart(await cartService.get());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ürünler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ['all', ...Array.from(set).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    return products.filter(p => {
      if (category !== 'all' && p.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, search, category]);

  const getStockQty = (productId: string) => stock.find(s => s.product_id === productId)?.stock_qty ?? 0;

  const addToCart = async (p: B2BProduct) => {
    const items = await cartService.add({
      id: p.id, sku: p.sku, name: p.name, unit: p.unit,
      price: getEffectivePrice(p), min_order_qty: p.min_order_qty,
    });
    setCart(items);
    showToast(`${p.name} sepete eklendi`);
  };

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner label="Ürünler yükleniyor…" /></B2BScreenWrapper>;
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Tedarik Ürünleri" subtitle="Merkez depodan tedarik edilebilir ürünler" />

      <View className="mb-3"><B2BSearchBar value={search} onChange={setSearch} placeholder="Ürün adı veya kodu ara…" /></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 mb-4">
        {categories.map(c => (
          <Pressable
            key={c}
            onPress={() => setCategory(c)}
            className={cn('px-3.5 py-2 rounded-lg', category === c ? 'bg-ink-900' : 'bg-white border border-ink-100')}
          >
            <Text className={cn('text-xs font-medium', category === c ? 'text-white' : 'text-ink-500')}>{c === 'all' ? 'Tümü' : c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <B2BEmptyState title="Ürün bulunamadı" subtitle="Bu kriterlere uygun ürün yok" icon={<Package size={32} color="#C8C4CC" />} />
      ) : (
        <View className="gap-3">
          {filtered.map(p => {
            const stockQty = getStockQty(p.id);
            const inStock = stockQty > 0;
            const effPrice = getEffectivePrice(p);
            const campaign = hasActiveCampaign(p);
            const inCartItem = cart.find(i => i.product_id === p.id);

            return (
              <View key={p.id} className="rounded-2xl bg-white border border-ink-100 shadow-card p-4 flex-row gap-3">
                <View className="h-16 w-16 rounded-xl bg-cream-100 items-center justify-center shrink-0">
                  {p.image_url ? (
                    <Image source={{ uri: p.image_url }} className="h-16 w-16 rounded-xl" />
                  ) : (
                    <Package size={24} color="#C8C4CC" />
                  )}
                </View>

                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    {campaign && (
                      <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-ex-100">
                        <Tag size={8} color="#C8102E" />
                        <Text className="text-[10px] font-semibold text-ex-red">{p.campaign_label || 'Kampanya'}</Text>
                      </View>
                    )}
                    {!inStock && (
                      <View className="px-2 py-0.5 rounded-full bg-red-50">
                        <Text className="text-[10px] font-semibold text-ex-red">Stokta Yok</Text>
                      </View>
                    )}
                  </View>
                  <Text className="text-[11px] text-ink-400 font-mono mt-1">{p.sku}</Text>
                  <Text className="text-sm font-bold text-ink-900 mt-0.5" numberOfLines={2}>{p.name}</Text>
                  <View className="flex-row items-center gap-2 mt-1">
                    <Text className="text-[11px] text-ink-500">Birim: {p.unit}</Text>
                    <Text className="text-[11px] text-ink-400">·</Text>
                    <Text className="text-[11px] text-ink-500">KDV %{p.vat_rate}</Text>
                    {inStock && <Text className="text-[11px] text-green-600">Stok: {stockQty}</Text>}
                  </View>

                  <View className="flex-row items-end justify-between mt-2">
                    <View>
                      {campaign && <Text className="text-[11px] text-ink-400 line-through">{b2bFormatTRY(p.price)}</Text>}
                      <Text className="text-base font-bold text-ink-900">{b2bFormatTRY(effPrice)}</Text>
                      <Text className="text-[10px] text-ink-400">Min {p.min_order_qty} {p.unit}</Text>
                    </View>
                    <Pressable
                      onPress={() => addToCart(p)}
                      disabled={!inStock}
                      className={cn('flex-row items-center gap-1.5 px-3 py-2 rounded-xl', inStock ? (inCartItem ? 'bg-ink-900' : 'bg-ex-red') : 'bg-ink-100')}
                    >
                      <ShoppingCart size={14} color={inStock ? '#fff' : '#9494A0'} />
                      <Text className="text-xs font-semibold text-white">{inCartItem ? `${inCartItem.quantity}` : 'Ekle'}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </B2BScreenWrapper>
  );
}
