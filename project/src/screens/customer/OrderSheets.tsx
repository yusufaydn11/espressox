import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, Image, TextInput as RNTextInput, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { ShoppingBag, Minus, Plus, Trash2, Coffee, UtensilsCrossed, Store, CalendarClock, CreditCard, Check, ChevronRight, Sparkles, MapPin, Tag, Gift } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { fetchCheckoutBenefits, previewCheckout, initiateRetailPayment, type CheckoutBenefit, type CheckoutPreview } from '@/services/checkout/checkoutService';
import { Sheet } from '@/components/ui/Sheet';
import { Button, ButtonRow } from '@/components/ui/Button';
import { formatPrice, cn } from '@/lib/utils';
import { useStores, useCreateOrder } from '@/lib/hooks';
import { mapCartItemsForCheckout } from '@shared/utils/cartCheckout';
import { resolveProductImageUrl } from '@shared/constants/products';
import type { OrderType } from '@/types';

/** Kart/cüzdan ödemesi yalnızca iyzico FAZ1 production deploy sonrası açılmalı. */
const CARD_PAYMENTS_ENABLED = process.env.EXPO_PUBLIC_ENABLE_CARD_PAYMENTS === 'true';

const PAYMENT_METHODS = [
  ...(CARD_PAYMENTS_ENABLED
    ? [
        { id: 'card', label: 'Kredi/Banka Kartı', detail: 'Güvenli ödeme' },
        { id: 'wallet', label: 'Espresso X Cüzdan', detail: 'Mağaza kredisi' },
      ]
    : []),
  { id: 'cash', label: 'Nakit', detail: 'Mağazada öde' },
] as const;

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
  free_coffee_not_available: 'Ücretsiz kahve hakkı bulunamadı.',
  invalid_payment_method: 'Geçersiz ödeme yöntemi.',
  order_failed: 'Sipariş oluşturulamadı.',
  campaign_not_available: 'Kampanya geçersiz veya süresi dolmuş.',
  invalid_store: 'Seçilen mağaza geçersiz.',
  cart_invalid: 'Sepet doğrulanamadı. Sepeti temizleyip ürünleri yeniden ekleyin.',
  preview_failed: 'Sipariş özeti hesaplanamadı.',
};

function formatOrderError(code: string): string {
  if (code.includes('permission denied') || code.includes('42501')) {
    return 'Oturum süresi dolmuş olabilir. Çıkış yapıp tekrar giriş yapın.';
  }
  if (code.includes('JWT')) {
    return 'Oturum geçersiz. Lütfen tekrar giriş yapın.';
  }
  const base = code.split(':')[0]?.trim() ?? code;
  const detail = code.includes(':') ? code.slice(code.indexOf(':') + 1).trim() : '';
  if (ORDER_ERROR_LABELS[base]) {
    return detail ? `${ORDER_ERROR_LABELS[base]} (${detail})` : ORDER_ERROR_LABELS[base];
  }
  return code;
}

function mergeCheckoutPreview(
  preview: CheckoutPreview | null,
  cartTotal: number,
) {
  const valid = preview != null && (preview.subtotal ?? 0) > 0;
  return {
    subtotal: valid ? preview!.subtotal : cartTotal,
    discount: valid ? (preview!.discount ?? 0) : 0,
    total: valid ? preview!.total : cartTotal,
    benefitTitle: valid ? preview!.benefitTitle : null,
    pointsEarned: valid ? (preview!.pointsEarned ?? 0) : 0,
  };
}

