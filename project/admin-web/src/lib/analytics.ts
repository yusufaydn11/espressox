import {
  fetchOrderTrendAggregate,
  fetchCategoryRevenueAggregate,
  fetchHourlyOrdersAggregate,
  fetchOrderStatusBreakdownAggregate,
} from '../services/orders';
import { fetchTierBreakdown as fetchTierBreakdownService } from '../services/loyalty';

export async function fetchOrderTrend(days: number): Promise<{ label: string; orders: number; revenue: number }[]> {
  const rows = await fetchOrderTrendAggregate(days);
  const buckets: Record<string, { orders: number; revenue: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = { orders: 0, revenue: 0 };
  }
  rows.forEach(r => {
    const k = r.created_at.slice(0, 10);
    if (k in buckets) {
      buckets[k].orders += Number(r.orders);
      buckets[k].revenue += Number(r.total);
    }
  });
  return Object.entries(buckets).map(([k, v]) => ({
    label: new Date(k).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' }),
    orders: v.orders,
    revenue: Math.round(v.revenue),
  }));
}

export async function fetchCategoryRevenue(): Promise<{ label: string; value: number }[]> {
  const rows = await fetchCategoryRevenueAggregate(10);
  return rows.map(r => ({
    label: r.name,
    value: Math.round(Number(r.revenue)),
  }));
}

export async function fetchHourlyOrders(): Promise<{ hour: string; orders: number }[]> {
  const rows = await fetchHourlyOrdersAggregate();
  const hours: number[] = new Array(24).fill(0);
  rows.forEach(r => {
    if (r.hour >= 0 && r.hour < 24) hours[r.hour] = Number(r.orders);
  });
  return hours.map((orders, h) => ({ hour: `${h}:00`, orders }));
}

export async function fetchStatusBreakdown(): Promise<{ label: string; value: number }[]> {
  const rows = await fetchOrderStatusBreakdownAggregate();
  const labels: Record<string, string> = {
    pending: 'Yeni', preparing: 'Hazırlanıyor', ready: 'Hazır',
    'picked-up': 'Teslim Alındı', delivered: 'Teslim Edildi', cancelled: 'İptal',
  };
  return rows.map(r => ({
    label: labels[r.status] ?? r.status,
    value: Number(r.count),
  }));
}

export async function fetchTierBreakdown(): Promise<{ label: string; value: number }[]> {
  return fetchTierBreakdownService();
}
