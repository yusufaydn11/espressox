import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Image, TextInput as RNTextInput } from 'react-native';
import { ShoppingBag, Minus, Plus, Trash2, Coffee, UtensilsCrossed, Store, CalendarClock, CreditCard, Check, ChevronRight, Sparkles, MapPin, Tag, Gift } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { fetchOrderByNumber } from '@/services/orders/orderService';
import { fetchCheckoutBenefits, previewCheckout, type CheckoutBenefit, type CheckoutPreview } from '@/services/checkout/checkoutService';
import { Sheet } from '@/components/ui/Sheet';
import { Button, ButtonRow } from '@/components/ui/Button';
import { formatPrice, cn } from '@/lib/utils';
import { useStores, useCreateOrder } from '@/lib/hooks';
import type { OrderType } from '@/types';

const ORDER_ERROR_LABELS: Record<string, string> = {
  account_blocked: 'Hesabınız engellenmiştir. Destek ile iletişime geçin.',
  unauthenticated: 'Giriş yapmalısınız.',
  invalid_order_type: 'Geçersiz sipariş türü.',
  empty_cart: 'Sepetiniz boş.',
  cart_too_large: 'Sepette çok fazla ürün var.',
  missing_product_id: 'Ürün bilgisi eksik.',
  invalid_quantity: 'Geçersiz ürün adedi.',
  product_unavailable: 'Ürün mevcut değil veya stokta yok.',
  price_tamper: 'Fiyat doğrulaması başarısız.',
  invalid_total: 'Geçersiz sipariş tutarı.',
  coupon_not_found: 'Kupon bulunamadı.',
  coupon_expired: 'Kupon süresi dolmuş.',
  coupon_min_order: 'Minimum sepet tutarı karşılanmıyor.',
  coupon_user_limit: 'Bu kuponu daha önce kullandınız.',
  insufficient_stamps: 'Yeterli damga yok.',
  reward_not_available: 'Ödül kullanılamıyor.',
  tier_benefit_not_available: 'Seviye avantajı kullanılamıyor.',
};