export function CartSheet() {
  const { sheet, closeSheet, openSheet, cart, removeFromCart, updateQty, cartTotal, cartPoints } = useApp();
  const { session } = useAuth();
  const { data: stores } = useStores();
  const open = sheet === 'cart';
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);

  const defaultStoreId = stores?.[0]?.id ?? null;

  useEffect(() => {
    if (!open || cart.length === 0 || !session) {
      setPreview(null);
      return;
    }
    const items = mapCartItemsForCheckout(cart);
    const t = setTimeout(() => {
      void previewCheckout({ items, storeId: defaultStoreId }).then(({ preview: p }) => setPreview(p));
    }, 200);
    return () => clearTimeout(t);
  }, [open, cart, session, defaultStoreId]);

  const display = mergeCheckoutPreview(preview, cartTotal);

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
            <Image source={{ uri: resolveProductImageUrl(item.product.image, 200) }} className="h-16 w-16 rounded-xl shrink-0" resizeMode="cover" />
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
        <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Ara toplam</Text><Text className="text-sm text-ink-500">{formatPrice(display.subtotal)}</Text></View>
        {display.discount > 0 && (
          <View className="flex-row justify-between">
            <Text className="text-sm text-green-600">{display.benefitTitle ?? 'İndirim'}</Text>
            <Text className="text-sm text-green-600">−{formatPrice(display.discount)}</Text>
          </View>
        )}
        <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Teslimat</Text><Text className="text-sm text-green-600 font-medium">Ücretsiz</Text></View>
        <View className="flex-row justify-between pt-2 border-t border-ink-100"><Text className="text-sm font-semibold text-ink-900">Toplam</Text><Text className="text-sm font-semibold text-ink-900">{formatPrice(display.total)}</Text></View>
      </View>

      <Button variant="gold" size="lg" full onPress={() => openSheet('checkout')}>
        Ödemeye geç · {formatPrice(display.total)}
      </Button>
    </Sheet>
  );
}

