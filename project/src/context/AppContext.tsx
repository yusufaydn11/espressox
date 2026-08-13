import {
  createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode,
} from 'react';
import { Platform, AppState as RNAppState } from 'react-native';
import type { CartItem, Product, ProductOption } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { fetchRecentOrdersForPointsSync } from '@/services/orders/orderService';
import { fetchEarnRate } from '@/services/loyalty';
import { DEFAULT_EARN_RATE } from '@shared/constants/loyalty';
import { computeCartPoints } from '@shared/utils/loyalty';
import { normalizeToast, type ToastMessage } from '@shared/types/toast';
import { optionPriceModifier } from '@shared/utils/productOptions';

type Theme = 'light' | 'dark';
export type Tab = 'home' | 'menu' | 'qr' | 'campaigns' | 'profile';
type SheetView = 'product' | 'cart' | 'checkout' | 'tracking' | 'ai' | 'stores' | 'promotions' | 'order-detail' | 'notifications' | 'notification-inbox' | 'account' | 'qr' | 'rewards' | 'orders' | 'reset-password' | 'addresses' | null;

export type LastOrder = {
  orderNumber: string;
  storeName: string;
  status: string;
  pointsEarned: number;
  total?: number;
  billingType?: string;
  benefitTitle?: string | null;
  paymentPending?: boolean;
  paymentMethod?: string;
};

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  /** Admin/franchise kullanıcı müşteri uygulamasını önizler */
  previewAsCustomer: boolean;
  setPreviewAsCustomer: (v: boolean) => void;
  tab: Tab;
  setTab: (t: Tab) => void;

  cart: CartItem[];
  addToCart: (product: Product, opts: Customization, quantity?: number) => void;
  removeFromCart: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  cartPoints: number;

  sheet: SheetView;
  openSheet: (s: SheetView) => void;
  closeSheet: () => void;

  selectedProduct: Product | null;
  setSelectedProduct: (p: Product | null) => void;

  favorites: string[];
  toggleFavorite: (id: string) => void;

  points: number;

  toast: ToastMessage | null;
  showToast: (msg: string | ToastMessage) => void;

  lastOrder: LastOrder | null;
  setLastOrder: (order: LastOrder | null) => void;

  selectedOrderNumber: string | null;
  setSelectedOrderNumber: (n: string | null) => void;
}

export interface Customization {
  size: ProductOption;
  milk: ProductOption;
  syrup: ProductOption | null;
  topping: ProductOption | null;
  temperature: ProductOption;
  iceLevel: string;
  extraEspresso: number;
  notes: string;
}

const Ctx = createContext<AppState | null>(null);

const ACTIVE_ORDER_TERMINAL = new Set(['picked-up', 'delivered', 'cancelled', 'refunded', 'completed']);
const CUSTOMER_POINTS_SYNC_MS = 10_000;

function readSyncedCreditOrders(): Set<string> {
  if (Platform.OS === 'web' && typeof globalThis.sessionStorage !== 'undefined') {
    try {
      const raw = globalThis.sessionStorage.getItem('ex-points-synced');
      if (raw) return new Set(JSON.parse(raw) as string[]);
    } catch { /* ignore */ }
  }
  return new Set();
}

