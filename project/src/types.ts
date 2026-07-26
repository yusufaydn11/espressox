// Core domain types for Espresso X

export type Tier = 'Bronz' | 'Gümüş' | 'Altın' | 'Siyah' | 'VIP';

export type OrderType = 'pickup' | 'table' | 'delivery' | 'scheduled';

export interface Nutrition {
  calories: number;
  fat: number;
  carbs: number;
  protein: number;
  caffeine: number;
}

export interface ProductOption {
  id: string;
  label: string;
  priceModifier: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  image: string;
  rating: number;
  popular: boolean;
  seasonal: boolean;
  aiRecommended?: boolean;
  calories: number;
  nutrition: Nutrition;
  allergens: string[];
  sizes: ProductOption[];
  milks: ProductOption[];
  syrups: ProductOption[];
  toppings: ProductOption[];
  temperature: ProductOption[];
  iceLevels: string[];
}

export interface CartItem {
  id: string;
  product: Product;
  size: ProductOption;
  milk: ProductOption;
  syrup: ProductOption | null;
  topping: ProductOption | null;
  temperature: ProductOption;
  iceLevel: string;
  extraEspresso: number;
  notes: string;
  quantity: number;
  unitPrice: number;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  distance: number;
  open: boolean;
  hours: string;
  busy: 'quiet' | 'moderate' | 'busy';
  amenities: string[];
  lat: number;
  lng: number;
  driveThru: boolean;
  wifi: boolean;
  parking: boolean;
}

export interface Reward {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  category: 'coffee' | 'dessert' | 'discount' | 'exclusive' | 'birthday';
  image: string;
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardPoints: number;
  expires: string;
  type: 'weekly' | 'monthly' | 'streak';
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlocked: boolean;
  date?: string;
}

export interface TierInfo {
  name: Tier;
  minPoints: number;
  color: string;
  perks: string[];
}

export interface Order {
  id: string;
  date: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: 'preparing' | 'ready' | 'picked-up' | 'delivered' | 'scheduled';
  store: string;
  type: OrderType;
  pointsEarned: number;
}

export interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  code: string;
  discount: string;
  image: string;
  expires: string;
  type: 'happy-hour' | 'birthday' | 'location' | 'referral' | 'gift' | 'wallet' | 'campaign';
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'apple-pay' | 'google-pay' | 'wallet' | 'gift-card' | 'qr' | 'cash';
  label: string;
  detail: string;
  balance?: number;
  default: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  avatar: string;
  tier: Tier;
  points: number;
  rewardWallet: number;
  walletCredits: number;
  lifetimePoints: number;
  streak: number;
  joinedDate: string;
  favoriteDrinks: string[];
  birthday: string;
  memberNumber: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  email: string;
  tier: Tier;
  orders: number;
  spent: number;
  lastOrder: string;
  status: 'active' | 'inactive' | 'vip';
  segment: string;
}

export interface AdminOrder {
  id: string;
  customer: string;
  items: number;
  total: number;
  status: string;
  type: OrderType;
  store: string;
  time: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  store: string;
  status: 'active' | 'break' | 'off';
  avatar: string;
  shift: string;
}

export interface Campaign {
  id: string;
  name: string;
  type: 'push' | 'email' | 'sms' | 'birthday' | 'location';
  status: 'active' | 'scheduled' | 'draft' | 'ended';
  reach: number;
  conversion: number;
  revenue: number;
  start: string;
}

export interface ChartPoint {
  label: string;
  value: number;
}
