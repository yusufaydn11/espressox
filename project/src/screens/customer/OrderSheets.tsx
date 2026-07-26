import { useState } from 'react';
import { View, Text, Pressable, Image, Linking } from 'react-native';
import { ShoppingBag, Minus, Plus, Trash2, Coffee, UtensilsCrossed, Store, CalendarClock, CreditCard, Check, ChevronRight, Sparkles, MapPin, Navigation, Clock, Wifi, Car, Phone, MessageCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { formatPrice, cn } from '@/lib/utils';
import { useStores, useCreateOrder } from '@/lib/hooks';
import type { OrderType } from '@/types';
import type { Store as StoreType } from '@/lib/supabase';

export function CartSheet() {
  const { sheet, closeSheet, openSheet, cart, removeFromCart, updateQty, cartTotal, cartPoints } = useApp();
  const open = sheet === 'cart';

  if (cart.length === 0) {
    return (
      <Sheet open={open} onClose={closeSheet} title="Siparişin">
        <View className="py-12 items-center">
          <View className="h-20 w-20 rounded-full bg-ink-50 items-center justify-center mb-4">
            <ShoppingBag size={32} color="#C4C4CC" />
          </View>
          <Text className="text-xl font-bold text-ink-900">Sepetin boş</Text>
          <Text className="text-sm text-ink-400 mt-1 mb-5">Başlamak için bir şeyler ekle</Text>
          <Button variant="gold" onPress={closeSheet}>Menüye göz at</Button>
        </View>
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onClose={closeSheet} title={`Siparişin · ${cart.length} ürün`}>
      <View className="gap-3 mb-5">
        {cart.map(item => (
          <View key={item.id} className="flex-row gap-3 p-3 rounded-2xl bg-white border border-ink-100">
            <Image source={{ uri: item.product.image }} className="h-16 w-16 rounded-xl shrink-0" resizeMode="cover" />
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-semibold text-ink-900 leading-tight">{item.product.name}</Text>
              <Text className="text-[11px] text-ink-400 mt-0.5" numberOfLines={1}>
                {item.size.label} · {item.milk.label}
                {item.syrup && item.syrup.id !== 'none' ? ` · ${item.syrup.label}` : ''}
                {item.extraEspresso > 0 ? ` · +${item.extraEspresso} shot` : ''}
              </Text>
              {item.notes ? <Text className="text-[11px] italic text-ex-red mt-0.5">"{item.notes}"</Text> : null}
              <View className="flex-row items-center justify-between mt-2">
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={() => updateQty(item.id, item.quantity - 1)} className="h-6 w-6 rounded-full bg-ink-100 items-center justify-center"><Minus size={12} color="#525258" /></Pressable>
                  <Text className="text-xs font-semibold text-ink-900">{item.quantity}</Text>
                  <Pressable onPress={() => updateQty(item.id, item.quantity + 1)} className="h-6 w-6 rounded-full bg-ink-900 items-center justify-center"><Plus size={12} color="#fff" /></Pressable>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm font-semibold text-ex-red">{formatPrice(item.unitPrice * item.quantity)}</Text>
                  <Pressable onPress={() => removeFromCart(item.id)}><Trash2 size={15} color="#C4C4CC" /></Pressable>
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View className="flex-row items-center gap-2 px-4 py-3 rounded-2xl bg-red-50 mb-5">
        <Sparkles size={16} color="#C8102E" />
        <Text className="text-xs text-ink-700">Bu siparişle <Text className="font-bold text-ex-red">{cartPoints} puan</Text> kazanacaksın</Text>
      </View>

      <View className="gap-2 mb-5">
        <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Ara toplam</Text><Text className="text-sm text-ink-500">{formatPrice(cartTotal)}</Text></View>
        <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Teslimat</Text><Text className="text-sm text-green-600 font-medium">Ücretsiz</Text></View>
        <View className="flex-row justify-between pt-2 border-t border-ink-100"><Text className="text-sm font-semibold text-ink-900">Toplam</Text><Text className="text-sm font-semibold text-ink-900">{formatPrice(cartTotal)}</Text></View>
      </View>

      <Button variant="gold" size="lg" full onPress={() => openSheet('checkout')}>
        Ödemeye geç · {formatPrice(cartTotal)}
      </Button>
    </Sheet>
  );
}

export function CheckoutSheet() {
  const { sheet, closeSheet, openSheet, cart, cartTotal, clearCart, showToast } = useApp();
  const open = sheet === 'checkout';
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [store, setStore] = useState('');
  const [payment, setPayment] = useState('card');
  const [placing, setPlacing] = useState(false);
  const { data: stores } = useStores();
  const createOrder = useCreateOrder();

  const storeList = stores ?? [];
  const selectedStore = storeList.find(s => s.id === store) ?? storeList[0];

  const orderTypes = [
    { id: 'pickup' as const, label: 'Gel-Al', icon: Store, desc: 'Al & götür' },
    { id: 'table' as const, label: 'Masa', icon: UtensilsCrossed, desc: 'Yerinde iç' },
    { id: 'delivery' as const, label: 'Teslimat', icon: Coffee, desc: 'Kapına gelir' },
    { id: 'scheduled' as const, label: 'Planla', icon: CalendarClock, desc: 'Zaman seç' },
  ];

  const placeOrder = async () => {
    if (!selectedStore || cart.length === 0) return;
    setPlacing(true);
    const { error } = await createOrder({
      items: cart.map(item => ({
        name: `${item.product.name} — ${item.size.label}${item.milk.id !== 'whole' ? ', ' + item.milk.label : ''}`,
        qty: item.quantity, price: item.unitPrice, productId: item.product.id,
      })),
      total: cartTotal, storeId: selectedStore.id, storeName: selectedStore.name, orderType,
    });
    setPlacing(false);
    if (error) { showToast('Sipariş başarısız: ' + error); return; }
    clearCart();
    showToast('Sipariş alındı! Puan kazanıyorsun…');
    openSheet('tracking');
  };

  const SelectCard = ({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: React.ReactNode }) => (
    <Pressable
      onPress={onPress}
      className={cn('flex-row items-center gap-3 px-4 py-3 rounded-2xl border active:opacity-80', selected ? 'border-ex-red bg-red-50' : 'border-ink-100')}
    >
      {children}
    </Pressable>
  );

  return (
    <Sheet open={open} onClose={closeSheet} title="Ödeme">
      <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">Sipariş türü</Text>
      <View className="flex-row gap-2 mb-5">
        {orderTypes.map(({ id, label, icon: Icon }) => (
          <Pressable
            key={id}
            onPress={() => setOrderType(id)}
            className={cn('flex-1 items-center gap-1.5 p-3 rounded-2xl border active:opacity-80', orderType === id ? 'border-ex-red bg-red-50' : 'border-ink-100')}
          >
            <Icon size={18} color={orderType === id ? '#C8102E' : '#9494A0'} />
            <Text className={cn('text-[11px] font-medium', orderType === id ? 'text-ink-900' : 'text-ink-500')}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {(orderType === 'pickup' || orderType === 'table') && storeList.length > 0 && (
        <View className="mb-5">
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">Mağaza</Text>
          <View className="gap-2">
            {storeList.slice(0, 3).map(s => (
              <SelectCard key={s.id} selected={(store || storeList[0]?.id) === s.id} onPress={() => setStore(s.id)}>
                <MapPin size={16} color={(store || storeList[0]?.id) === s.id ? '#C8102E' : '#9494A0'} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-ink-900">{s.name}</Text>
                  <Text className="text-[11px] text-ink-400">{s.hours}</Text>
                </View>
                {(store || storeList[0]?.id) === s.id && <Check size={16} color="#C8102E" />}
              </SelectCard>
            ))}
          </View>
        </View>
      )}

      {orderType === 'scheduled' && (
        <View className="mb-5">
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">Alış saati</Text>
          <View className="flex-row flex-wrap gap-2">
            {['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'].map(t => (
              <Pressable key={t} className="px-3 py-2.5 rounded-xl border border-ink-100 active:bg-red-50">
                <Text className="text-xs text-ink-600">{t}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">Ödeme yöntemi</Text>
      <View className="gap-2 mb-5">
        {[
          { id: 'card', label: 'Kredi/Banka Kartı', detail: 'Güvenli ödeme' },
          { id: 'wallet', label: 'Espresso X Cüzdan', detail: 'Mağaza kredisi' },
          { id: 'cash', label: 'Nakit', detail: 'Mağazada öde' },
        ].map(pm => (
          <SelectCard key={pm.id} selected={payment === pm.id} onPress={() => setPayment(pm.id)}>
            <CreditCard size={18} color={payment === pm.id ? '#C8102E' : '#9494A0'} />
            <View className="flex-1">
              <Text className="text-sm font-medium text-ink-900">{pm.label}</Text>
              <Text className="text-[11px] text-ink-400">{pm.detail}</Text>
            </View>
            {payment === pm.id && <Check size={16} color="#C8102E" />}
          </SelectCard>
        ))}
      </View>

      <View className="flex-row justify-between pt-3 border-t border-ink-100 mb-5">
        <Text className="text-sm font-semibold text-ink-900">Toplam</Text>
        <Text className="text-sm font-semibold text-ink-900">{formatPrice(cartTotal)}</Text>
      </View>

      <Button variant="gold" size="lg" full onPress={placeOrder} disabled={placing || cart.length === 0}>
        {placing ? 'Sipariş alınıyor…' : `Sipariş ver · ${formatPrice(cartTotal)}`}
      </Button>
    </Sheet>
  );
}

export function TrackingSheet() {
  const { sheet, closeSheet } = useApp();
  const open = sheet === 'tracking';
  const steps = [
    { label: 'Sipariş alındı', desc: 'Nişantaşı Mağaza', done: true },
    { label: 'İçecekler hazırlanıyor', desc: 'Noah hazırlıyor', done: true, current: true },
    { label: 'Alış için hazır', desc: 'Sana haber vereceğiz', done: false },
    { label: 'Afiyet olsun!', desc: 'Yudumla & tadını çıkar', done: false },
  ];

  return (
    <Sheet open={open} onClose={closeSheet} title="Sipariş takibi">
      <View className="items-center mb-6">
        <Text className="text-xs text-ink-400">Sipariş EX-10473</Text>
        <Text className="text-2xl font-bold text-ink-900">Hazırlanıyor</Text>
        <Text className="text-sm text-ex-red mt-1 font-medium">~4 dakika içinde hazır</Text>
      </View>

      <View className="items-center mb-6">
        <View className="h-32 w-32 rounded-full bg-cream-100 items-center justify-center">
          <Coffee size={40} color="#C8102E" />
        </View>
      </View>

      <View className="gap-4">
        {steps.map((step, i) => (
          <View key={i} className="flex-row gap-3">
            <View className="items-center">
              <View className={cn('h-8 w-8 rounded-full items-center justify-center shrink-0', step.done ? 'bg-ex-red' : 'bg-ink-100')}>
                {step.done ? <Check size={14} color="#fff" /> : <Text className="text-[10px] font-bold text-ink-400">{i + 1}</Text>}
              </View>
              {i < steps.length - 1 && <View className={cn('w-0.5 h-8 mt-1', step.done ? 'bg-ex-red' : 'bg-ink-100')} />}
            </View>
            <View className="pt-1">
              <Text className={cn('text-sm font-medium', step.done ? 'text-ink-900' : 'text-ink-400')}>{step.label}</Text>
              <Text className="text-[11px] text-ink-400">{step.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View className="mt-6 flex-row gap-3">
        <Button variant="outline" full onPress={closeSheet}>Kapat</Button>
        <Button variant="gold" full>Mağazayla iletişim <ChevronRight size={16} /></Button>
      </View>
    </Sheet>
  );
}
