import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchStores,
  fetchStoreComparison,
  fetchDashboardKpis,
  fetchRecentDashboardOrders,
  type DashboardKpis,
} from '../lib/api';
import type { Store } from '../lib/supabase';
import type { DashboardRecentOrderRow } from '../services/orders/orderService';

export type StorePerformanceRow = Store & {
  revenue: number;
  rank: number | null;
  revenueShare: number;
};

export type HqStoreSummary = {
  totalStores: number;
  openStores: number;
  unlinkedStores: number;
  totalRevenue: number;
  topStore: string;
  avgRevenuePerStore: number;
};

export type HqStorePerformanceData = {
  stores: StorePerformanceRow[];
  summary: HqStoreSummary;
  comparison: { label: string; value: number }[];
  kpis: DashboardKpis;
  recentOrders: DashboardRecentOrderRow[];
};

function buildPerformanceRows(
  stores: Store[],
  comparison: { label: string; value: number }[],
): StorePerformanceRow[] {
  const revenueMap = new Map(comparison.map(c => [c.label.toLowerCase(), c.value]));
  const ranked = [...comparison].sort((a, b) => b.value - a.value);
  const rankMap = new Map(ranked.map((c, i) => [c.label.toLowerCase(), i + 1]));
  const totalRevenue = comparison.reduce((s, c) => s + c.value, 0);

  return stores.map(store => {
    const key = store.name.toLowerCase();
    const revenue = revenueMap.get(key) ?? 0;
    return {
      ...store,
      revenue,
      rank: rankMap.get(key) ?? null,
      revenueShare: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);
}

function buildSummary(stores: StorePerformanceRow[], comparison: { label: string; value: number }[]): HqStoreSummary {
  const totalRevenue = comparison.reduce((s, c) => s + c.value, 0);
  const top = [...comparison].sort((a, b) => b.value - a.value)[0];
  return {
    totalStores: stores.length,
    openStores: stores.filter(s => s.open).length,
    unlinkedStores: stores.filter(s => !s.franchise_id).length,
    totalRevenue,
    topStore: top?.label ?? '—',
    avgRevenuePerStore: stores.length > 0 ? Math.round(totalRevenue / stores.length) : 0,
  };
}

export function useHqStorePerformance() {
  const [data, setData] = useState<HqStorePerformanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [stores, comparison, kpis, recentOrders] = await Promise.all([
        fetchStores(),
        fetchStoreComparison(),
        fetchDashboardKpis(),
        fetchRecentDashboardOrders(20),
      ]);
      const rows = buildPerformanceRows(stores, comparison);
      setData({
        stores: rows,
        summary: buildSummary(rows, comparison),
        comparison,
        kpis,
        recentOrders,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Şube performans verileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, reload: load };
}

export function useStorePerformanceSearch(stores: StorePerformanceRow[], query: string) {
  return useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stores;
    return stores.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.address.toLowerCase().includes(q),
    );
  }, [stores, query]);
}