export function CheckoutSheet() {
  const { sheet, closeSheet, openSheet, cart, cartTotal, clearCart, showToast, setLastOrder } = useApp();
  const { profile, session } = useAuth();
  const open = sheet === 'checkout';
  const [orderType, setOrderType] = useState<OrderType>('pickup');
  const [store, setStore] = useState('');
  const [payment, setPayment] = useState<string>(CARD_PAYMENTS_ENABLED ? 'card' : 'cash');
  const [placing, setPlacing] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [benefits, setBenefits] = useState<CheckoutBenefit[]>([]);
  const [selectedBenefit, setSelectedBenefit] = useState<CheckoutBenefit | null>(null);
  const [preview, setPreview] = useState<CheckoutPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cardHolderName, setCardHolderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpireMonth, setCardExpireMonth] = useState('');
  const [cardExpireYear, setCardExpireYear] = useState('');
  const [cardCvc, setCardCvc] = useState('');
  const { data: stores, loading: storesLoading, error: storesError } = useStores();
  const createOrder = useCreateOrder();
  const placingLockRef = useRef(false);

  const storeList = stores ?? [];
  const effectiveStoreId = store || storeList[0]?.id || '';
  const selectedStore = storeList.find(s => s.id === effectiveStoreId) ?? storeList[0];

  useEffect(() => {
    if (!open || storeList.length === 0) return;
    if (!store || !storeList.some(s => s.id === store)) {
      setStore(storeList[0].id);
    }
  }, [open, storeList, store]);

  const loadPreview = useCallback(async () => {
    if (!selectedStore || cart.length === 0) return;
    const items = mapCartItemsForCheckout(cart);
    if (items.length === 0) {
      setPreviewError('cart_invalid');
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    const { preview: p, error } = await previewCheckout({
      items,
      storeId: selectedStore.id,
      couponCode: couponCode.trim() || null,
      benefitType: selectedBenefit?.type ?? null,
      benefitId: selectedBenefit?.id ?? null,
    });
    setPreviewLoading(false);
    if (error) {
      setPreviewError(error);
      setPreview(null);
      return;
    }
    setPreviewError(null);
    setPreview(p);
  }, [cart, selectedStore, couponCode, selectedBenefit]);

  useEffect(() => {
    if (!open) {
      setSelectedBenefit(null);
      setCouponCode('');
      setPreview(null);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !selectedStore) return;
    void fetchCheckoutBenefits(selectedStore.id).then(({ benefits: b }) => setBenefits(b));
  }, [open, selectedStore]);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { void loadPreview(); }, 300);
    return () => clearTimeout(t);
  }, [open, loadPreview]);

  const display = mergeCheckoutPreview(preview, cartTotal);

  const orderTypes = [
    { id: 'pickup' as const, label: 'Gel-Al', icon: Store, desc: 'Al & götür' },
    { id: 'table' as const, label: 'Masa', icon: UtensilsCrossed, desc: 'Yerinde iç' },
    { id: 'delivery' as const, label: 'Teslimat', icon: Coffee, desc: 'Kapına gelir' },
    { id: 'scheduled' as const, label: 'Planla', icon: CalendarClock, desc: 'Zaman seç' },
  ];

  const placeOrder = async () => {
    if (placingLockRef.current || placing) return;
    if (cart.length === 0) return;
    if (!session) {
      showToast('Sipariş vermek için giriş yapmalısınız');
      return;
    }
    if (storesLoading) {
      showToast('Mağazalar yükleniyor, lütfen bekleyin');
      return;
    }
    if (!selectedStore) {
      showToast(storesError ? 'Mağaza listesi yüklenemedi' : 'Sipariş için mağaza seçin veya mağaza listesini kontrol edin');
      return;
    }
    if (profile?.is_blocked) {
      showToast('Hesabınız engellenmiştir');
      return;
    }
    const items = mapCartItemsForCheckout(cart);
    if (items.length === 0) {
      showToast('Sepet doğrulanamadı. Sepeti temizleyip menüden tekrar ekleyin.');
      return;
    }
    if (payment === 'card') {
      if (!cardHolderName.trim() || cardNumber.replace(/\s/g, '').length < 12
        || !cardExpireMonth.trim() || !cardExpireYear.trim() || cardCvc.length < 3) {
        showToast('Kart bilgilerini eksiksiz girin');
        return;
      }
    }

    const { preview: freshPreview, error: previewErr } = await previewCheckout({
      items,
      storeId: selectedStore.id,
      couponCode: couponCode.trim() || null,
      benefitType: selectedBenefit?.type ?? null,
      benefitId: selectedBenefit?.id ?? null,
    });
    if (previewErr) {
      setPreviewError(previewErr);
      showToast('Sipariş başarısız: ' + formatOrderError(previewErr));
      return;
    }
    if (!freshPreview || freshPreview.subtotal <= 0) {
      showToast('Sepetteki ürün doğrulanamadı. Sepeti temizleyip menüden tekrar ekleyin.');
      return;
    }
    setPreview(freshPreview);
    setPreviewError(null);
    const orderTotal = freshPreview.total;

    placingLockRef.current = true;
    setPlacing(true);
    try {
      const { error, orderNumber, pointsEarned, total, billingType, benefitTitle, paymentStatus, orderStatus } = await createOrder({
        items,
        total: orderTotal,
        storeId: selectedStore.id,
        storeName: selectedStore.name,
        orderType,
        paymentMethod: payment,
        couponCode: couponCode.trim() || null,
        benefitType: selectedBenefit?.type ?? null,
        benefitId: selectedBenefit?.id ?? null,
      });
      if (error) {
        showToast('Sipariş başarısız: ' + formatOrderError(error));
        return;
      }
      const resolvedStatus = orderStatus ?? 'payment_pending';
      const isPendingPayment = paymentStatus === 'pending' || resolvedStatus === 'payment_pending';
      setLastOrder({
        orderNumber: orderNumber ?? '—',
        storeName: selectedStore.name,
        status: resolvedStatus,
        pointsEarned: isPendingPayment ? 0 : (pointsEarned ?? 0),
        total: total ?? orderTotal,
        billingType,
        benefitTitle,
        paymentPending: isPendingPayment,
        paymentMethod: payment,
      });
      clearCart();
      if (isPendingPayment && payment === 'card' && orderNumber) {
        const pay = await initiateRetailPayment(orderNumber, {
          cardHolderName: cardHolderName.trim(),
          cardNumber: cardNumber.replace(/\s/g, ''),
          expireMonth: cardExpireMonth.trim(),
          expireYear: cardExpireYear.trim(),
          cvc: cardCvc.trim(),
        });
        if (pay.error) {
          showToast('Sipariş oluşturuldu. Ödeme başlatılamadı — sipariş takibinden tekrar deneyebilirsiniz.');
        } else if (pay.threeDSPageUrl) {
          showToast('3D Secure doğrulamasına yönlendiriliyorsunuz…');
          if (Platform.OS === 'web' && typeof globalThis.window !== 'undefined') {
            globalThis.window.open(pay.threeDSPageUrl, '_blank', 'noopener,noreferrer');
          } else {
            await WebBrowser.openBrowserAsync(pay.threeDSPageUrl, {
              dismissButtonStyle: 'close',
              showInRecents: true,
            });
          }
        }
      } else if (isPendingPayment && payment !== 'cash') {
        showToast('Sipariş oluşturuldu. Ödeme onayı bekleniyor.');
      } else if (isPendingPayment) {
        showToast('Sipariş oluşturuldu. Mağazada ödeme yapabilirsiniz.');
      } else {
        showToast('Sipariş alındı! Puan kazanıyorsun…');
      }
      openSheet('tracking');
    } finally {
      placingLockRef.current = false;
      setPlacing(false);
    }
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

      {(orderType === 'pickup' || orderType === 'table' || orderType === 'delivery') && storeList.length > 0 && (
        <View className="mb-5">
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">Mağaza</Text>
          {storesError ? (
            <Text className="text-xs text-ex-red mb-2">Mağaza listesi yüklenemedi. Sayfayı yenileyip tekrar deneyin.</Text>
          ) : null}
          <View className="gap-2">
            {storeList.slice(0, 3).map(s => (
              <SelectCard key={s.id} selected={effectiveStoreId === s.id} onPress={() => setStore(s.id)}>
                <MapPin size={16} color={effectiveStoreId === s.id ? '#C8102E' : '#9494A0'} />
                <View className="flex-1">
                  <Text className="text-sm font-medium text-ink-900">{s.name}</Text>
                  <Text className="text-[11px] text-ink-400">{s.hours}</Text>
                </View>
                {effectiveStoreId === s.id && <Check size={16} color="#C8102E" />}
              </SelectCard>
            ))}
          </View>
        </View>
      )}

      {storeList.length === 0 && !storesLoading && (
        <View className="mb-5 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
          <Text className="text-xs text-ex-red">Mağaza bulunamadı. Sipariş verilemiyor.</Text>
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
        {PAYMENT_METHODS.map(pm => (
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

      {payment === 'card' && (
        <View className="mb-5 gap-2">
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-1">Kart bilgileri</Text>
          <View className="px-4 py-3 rounded-2xl border border-ink-100 bg-white">
            <RNTextInput
              value={cardHolderName}
              onChangeText={setCardHolderName}
              placeholder="Kart üzerindeki isim"
              placeholderTextColor="#9494A0"
              autoCapitalize="words"
              className="text-sm text-ink-900"
            />
          </View>
          <View className="px-4 py-3 rounded-2xl border border-ink-100 bg-white">
            <RNTextInput
              value={cardNumber}
              onChangeText={setCardNumber}
              placeholder="Kart numarası"
              placeholderTextColor="#9494A0"
              keyboardType="number-pad"
              maxLength={19}
              className="text-sm text-ink-900"
            />
          </View>
          <View className="flex-row gap-2">
            <View className="flex-1 px-4 py-3 rounded-2xl border border-ink-100 bg-white">
              <RNTextInput
                value={cardExpireMonth}
                onChangeText={setCardExpireMonth}
                placeholder="AA"
                placeholderTextColor="#9494A0"
                keyboardType="number-pad"
                maxLength={2}
                className="text-sm text-ink-900"
              />
            </View>
            <View className="flex-1 px-4 py-3 rounded-2xl border border-ink-100 bg-white">
              <RNTextInput
                value={cardExpireYear}
                onChangeText={setCardExpireYear}
                placeholder="YY"
                placeholderTextColor="#9494A0"
                keyboardType="number-pad"
                maxLength={4}
                className="text-sm text-ink-900"
              />
            </View>
            <View className="flex-1 px-4 py-3 rounded-2xl border border-ink-100 bg-white">
              <RNTextInput
                value={cardCvc}
                onChangeText={setCardCvc}
                placeholder="CVC"
                placeholderTextColor="#9494A0"
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                className="text-sm text-ink-900"
              />
            </View>
          </View>
        </View>
      )}

      <View className="gap-2 mb-5">
        {previewError ? (
          <View className="px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
            <Text className="text-xs text-ex-red">{formatOrderError(previewError)}</Text>
          </View>
        ) : null}
        <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Ara toplam</Text><Text className="text-sm text-ink-500">{formatPrice(display.subtotal)}</Text></View>
        {display.discount > 0 && (
          <View className="flex-row justify-between"><Text className="text-sm text-green-600">İndirim</Text><Text className="text-sm text-green-600">−{formatPrice(display.discount)}</Text></View>
        )}
        {display.pointsEarned > 0 && (
          <View className="flex-row justify-between"><Text className="text-sm text-ink-500">Kazanılacak puan</Text><Text className="text-sm text-ex-red font-medium">+{display.pointsEarned}</Text></View>
        )}
        <View className="flex-row justify-between pt-2 border-t border-ink-100"><Text className="text-sm font-semibold text-ink-900">Toplam</Text><Text className="text-sm font-semibold text-ink-900">{formatPrice(display.total)}</Text></View>
      </View>

      <Button variant="gold" size="lg" full onPress={placeOrder} disabled={placing || previewLoading || storesLoading || cart.length === 0 || !!previewError || !selectedStore}>
        {placing ? 'Sipariş alınıyor…' : storesLoading ? 'Mağazalar yükleniyor…' : previewLoading ? 'Hesaplanıyor…' : !selectedStore ? 'Mağaza bekleniyor…' : `Sipariş ver · ${formatPrice(display.total)}`}
      </Button>
    </Sheet>
  );
}

export function TrackingSheet() {
  const { sheet, closeSheet, lastOrder } = useApp();
  const open = sheet === 'tracking';
  const status = lastOrder?.status ?? 'payment_pending';
  const paymentPending = lastOrder?.paymentPending ?? status === 'payment_pending';

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
    { label: 'Teslim', desc: paymentPending ? 'Ödeme sonrası puan yüklenecek' : (lastOrder?.pointsEarned ? `+${lastOrder.pointsEarned} puan` : 'Afiyet olsun!'), done: false },
  ] : [
    { label: 'Sipariş alındı', desc: lastOrder?.storeName ?? 'Mağaza', done: true },
    { label: 'Hazırlanıyor', desc: 'Barista ekibimiz hazırlıyor', done: stepIndex >= 0, current: status === 'preparing' },
    { label: 'Alış için hazır', desc: 'Hazır olunca bildirim alacaksın', done: stepIndex >= 1, current: status === 'ready' },
    { label: 'Teslim edildi', desc: lastOrder?.pointsEarned ? `+${lastOrder.pointsEarned} puan yüklendi` : 'Afiyet olsun!', done: stepIndex >= 2, current: status === 'delivered' || status === 'picked-up' },
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
            : (lastOrder?.pointsEarned ? `+${lastOrder.pointsEarned} puan kazandın` : 'Siparişin işleniyor')}
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
