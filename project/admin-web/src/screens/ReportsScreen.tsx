import { useEffect, useState, useCallback } from 'react';
import { BarChart3, Download, TrendingUp, Store, Award, Repeat } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { fetchSalesSeries, fetchStoreComparison, fetchTopProducts, fetchOrders } from '../lib/api';
import { Card, Spinner, ErrorState, PageHeader, Button } from '../lib/ui';
import { formatTRY, formatNum } from '../lib/utils';

const RANGES = [
  { id: 7, label: '7 Gün' },
  { id: 30, label: '30 Gün' },
  { id: 90, label: '90 Gün' },
];

const PIE_COLORS = ['#C8102E', '#18181B', '#D4AF37', '#6E6E78', '#9494A0', '#C4C4CC'];

export function ReportsScreen() {
  const [range, setRange] = useState(30);
  const [sales, setSales] = useState<{ label: string; value: number }[]>([]);
  const [stores, setStores] = useState<{ label: string; value: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ label: string; value: number }[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof fetchOrders>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [s, st, tp, o] = await Promise.all([fetchSalesSeries(range), fetchStoreComparison(), fetchTopProducts(6), fetchOrders('all')]);
      setSales(s); setStores(st); setTopProducts(tp); setOrders(o);
    } catch (e) { setError(e instanceof Error ? e.message : 'Raporlar yüklenemedi'); }
    finally { setLoading(false); }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  const totalRevenue = sales.reduce((s, r) => s + r.value, 0);
  const avgBasket = orders.length > 0 ? orders.reduce((s, o) => s + Number(o.total), 0) / orders.length : 0;
  const uniqueCustomers = new Set(orders.map(o => o.user_id)).size;
  const repeatCustomers = Object.values(orders.reduce((acc, o) => { acc[o.user_id] = (acc[o.user_id] ?? 0) + 1; return acc; }, {} as Record<string, number>)).filter((c: number) => c > 1).length;
  const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

  const exportCsv = () => {
    const rows = [['Tarih', 'Ciro'], ...sales.map(s => [s.label, String(s.value)])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `espresso-x-satis-${range}gun.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Raporlar" subtitle="Satış analizi ve performans metrikleri"
        action={<div className="flex items-center gap-2">
          <div className="flex bg-cream-100 dark:bg-ink-800 rounded-xl p-1">
            {RANGES.map(r => <button key={r.id} onClick={() => setRange(r.id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${range === r.id ? 'bg-white dark:bg-ink-900 shadow-card text-ink-900 dark:text-ink-100' : 'text-ink-400 dark:text-ink-400'}`}>{r.label}</button>)}
          </div>
          <Button variant="outline" size="sm" onClick={exportCsv}><Download size={14} /> CSV</Button>
        </div>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Toplam Ciro" value={formatTRY(totalRevenue)} icon={<TrendingUp size={16} className="text-ex-red" />} />
        <SummaryCard label="Ort. Sepet" value={formatTRY(avgBasket)} icon={<BarChart3 size={16} className="text-ink-600 dark:text-ink-300" />} />
        <SummaryCard label="Tekrar Oranı" value={`%${repeatRate.toFixed(0)}`} icon={<Repeat size={16} className="text-ink-600 dark:text-ink-300" />} />
        <SummaryCard label="En İyi Şube" value={stores[0]?.label ?? '—'} icon={<Store size={16} className="text-ink-600 dark:text-ink-300" />} />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Satış Trendi</h3>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={sales}>
            <defs><linearGradient id="repGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C8102E" stopOpacity={0.25} /><stop offset="100%" stopColor="#C8102E" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
            <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
            <Area type="monotone" dataKey="value" stroke="#C8102E" strokeWidth={2.5} fill="url(#repGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Şube Performansı</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stores}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={v => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Bar dataKey="value" fill="#18181B" radius={[6, 6, 0, 0]} barSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Ürün Satış Dağılımı</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={topProducts} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                {topProducts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `${v} adet`} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Award size={16} className="text-ex-red" /> En Çok Satan Ürünler</h3>
        <div className="space-y-3">
          {topProducts.map((p, i) => {
            const max = topProducts[0]?.value || 1;
            return (
              <div key={p.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-ink-700 dark:text-ink-300 flex items-center gap-2"><span className="text-xs font-bold text-ink-400 dark:text-ink-400 w-4">{i + 1}</span>{p.label}</span>
                  <span className="text-xs font-bold text-ink-900 dark:text-ink-100">{formatNum(p.value)} adet</span>
                </div>
                <div className="h-2 rounded-full bg-ink-100 dark:bg-ink-800 overflow-hidden"><div className="h-full rounded-full bg-red-gradient" style={{ width: `${(p.value / max) * 100}%` }} /></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="h-10 w-10 rounded-xl bg-cream-100 dark:bg-ink-800 flex items-center justify-center">{icon}</div>
      <p className="text-xl font-bold text-ink-900 dark:text-ink-100 mt-3 font-display">{value}</p>
      <p className="text-xs text-ink-400 dark:text-ink-400 mt-1">{label}</p>
    </Card>
  );
}
