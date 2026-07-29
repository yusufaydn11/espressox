import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchOrderTrend,
  fetchCategoryRevenue,
  fetchHourlyOrders,
  fetchStatusBreakdown,
  fetchTierBreakdown,
} from '../lib/analytics';
import { fetchStoreComparison, fetchTopProducts } from '../lib/api';

export type HqAnalyticsData = {
  trend: { label: string; orders: number; revenue: number }[];
  categoryRevenue: { label: string; value: number }[];
  hourly: { hour: string; orders: number }[];
  status: { label: string; value: number }[];
  tiers: { label: string; value: number }[];
  stores: { label: string; value: number }[];
  topProducts: { label: string; value: number }[];
};

export type HqAnalyticsSummary = {
  totalRevenue: number;
  totalOrders: number;
  avgOrder: number;
  totalMembers: number;
};

function computeSummary(trend: HqAnalyticsData['trend'], tiers: HqAnalyticsData['tiers']): HqAnalyticsSummary {
  const totalRevenue = trend.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = trend.reduce((s, d) => s + d.orders, 0);
  return {
    totalRevenue,
    totalOrders,
    avgOrder: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    totalMembers: tiers.reduce((s, t) => s + t.value, 0),
  };
}

export function useHqAnalytics(range: number) {
  const [data, setData] = useState<HqAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [trend, categoryRevenue, hourly, status, tiers, stores, topProducts] = await Promise.all([
        fetchOrderTrend(range),
        fetchCategoryRevenue(),
        fetchHourlyOrders(),
        fetchStatusBreakdown(),
        fetchTierBreakdown(),
        fetchStoreComparison(),
        fetchTopProducts(10),
      ]);
      setData({ trend, categoryRevenue, hourly, status, tiers, stores, topProducts });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analitik veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const summary = useMemo(
    () => (data ? computeSummary(data.trend, data.tiers) : null),
    [data],
  );

  return { data, summary, loading, error, reload: load };
}
