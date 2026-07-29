import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { Trash2, Plus, Minus, CheckCircle2, ShoppingCart } from 'lucide-react';
import {
  cartService, orderService,
  b2bFormatTRY,
} from '@/services/b2b';
import { B2BScreenWrapper, B2BSectionTitle, B2BLoadingSpinner, B2BEmptyState } from '@/components/b2b';
import type { B2BCartItem } from '@/services/b2b';

type ToastFn = (msg: string) => void;

export function B2BCart({ showToast, onOrderCreated }: { showToast: ToastFn; onOrderCreated: () => void }) {
  const [cart, setCart] = useState<B2BCartItem[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const items = await cartService.get();
    setCart(items);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateQty = async (productId: string, delta: number) => {
    const items = await cartService.updateQty(productId, delta);
    setCart([...items]);
  };

  const removeItem = async (productId: string) => {
    const items = await cartService.remove(productId);
    setCart(items);
  };

  const subtotal = cartService.getSubtotal(cart);
  const vatTotal = cartService.getVatTotal(cart);
  const total = cartService.getTotal(cart);

  const handleSubmit = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const items = cart.map(i => ({ product_id: i.product_id, quantity: i.quantity }));
      const result = await orderService.createOrder(items, notes);
      if (result.error) {
        const detail = typeof result.detail === 'string' ? result.detail : null;
        showToast(detail ?? result.error);
        return;
      }
      await cartService.clear();
      setCart([]);
      showToast(`Sipariş oluşturuldu: ${result.order_number}`);
      onOrderCreated();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Sipariş oluşturulamadı');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner /></B2BScreenWrapper>;

  if (cart.length === 0) {
    return (
      <B2BScreenWrapper>
        <B2BSectionTitle title="Sepet" subtitle="Tedarik sepetiniz" />
        <B2BEmptyState title="Sepetiniz boş" subtitle="Tedarik ürünlerinden sepete ekleyin" icon={<ShoppingCart size={32} color="#C8C4CC" />} />
      </B2BScreenWrapper>
    );
  }

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Sepet" subtitle={`${cart.length} kalem ürün`} />

      <View className="gap-3 mb-5">
        {cart.map(item => (
          <View key={item.product_id} className="rounded-2xl bg-white border border-ink-100 shadow-card p-4 flex-row items-center gap-3">
            <View className="flex-1 min-w-0">
              <Text className="text-[11px] text-ink-400 font-mono">{item.sku}</Text>
              <Text className="text-sm font-bold text-ink-900" numberOfLines={2}>{item.name}</Text>
              <Text className="text-[11px] text-ink-400 mt-0.5">{b2bFormatTRY(item.price)} / {item.unit}</Text>
            </View>

            <View className="flex-row items-center gap-2 shrink-0">
              <Pressable onPress={() => updateQty(item.product_id, -1)} className="h-8 w-8 rounded-lg bg-ink-100 items-center justify-center">
                <Minus size={14} color="#3D3D42" />
              </Pressable>
              <Text className="w-10 text-center text-sm font-bold text-ink-900">{item.quantity}</Text>
              <Pressable onPress={() => updateQty(item.product_id, 1)} className="h-8 w-8 rounded-lg bg-ink-100 items-center justify-center">
                <Plus size={14} color="#3D3D42" />
              </Pressable>
            </View>

            <Text className="text-sm font-bold text-ink-900 shrink-0 w-20 text-right">{b2bFormatTRY(item.price * item.quantity)}</Text>

            <Pressable onPress={() => removeItem(item.product_id)} className="h-8 w-8 rounded-lg items-center justify-center">
              <Trash2 size={16} color="#9494A0" />
            </Pressable>
          </View>
        ))}
      </View>

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5">
        <Text className="text-sm font-bold text-ink-900 mb-4">Sipariş Özeti</Text>
        <View className="gap-2 mb-4">
          <View className="flex-row justify-between">
            <Text className="text-sm text-ink-400">Ara Toplam</Text>
            <Text className="text-sm font-medium text-ink-900">{b2bFormatTRY(subtotal)}</Text>
          </View>
          <View className="flex-row justify-between">
            <Text className="text-sm text-ink-400">KDV</Text>
            <Text className="text-sm font-medium text-ink-900">{b2bFormatTRY(vatTotal)}</Text>
          </View>
          <View className="border-t border-ink-100 pt-2 flex-row justify-between">
            <Text className="text-sm font-bold text-ink-900">Genel Toplam</Text>
            <Text className="text-lg font-bold text-ex-red">{b2bFormatTRY(total)}</Text>
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">Sipariş Notu</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Opsiyonel not…"
            multiline
            className="rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-sm text-ink-900 min-h-[60px]"
            placeholderTextColor="#9494A0"
          />
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={submitting}
          className="flex-row items-center justify-center gap-2 py-3.5 rounded-xl bg-ex-red active:bg-ex-redDark active:scale-[0.98] disabled:opacity-40"
        >
          {submitting ? (
            <View className="h-5 w-5 rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <>
              <CheckCircle2 size={18} color="#fff" />
              <Text className="text-sm font-semibold text-white">Sipariş Oluştur</Text>
            </>
          )}
        </Pressable>
      </View>
    </B2BScreenWrapper>
  );
}
