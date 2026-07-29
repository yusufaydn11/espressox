import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type MobileHqKpis = {
  todaySales: number;
  monthRevenue: number;
  totalOrders: number;
  avgBasket: number;
  activeCustomers: number;
  newMembers: number;
  topProduct: string;
};

export type MobileHqSalesPoint = { label: string; value: number };
export type MobileHqRecentOrder = {
  id: string;
  order_number: string;
  store_name: string;
  total: number;
  status: string;
  created_at: string;
};

export type MobileHqDashboardData = {
  kpis: MobileHqKpis;
  sales: MobileHqSalesPoint[];
  recentOrders: MobileHqRecentOrder[];
};

function parseKpis(raw: Record<string, unknown>): MobileHqKpis {
  return {
    todaySales: Number(raw.today_sales ?? 0),
    monthRevenue: Number(raw.month_revenue ?? 0),
    totalOrders: Number(raw.total_orders ?? 0),
    avgBasket: Number(raw.avg_basket ?? 0),
    activeCustomers: Number(raw.active_customers ?? 0),
    newMembers: Number(raw.new_members ?? 0),
    topProduct: String(raw.top_product ?? '—'),
  };
}

function buildSalesBuckets(rows: { created_at: string; total: number }[], days: number): MobileHqSalesPoint[] {
  const buckets: Record<string, number> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  rows.forEach(r => {
    const k = r.created_at.slice(0, 10);
    if (k in buckets) buckets[k] += Number(r.total);
  });
  return Object.entries(buckets).map(([k, v]) => ({
    label: new Date(k).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
    value: Math.round(v),
  }));
}

export function useMobileHqDashboard() {
  const [data, setData] = useState<MobileHqDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [kpiRes, salesRes, ordersRes] = await Promise.all([
        supabase.rpc('get_admin_dashboard_kpis'),
        supabase.rpc('get_admin_sales_series', { p_days: 7 }),
        supabase.rpc('get_admin_recent_orders', { p_limit: 8 }),
      ]);

      if (kpiRes.error) throw new Error(kpiRes.error.message);
      if (salesRes.error) throw new Error(salesRes.error.message);
      if (ordersRes.error) throw new Error(ordersRes.error.message);

      const kpiRaw = kpiRes.data as Record<string, unknown>;
      if (kpiRaw?.error) throw new Error(String(kpiRaw.error));

      setData({
        kpis: parseKpis(kpiRaw),
        sales: buildSalesBuckets((salesRes.data ?? []) as { created_at: string; total: number }[], 7),
        recentOrders: (ordersRes.data ?? []) as MobileHqRecentOrder[],
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { data, loading, error, reload: load };
}