function persistSyncedCreditOrders(synced: Set<string>) {
  if (Platform.OS === 'web' && typeof globalThis.sessionStorage !== 'undefined') {
    try {
      globalThis.sessionStorage.setItem('ex-points-synced', JSON.stringify([...synced].slice(-30)));
    } catch { /* ignore */ }
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile, user, refreshProfile, isInternal } = useAuth();
  const [theme, setTheme] = useState<Theme>('light');
  const [previewAsCustomer, setPreviewAsCustomer] = useState(false);

  useEffect(() => {
    if (!user) setPreviewAsCustomer(false);
  }, [user]);
  const [tab, setTab] = useState<Tab>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sheet, setSheet] = useState<SheetView>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [lastOrder, setLastOrder] = useState<LastOrder | null>(null);
  const [selectedOrderNumber, setSelectedOrderNumber] = useState<string | null>(null);
  const [earnRate, setEarnRate] = useState(DEFAULT_EARN_RATE);
  const syncedCreditOrdersRef = useRef<Set<string>>(readSyncedCreditOrders());
  const pointsSyncSeededRef = useRef(false);
  const showToastRef = useRef<(msg: string) => void>(() => {});

  const points = profile?.points ?? 0;
  const isCustomerSession = Boolean(user && (!isInternal || previewAsCustomer));

  useEffect(() => {
    void fetchEarnRate().then(setEarnRate);
  }, []);

  useEffect(() => {
    if (profile?.favorite_drinks) {
      setFavorites(profile.favorite_drinks);
    }
  }, [profile?.favorite_drinks]);

  useEffect(() => {
    if (previewAsCustomer && user) void refreshProfile();
  }, [previewAsCustomer, user, refreshProfile]);

  useEffect(() => {
    if (!isCustomerSession || !user) return;

    const syncCustomerPoints = () => {
      void fetchRecentOrdersForPointsSync(user.id).then(({ data: orders }) => {
        if (!orders?.length) return;

        if (!pointsSyncSeededRef.current) {
          for (const order of orders) {
            if (order.points_credited) syncedCreditOrdersRef.current.add(order.order_number);
          }
          persistSyncedCreditOrders(syncedCreditOrdersRef.current);
          pointsSyncSeededRef.current = true;
        }

        let newlyCreditedOrder: { order_number: string; points_earned: number } | null = null;
        for (const order of orders) {
          if (!order.points_credited || !order.points_earned) continue;
          if (syncedCreditOrdersRef.current.has(order.order_number)) continue;
          syncedCreditOrdersRef.current.add(order.order_number);
          newlyCreditedOrder = { order_number: order.order_number, points_earned: order.points_earned };
        }

        if (newlyCreditedOrder) {
          persistSyncedCreditOrders(syncedCreditOrdersRef.current);
          void refreshProfile();
          showToastRef.current(`+${newlyCreditedOrder.points_earned} puan yüklendi!`);
        }

        const active = orders.find(o => !ACTIVE_ORDER_TERMINAL.has(o.status));
        if (active) {
          const paymentPending = active.status === 'payment_pending' || active.payment_status === 'pending';
          setLastOrder(prev => ({
            orderNumber: active.order_number,
            storeName: active.store_name ?? prev?.storeName ?? '',
            status: active.status,
            pointsEarned: paymentPending ? 0 : Number(active.points_earned ?? 0),
            paymentPending,
            paymentMethod: prev?.paymentMethod,
            total: prev?.total,
          }));
        }
      });
    };

    syncCustomerPoints();
    const intervalId = setInterval(syncCustomerPoints, CUSTOMER_POINTS_SYNC_MS);
    return () => clearInterval(intervalId);
  }, [isCustomerSession, user, refreshProfile]);

  useEffect(() => {
    if (!isCustomerSession) return;

    if (Platform.OS === 'web' && typeof globalThis.document !== 'undefined') {
      const onVisible = () => {
        if (globalThis.document.visibilityState === 'visible') void refreshProfile();
      };
      globalThis.document.addEventListener('visibilitychange', onVisible);
      return () => globalThis.document.removeEventListener('visibilitychange', onVisible);
    }

    const sub = RNAppState.addEventListener('change', state => {
      if (state === 'active') void refreshProfile();
    });
    return () => sub.remove();
  }, [isCustomerSession, refreshProfile]);

  const toggleTheme = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), []);

  const showToast = useCallback((msg: string | ToastMessage) => {
    setToast(normalizeToast(msg));
    setTimeout(() => setToast(null), 2600);
  }, []);

  showToastRef.current = (msg: string) => showToast(msg);

  const addToCart = useCallback((product: Product, opts: Customization, quantity = 1) => {
    const unitPrice =
      Number(product.price) +
      optionPriceModifier(opts.size) +
      optionPriceModifier(opts.milk) +
      optionPriceModifier(opts.syrup) +
      optionPriceModifier(opts.topping) +
      optionPriceModifier(opts.temperature) +
      opts.extraEspresso * 12;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      showToast('Ürün fiyatı hesaplanamadı. Menüden tekrar deneyin.');
      return;
    }
    const safeQty = Math.max(1, Math.floor(quantity) || 1);
    const id = `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const item: CartItem = { id, product, ...opts, quantity: safeQty, unitPrice };
    setCart(c => [...c, item]);
    showToast(`${product.name} sepete eklendi`);
  }, [showToast]);

  const removeFromCart = useCallback((id: string) => {
    setCart(c => c.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setCart(c => c.filter(i => i.id !== id));
      return;
    }
    setCart(c => c.map(i => (i.id === id ? { ...i, quantity: qty } : i)));
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const cartPoints = computeCartPoints(cartTotal, earnRate);

  const openSheet = useCallback((s: SheetView) => setSheet(s), []);
  const closeSheet = useCallback(() => setSheet(null), []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(f => {
      const next = f.includes(id) ? f.filter(x => x !== id) : [...f, id];
      if (profile) {
        supabase.from('profiles')
          .update({ favorite_drinks: next })
          .eq('user_id', profile.user_id)
          .then();
      }
      return next;
    });
  }, [profile]);

  const value: AppState = {
    theme, toggleTheme, previewAsCustomer, setPreviewAsCustomer, tab, setTab,
    cart, addToCart, removeFromCart, updateQty, clearCart,
    cartCount, cartTotal, cartPoints,
    sheet, openSheet, closeSheet,
    selectedProduct, setSelectedProduct,
    favorites, toggleFavorite,
    points,
    toast, showToast,
    lastOrder, setLastOrder,
    selectedOrderNumber, setSelectedOrderNumber,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used within AppProvider');
  return c;
}
