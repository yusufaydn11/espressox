import {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react';
import type { CartItem, Product, ProductOption } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

type Theme = 'light' | 'dark';
type Role = 'customer' | 'admin';
export type Tab = 'home' | 'menu' | 'qr' | 'campaigns' | 'profile';
type SheetView = 'product' | 'cart' | 'checkout' | 'tracking' | 'ai' | 'stores' | 'promotions' | 'order-detail' | 'notifications' | 'account' | 'qr' | 'rewards' | 'orders' | null;

interface AppState {
  theme: Theme;
  toggleTheme: () => void;
  role: Role;
  setRole: (r: Role) => void;
  tab: Tab;
  setTab: (t: Tab) => void;

  cart: CartItem[];
  addToCart: (product: Product, opts: Customization) => void;
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
  addPoints: (n: number) => void;
  spendPoints: (n: number) => void;

  toast: string | null;
  showToast: (msg: string) => void;
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

export function AppProvider({ children }: { children: ReactNode }) {
  const { profile, refreshProfile } = useAuth();
  const [theme, setTheme] = useState<Theme>('light');
  const [role, setRole] = useState<Role>('customer');
  const [tab, setTab] = useState<Tab>('home');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [sheet, setSheet] = useState<SheetView>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const points = profile?.points ?? 0;

  useEffect(() => {
    if (profile?.favorite_drinks) {
      setFavorites(profile.favorite_drinks);
    }
  }, [profile?.favorite_drinks]);

  const toggleTheme = useCallback(() => setTheme(t => (t === 'light' ? 'dark' : 'light')), []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const addToCart = useCallback((product: Product, opts: Customization) => {
    const unitPrice =
      product.price +
      opts.size.priceModifier +
      opts.milk.priceModifier +
      (opts.syrup?.priceModifier ?? 0) +
      (opts.topping?.priceModifier ?? 0) +
      opts.temperature.priceModifier +
      opts.extraEspresso * 0.8;
    const id = `${product.id}-${Date.now()}`;
    const item: CartItem = { id, product, ...opts, quantity: 1, unitPrice };
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
  const cartPoints = Math.round(cartTotal * 0.2);

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

  const addPoints = useCallback((n: number) => {
    if (!profile) return;
    supabase.rpc('add_points', { p_amount: n, p_title: 'Puan eklendi' })
      .then(() => refreshProfile());
  }, [profile, refreshProfile]);

  const spendPoints = useCallback((n: number) => {
    if (!profile) return;
    supabase.rpc('spend_points', { p_amount: n, p_title: 'Ödül kullanıldı' })
      .then(() => refreshProfile());
  }, [profile, refreshProfile]);

  const value: AppState = {
    theme, toggleTheme, role, setRole, tab, setTab,
    cart, addToCart, removeFromCart, updateQty, clearCart,
    cartCount, cartTotal, cartPoints,
    sheet, openSheet, closeSheet,
    selectedProduct, setSelectedProduct,
    favorites, toggleFavorite,
    points, addPoints, spendPoints,
    toast, showToast,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used within AppProvider');
  return c;
}