function formatOrderError(code: string): string {
  return ORDER_ERROR_LABELS[code] ?? code;
}

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
  const { sheet, closeSheet, openSheet, cart, cartTotal, clearCart, showToast, setLastOrder } = useApp();
  const { profile } = useAuth();
  const open = sheet === 'checkout';
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [store, setStore] = useState('');
  const [payment, setPayment] = useState('card');
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [benefits, setBenefits] = useState<CheckoutBenefit[]>([]);
  const [selectedBenefit, setSelectedBenefit] = useState<CheckoutBenefit | null>(null);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const { data: stores } = useStores();
  const createOrder = useCreateOrder();

  const storeList = stores ?? [];
  const selectedStore = storeList.find(s => s.id === store) ?? storeList[0];

  const orderItems = cart.map(item => ({
    name: `${item.product.name} — ${item.size.label}${item.milk.id !== 'whole' ? ', ' + item.milk.label : ''}`,
    qty: item.quantity, price: item.unitPrice, productId: item.product.id,
  }));

  const loadPreview = useCallback(async () => {
    if (!selectedStore || cart.length === 0) return;
    const items = cart.map(item => ({
      name: `${item.product.name} — ${item.size.label}${item.milk.id !== 'whole' ? ', ' + item.milk.label : ''}`,
      qty: item.quantity, price: item.unitPrice, productId: item.product.id,
    }));
    const { preview: p } = await previewCheckout({
      items,
      storeId: selectedStore.id,
      couponCode: couponCode.trim() || null,
      benefitType: selectedBenefit?.type ?? null,
      benefitId: selectedBenefit?.id ?? null,
    });
    setPreview(p);
  }, [cart, selectedStore, couponCode, selectedBenefit]);

  useEffect(() => {
    if (!open || !selectedStore) return;
    void fetchCheckoutBenefits(selectedStore.id).then(({ benefits: b }) => setBenefits(b));
  }, [open, selectedStore]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void loadPreview(); }, 300);
    return () => clearTimeout(t);
  }, [open, loadPreview]);

  const displayTotal = preview?.total ?? cartTotal;
  const displayDiscount = preview?.discount ?? 0;
  const displayPoints = preview?.pointsEarned ?? 0;

  const orderTypes = [
    { id: 'pickup' as const, label: 'Gel-Al', icon: Store, desc: 'Al & götür' },
    { id: 'table' as const, label: 'Masa', icon: UtensilsCrossed, desc: 'Yerinde iç' },
    { id: 'delivery' as const, label: 'Teslimat', icon: Coffee, desc: 'Kapına gelir' },
    { id: 'scheduled' as const, label: 'Planla', icon: CalendarClock, desc: 'Zaman seç' },
  ];

  const placeOrder = async () => {
    if (cart.length === 0) return;
    if (!selectedStore) {
      showToast('Sipariş için mağaza seçin veya mağaza listesini kontrol edin');
      return;
    }
    if (profile?.is_blocked) {
      showToast('Hesabınız engellenmiştir');
      return;
    }
    setPlacing(true);
    const { error, orderNumber, pointsEarned, total, billingType, benefitTitle, paymentStatus, orderStatus } = await createOrder({
      items: orderItems,
      total: cartTotal,
      storeId: selectedStore.id,
      storeName: selectedStore.name,
      orderType,
      paymentMethod: payment,
      couponCode: couponCode.trim() || null,
      benefitType: selectedBenefit?.type ?? null,
      benefitId: selectedBenefit?.id ?? null,
    });
    setPlacing(false);
    if (error) { showToast('Sipariş başarısız: ' + formatOrderError(error)); return; }
    const resolvedStatus = orderStatus ?? 'payment_pending';
    const isPendingPayment = paymentStatus === 'pending' || resolvedStatus === 'payment_pending';
    setLastOrder({
      orderNumber: orderNumber ?? '—',
      storeName: selectedStore.name,
      status: resolvedStatus,
      pointsEarned: pointsEarned ?? 0,
      total: total ?? displayTotal,
      billingType,
      benefitTitle,
      paymentPending: isPendingPayment,
      paymentMethod: payment,
    });
    clearCart();
    if (isPendingPayment && payment !== 'cash') {
      showToast('Sipariş oluşturuldu. Ödeme sağlayıcısı henüz yapılandırılmadı — ödeme onayı bekleniyor.');
    } else if (isPendingPayment) {
      showToast('Sipariş oluşturuldu. Mağazada ödeme yapabilirsiniz.');
    } else {
      showToast('Sipariş alındı! Puan kazanıyorsun…');
    }
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

      {benefits.length > 0 && (
        <View className="mb-5">
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">Avantaj / Ödül</Text>
          <View className="gap-2">
            <SelectCard selected={!selectedBenefit} onPress={() => setSelectedBenefit(null)}>
              <Gift size={16} color={!selectedBenefit ? '#C8102E' : '#9494A0'} />
              <View className="flex-1"><Text className="text-sm font-medium text-ink-900">Avantaj kullanma</Text></View>
              {!selectedBenefit && <Check size={16} color="#C8102E" />}
            </SelectCard>
            {benefits.map(b => (
              <SelectCard key={`${b.type}-${b.id}`} selected={selectedBenefit?.id === b.id} onPress={() => setSelectedBenefit(b)}>
                <Sparkles size={16} color={selectedBenefit?.id === b.id ? '#C8102E' : '#9494A0'} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-ink-900">{b.title}</Text>
                  {b.detail ? <Text className="text-[11px] text-ink-400">{b.detail}</Text> : null}
                </View>
                {selectedBenefit?.id === b.id && <Check size={16} color="#C8102E" />}
              </SelectCard>
            ))}
          </View>
        </View>
      )}

      <View className="mb-5">
        <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">Kupon kodu</Text>
        <View className="flex-row items-center gap-3 px-4 py-3 rounded-2xl border border-ink-100 bg-white">
          <Tag size={16} color="#9494A0" />
          <RNTextInput
            value={couponCode}
            onChangeText={setCouponCode}
            placeholder="Kupon kodunu gir"
            placeholderTextColor="#9494A0"
            autoCapitalize="characters"
            className="flex-1 text-sm text-ink-900"
          />
        </View>
      </View>

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

      <View className="gap-2 mb-5">
        <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Ara toplam</Text><Text className="text-sm text-ink-500">{formatPrice(preview?.subtotal ?? cartTotal)}</Text></View>
        {displayDiscount > 0 && (
          <View className="flex-row justify-between"><Text className="text-sm text-green-600">İndirim</Text><Text className="text-sm text-green-600">−{formatPrice(displayDiscount)}</Text></View>
        )}
        {displayPoints > 0 && (
          <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Kazanılacak puan</Text><Text className="text-sm text-ex-red font-medium">+{displayPoints}</Text></View>
        )}
        <View className="flex-row justify-between pt-2 border-t border-ink-100"><Text className="text-sm font-semibold text-ink-900">Toplam</Text><Text className="text-sm font-semibold text-ink-900">{formatPrice(displayTotal)}</Text></View>
      </View>

      <Button variant="gold" size="lg" full onPress={placeOrder} disabled={placing || cart.length === 0}>
        {placing ? 'Sipariş alınıyor…' : `Sipariş ver · ${formatPrice(displayTotal)}`}
      </Button>
    </Sheet>
  );
}

