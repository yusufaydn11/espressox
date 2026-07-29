import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchSalesSeries,
  fetchStoreComparison,
  fetchTopProducts,
  fetchDashboardKpis,
  type DashboardKpis,
} from '../lib/api';

export type HqReportsData = {
  sales: { label: string; value: number }[];
  stores: { label: string; value: number }[];
  topProducts: { label: string; value: number }[];
  kpis: DashboardKpis;
};

export type HqReportsSummary = {
  totalRevenue: number;
  avgBasket: number;
  newMembers: number;
  topStore: string;
  totalOrders: number;
};

export function useHqReports(range: number) {
  const [data, setData] = useState<HqReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sales, stores, topProducts, kpis] = await Promise.all([
        fetchSalesSeries(range),
        fetchStoreComparison(),
        fetchTopProducts(6),
        fetchDashboardKpis(),
      ]);
      setData({ sales, stores, topProducts, kpis });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Raporlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo((): HqReportsSummary | null => {
    if (!data) return null;
    const totalRevenue = data.sales.reduce((s, r) => s + r.value, 0);
    const topStore = [...data.stores].sort((a, b) => b.value - a.value)[0]?.label ?? '—';
    return {
      totalRevenue,
      avgBasket: data.kpis.avgBasket,
      newMembers: data.kpis.newMembers,
      topStore,
      totalOrders: data.kpis.totalOrders,
    };
  }, [data]);

  return { data, summary, loading, error, reload: load };
}
