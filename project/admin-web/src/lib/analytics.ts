import { supabase } from './supabase';

export async function fetchOrderTrend(days: number): Promise<{ label: string; orders: number; revenue: number }[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('orders')
    .select('total, created_at')
    .gte('created_at', start.toISOString())
    .neq('status', 'cancelled')
    .order('created_at', { ascending: true });
  if (error) return [];
  const buckets: Record<string, { orders: number; revenue: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = { orders: 0, revenue: 0 };
  }
  (data as { total: number; created_at: string }[]).forEach(r => {
    const k = r.created_at.slice(0, 10);
    if (k in buckets) {
      buckets[k].orders += 1;
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
  const { data, error } = await supabase
    .from('order_items')
    .select('name, quantity, unit_price');
  if (error) return [];
  const map: Record<string, number> = {};
  (data as { name: string; quantity: number; unit_price: number }[]).forEach(r => {
    map[r.name] = (map[r.name] ?? 0) + r.quantity * Number(r.unit_price);
  });
  return Object.entries(map)
    .map(([label, value]) => ({ label, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export async function fetchHourlyOrders(): Promise<{ hour: string; orders: number }[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('created_at')
    .neq('status', 'cancelled')
    .limit(500);
  if (error) return [];
  const hours: number[] = new Array(24).fill(0);
  (data as { created_at: string }[]).forEach(r => {
    const h = new Date(r.created_at).getHours();
    hours[h]++;
  });
  return hours.map((orders, h) => ({ hour: `${h}:00`, orders }));
}

export async function fetchStatusBreakdown(): Promise<{ label: string; value: number }[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .limit(1000);
  if (error) return [];
  const map: Record<string, number> = {};
  (data as { status: string }[]).forEach(r => {
    map[r.status] = (map[r.status] ?? 0) + 1;
  });
  const labels: Record<string, string> = {
    pending: 'Yeni', preparing: 'Hazırlanıyor', ready: 'Hazır',
    'picked-up': 'Teslim Alındı', delivered: 'Teslim Edildi', cancelled: 'İptal',
  };
  return Object.entries(map).map(([k, v]) => ({ label: labels[k] ?? k, value: v }));
}

export async function fetchTierBreakdown(): Promise<{ label: string; value: number }[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('tier')
    .limit(2000);
  if (error) return [];
  const map: Record<string, number> = {};
  (data as { tier: string }[]).forEach(r => {
    map[r.tier] = (map[r.tier] ?? 0) + 1;
  });
  return Object.entries(map).map(([label, value]) => ({ label, value }));
}
