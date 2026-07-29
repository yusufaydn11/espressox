import { useCallback, useEffect, useState } from 'react';
import {
  fetchDashboardKpis,
  fetchSalesSeries,
  fetchStoreComparison,
  fetchRecentDashboardOrders,
  type DashboardKpis,
} from '../lib/api';
import { fetchHourlyOrders } from '../lib/analytics';
import type { DashboardRecentOrderRow } from '../services/orders/orderService';

export type EnterpriseDashboardData = {
  kpis: DashboardKpis;
  sales: { label: string; value: number }[];
  stores: { label: string; value: number }[];
  recentOrders: DashboardRecentOrderRow[];
  hourlyOrders: { hour: string; orders: number }[];
  /** get_admin_store_comparison sonucundan türetilen şube sayısı */
  activeStores: number;
};

/** Yalnızca onaylı 5 admin aggregate RPC kullanır (Promise.all ile paralel) */
export function useEnterpriseDashboard() {
  const [data, setData] = useState<EnterpriseDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpis, sales, stores, recentOrders, hourlyOrders] = await Promise.all([
        fetchDashboardKpis(),
        fetchSalesSeries(14),
        fetchStoreComparison(),
        fetchRecentDashboardOrders(10),
        fetchHourlyOrders(),
      ]);

      setData({
        kpis,
        sales,
        stores,
        recentOrders,
        hourlyOrders,
        activeStores: stores.length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, reload: load };
}