export function TrackingSheet() {
  const { sheet, closeSheet, lastOrder, setLastOrder } = useApp();
  const open = sheet === 'tracking';
  const status = lastOrder?.status ?? 'payment_pending';
  const paymentPending = lastOrder?.paymentPending ?? status === 'payment_pending';

  useEffect(() => {
    if (!open || !lastOrder?.orderNumber) return;
    const poll = () => {
      void fetchOrderByNumber(lastOrder.orderNumber).then(({ data }) => {
        if (!data) return;
        setLastOrder({
          orderNumber: data.order_number,
          storeName: data.store_name,
          status: data.status,
          pointsEarned: data.points_earned,
          paymentPending: data.status === 'payment_pending' || data.payment_status === 'pending',
          paymentMethod: lastOrder.paymentMethod,
        });
      });
    };
    poll();
    const id = setInterval(poll, 8000);
    return () => clearInterval(id);
  }, [open, lastOrder?.orderNumber, lastOrder?.paymentMethod, setLastOrder]);

  const statusTitle = paymentPending ? 'Ödeme bekleniyor'
    : status === 'preparing' ? 'Hazırlanıyor'
    : status === 'ready' ? 'Hazır'
    : status === 'picked-up' ? 'Teslim Alındı'
    : status === 'delivered' ? 'Teslim Edildi'
    : status === 'confirmed' ? 'Sipariş onaylandı'
    : 'Sipariş oluşturuldu';

  const stepIndex = ['preparing', 'ready', 'picked-up', 'delivered'].indexOf(status);

  const steps = paymentPending ? [
    { label: 'Sipariş oluşturuldu', desc: lastOrder?.storeName ?? 'Mağaza', done: true },
    { label: 'Ödeme bekleniyor', desc: lastOrder?.paymentMethod === 'cash' ? 'Mağazada öde' : 'Ödeme onayı gerekli', done: false, current: true },
    { label: 'Hazırlanıyor', desc: 'Ödeme sonrası başlayacak', done: false },
    { label: 'Teslim', desc: lastOrder?.pointsEarned ? `+${lastOrder.pointsEarned} puan` : 'Afiyet olsun!', done: false },
  ] : [
    { label: 'Sipariş alındı', desc: lastOrder?.storeName ?? 'Mağaza', done: true },
    { label: 'Hazırlanıyor', desc: 'Barista ekibimiz hazırlıyor', done: stepIndex >= 0, current: status === 'preparing' },
    { label: 'Alış için hazır', desc: 'Hazır olunca bildirim alacaksın', done: stepIndex >= 1, current: status === 'ready' },
    { label: 'Teslim edildi', desc: lastOrder?.pointsEarned ? `+${lastOrder.pointsEarned} puan yüklendi` : 'Afiyet olsun!', done: stepIndex >= 3, current: status === 'delivered' || status === 'picked-up' },
  ];

  return (
    <Sheet open={open} onClose={closeSheet} title="Sipariş takibi">
      <View className="items-center mb-6">
        <Text className="text-xs text-ink-400">{lastOrder ? `Sipariş ${lastOrder.orderNumber}` : 'Sipariş takibi'}</Text>
        <Text className="text-2xl font-bold text-ink-900">{statusTitle}</Text>
        <Text className="text-sm text-ex-red mt-1 font-medium">
          {paymentPending
            ? (lastOrder?.paymentMethod === 'cash'
              ? 'Mağazada ödeme yapabilirsiniz'
              : 'Ödeme sağlayıcısı yapılandırılana kadar onay bekleniyor')
            : lastOrder?.pointsEarned ? `+${lastOrder.pointsEarned} puan kazandın` : 'Siparişin işleniyor'}
        </Text>
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

      <ButtonRow className="mt-6">
        <Button variant="outline" flex onPress={closeSheet}>Kapat</Button>
        <Button variant="gold" flex onPress={closeSheet}>Mağazayla iletişim <ChevronRight size={16} /></Button>
      </ButtonRow>
    </Sheet>
  );
}
