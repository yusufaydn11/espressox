import { supabase } from '@/lib/supabase';

export type AnalyticsScope = 'hq' | 'store';

export interface AnalyticsSummary {
  totalStampCardsCompleted: number;
  activeStampCards: number;
  totalFreeCoffees: number;
  pointsEarned: number;
  pointsRedeemed: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  newMembers: number;
  activeUsers: number;
}

export interface FreeCoffeeByProduct {
  name: string;
  count: number;
}

export interface UserStampRanking {
  userId: string;
  fullName: string;
  cardsCompleted: number;
}

export interface StoreComparison {
  storeId: string;
  storeName: string;
  stampCards: number;
  freeCoffees: number;
  pointsEarned: number;
  pointsRedeemed: number;
  orders: number;
  revenue: number;
}

export interface LeaderboardEntry {
  storeId: string;
  storeName: string;
  freeCoffees: number;
}

export interface TimeSeriesPoint {
  date: string;
  stampCards: number;
  freeCoffees: number;
  orders: number;
  revenue: number;
  pointsEarned: number;
  pointsRedeemed: number;
}

export interface LiveStats {
  todayOrders: number;
  todayRevenue: number;
  todayFreeCoffees: number;
  todayStampCards: number;
  activeUsersToday: number;
  timestamp: string;
}

export interface FreeCoffeeLogEntry {
  id: string;
  userId: string;
  fullName: string;
  storeId: string | null;
  storeName: string;
  productName: string;
  redeemedAt: string;
}

export interface SuspiciousEntry {
  id: string;
  type: string;
  severity: string;
  description: string;
  userId: string | null;
  storeId: string | null;
  detectedAt: string;
  metadata: Record<string, unknown>;
  resolved: boolean;
}

export interface AnalyticsResponse {
  ok: boolean;
  scope: AnalyticsScope;
  storeId: string | null;
  dateRange: { start: string; end: string };
  summary: AnalyticsSummary;
  freeCoffeeByProduct: FreeCoffeeByProduct[];
  userStampRanking: UserStampRanking[];
  storeComparison: StoreComparison[];
  leaderboard: LeaderboardEntry[];
  timeSeries: TimeSeriesPoint[];
  live: LiveStats;
  freeCoffeeLog: FreeCoffeeLogEntry[];
  suspiciousActivity: SuspiciousEntry[];
  stores: Array<{ id: string; name: string }>;
}

export type DatePreset = 'today' | 'week' | 'month' | 'year' | 'custom';

export function presetRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'today': break;
    case 'week': start.setDate(start.getDate() - 7); break;
    case 'month': start.setMonth(start.getMonth() - 1); break;
    case 'year': start.setFullYear(start.getFullYear() - 1); break;
    case 'custom': start.setMonth(start.getMonth() - 1); break;
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function fetchAnalytics(params: {
  scope: AnalyticsScope;
  storeId?: string;
  start?: string;
  end?: string;
}): Promise<AnalyticsResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? '';
  const apiUrl = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/franchise-analytics`;
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      scope: params.scope,
      storeId: params.storeId,
      startDate: params.start,
      endDate: params.end,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Rapor alınamadı' }));
    throw new Error(err.error ?? 'Rapor alınamadı');
  }
  return (await res.json()) as AnalyticsResponse;
}
