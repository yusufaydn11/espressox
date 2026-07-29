import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchStoreInfo,
  fetchStoreComparison,
  fetchRecentDashboardOrders,
  fetchFranchises,
  fetchDashboardKpis,
  type DashboardKpis,
} from '../lib/api';
import type { Store, Franchise } from '../lib/supabase';
import type { DashboardRecentOrderRow } from '../services/orders/orderService';

export type HqStoreDetailData = {
  store: Store;
  franchise: Franchise | null;
  revenue: number;
  rank: number | null;
  revenueShare: number;
  storeOrders: DashboardRecentOrderRow[];
  comparison: { label: string; value: number }[];
  kpis: DashboardKpis;
  pendingOrders: number;
  avgOrderValue: number;
};

export function useHqStoreDetail(storeId: string | undefined) {
  const [data, setData] = useState<HqStoreDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!storeId) {
      setLoading(false);
      setError('Şube bulunamadı');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [store, comparison, recentOrders, franchises, kpis] = await Promise.all([
        fetchStoreInfo(storeId),
        fetchStoreComparison(),
        fetchRecentDashboardOrders(30),
        fetchFranchises(),
        fetchDashboardKpis(),
      ]);

      if (!store) {
        setError('Şube bulunamadı');
        setData(null);
        return;
      }

      const storeKey = store.name.toLowerCase();
      const revenueRow = comparison.find(c => c.label.toLowerCase() === storeKey);
      const revenue = revenueRow?.value ?? 0;
      const ranked = [...comparison].sort((a, b) => b.value - a.value);
      const rank = ranked.findIndex(c => c.label.toLowerCase() === storeKey);
      const totalRevenue = comparison.reduce((s, c) => s + c.value, 0);
      const storeOrders = recentOrders.filter(o => o.store_name.toLowerCase() === storeKey);
      const pendingOrders = storeOrders.filter(o => ['pending', 'preparing'].includes(o.status)).length;
      const avgOrderValue = storeOrders.length > 0
        ? Math.round(storeOrders.reduce((s, o) => s + Number(o.total), 0) / storeOrders.length)
        : 0;

      setData({
        store,
        franchise: store.franchise_id
          ? franchises.find(f => f.id === store.franchise_id) ?? null
          : null,
        revenue,
        rank: rank >= 0 ? rank + 1 : null,
        revenueShare: totalRevenue > 0 ? Math.round((revenue / totalRevenue) * 100) : 0,
        storeOrders,
        comparison,
        kpis,
        pendingOrders,
        avgOrderValue,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Şube detayı yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { void load(); }, [load]);

  const opsSummary = useMemo(() => {
    if (!data) return null;
    const { storeOrders } = data;
    const statusCounts = storeOrders.reduce((acc, o) => {
      acc[o.status] = (acc[o.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return {
      totalRecent: storeOrders.length,
      pending: statusCounts.pending ?? 0,
      preparing: statusCounts.preparing ?? 0,
      ready: statusCounts.ready ?? 0,
      completed: (statusCounts['picked-up'] ?? 0) + (statusCounts.delivered ?? 0),
    };
  }, [data]);

  return { data, opsSummary, loading, error, reload: load };
}
