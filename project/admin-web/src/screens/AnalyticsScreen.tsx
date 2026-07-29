import { useEffect, useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { TrendingUp, ShoppingBag, Clock, PieChart as PieIcon, RefreshCw, Crown } from 'lucide-react';
import {
  fetchOrderTrend, fetchCategoryRevenue, fetchHourlyOrders,
  fetchStatusBreakdown, fetchTierBreakdown,
} from '../lib/analytics';
import { fetchStoreComparison, fetchTopProducts } from '../lib/api';
import { Card, Spinner, ErrorState, PageHeader, Button, Badge } from '../lib/ui';
import { formatTRY, formatNum } from '../lib/utils';

const PIE_COLORS = ['#C8102E', '#18181B', '#D4AF37', '#3D3D42', '#9494A0', '#E2DFD7'];
const RANGE_OPTIONS = [
  { value: 7, label: '7 Gün' },
  { value: 14, label: '14 Gün' },
  { value: 30, label: '30 Gün' },
  { value: 90, label: '90 Gün' },
];

export function AnalyticsScreen() {
  const [range, setRange] = useState(14);
  const [trend, setTrend] = useState<{ label: string; orders: number; revenue: number }[]>([]);
  const [catRev, setCatRev] = useState<{ label: string; value: number }[]>([]);
  const [hourly, setHourly] = useState<{ hour: string; orders: number }[]>([]);
  const [status, setStatus] = useState<{ label: string; value: number }[]>([]);
  const [tiers, setTiers] = useState<{ label: string; value: number }[]>([]);
  const [stores, setStores] = useState<{ label: string; value: number }[]>([]);
  const [topProd, setTopProd] = useState<{ label: string; value: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [t, c, h, s, ti, st, tp] = await Promise.all([
        fetchOrderTrend(range), fetchCategoryRevenue(), fetchHourlyOrders(),
        fetchStatusBreakdown(), fetchTierBreakdown(), fetchStoreComparison(),
        fetchTopProducts(10),
      ]);
      setTrend(t); setCatRev(c); setHourly(h); setStatus(s);
      setTiers(ti); setStores(st); setTopProd(tp);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analitik veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [range]);

  if (loading) return <Spinner label="Analitik veriler yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalRevenue = trend.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = trend.reduce((s, d) => s + d.orders, 0);
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analitik"
        subtitle="Detaylı performans ve trend analizi"
        action={
          <div className="flex items-center gap-2">
            <select
              value={range}
              onChange={e => setRange(Number(e.target.value))}
              className="admin-input w-auto py-2"
            >
              {RANGE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /> Yenile</Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="h-10 w-10 rounded-xl bg-ex-red/10 flex items-center justify-center mb-3"><TrendingUp size={18} className="text-ex-red" /></div>
          <p className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display">{formatTRY(totalRevenue)}</p>
          <p className="text-xs text-ink-400 mt-1">Toplam Ciro ({range} gün)</p>
        </Card>
        <Card className="p-5">
          <div className="h-10 w-10 rounded-xl bg-cream-100 dark:bg-ink-800 flex items-center justify-center mb-3"><ShoppingBag size={18} className="text-ink-600 dark:text-ink-300" /></div>
          <p className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display">{formatNum(totalOrders)}</p>
          <p className="text-xs text-ink-400 mt-1">Toplam Sipariş</p>
        </Card>
        <Card className="p-5">
          <div className="h-10 w-10 rounded-xl bg-cream-100 dark:bg-ink-800 flex items-center justify-center mb-3"><TrendingUp size={18} className="text-ink-600 dark:text-ink-300" /></div>
          <p className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display">{formatTRY(avgOrder)}</p>
          <p className="text-xs text-ink-400 mt-1">Ortalama Sepet</p>
        </Card>
        <Card className="p-5">
          <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center mb-3"><Crown size={18} className="text-amber-600" /></div>
          <p className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display">{formatNum(tiers.reduce((s, t) => s + t.value, 0))}</p>
          <p className="text-xs text-ink-400 mt-1">Toplam Üye</p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Sipariş & Ciro Trendi</h3>
              <p className="text-xs text-ink-400">Son {range} gün</p>
            </div>
            <Badge tone="green"><TrendingUp size={11} /> Canlı</Badge>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C8102E" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#C8102E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ordGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#18181B" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#18181B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" className="dark:opacity-20" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} formatter={(v: number, name: string) => name === 'Ciro' ? formatTRY(v) : formatNum(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => v === 'revenue' ? 'Ciro' : 'Sipariş'} />
              <Area yAxisId="left" type="monotone" dataKey="revenue" name="Ciro" stroke="#C8102E" strokeWidth={2.5} fill="url(#revGrad)" />
              <Area yAxisId="right" type="monotone" dataKey="orders" name="Sipariş" stroke="#18181B" strokeWidth={2} fill="url(#ordGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-1">Sipariş Durumları</h3>
          <p className="text-xs text-ink-400 mb-4">Dağılım</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={status} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={3}>
                {status.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-ink-400" />
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Saatlik Sipariş Dağılımı</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" className="dark:opacity-20" vertical={false} />
              <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9494A0' }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Bar dataKey="orders" fill="#18181B" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Üye Tier Dağılımı</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={tiers} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                {tiers.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Ürün Bazlı Ciro</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={catRev} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" className="dark:opacity-20" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#6E6E78' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Bar dataKey="value" fill="#C8102E" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Şube Performansı</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stores} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" className="dark:opacity-20" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#6E6E78' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Bar dataKey="value" fill="#18181B" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <PieIcon size={16} className="text-ink-400" />
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">En Çok Satan Ürünler (Adet)</h3>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={topProd}>
            <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" className="dark:opacity-20" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
            <Line type="monotone" dataKey="value" stroke="#C8102E" strokeWidth={2.5} dot={{ fill: '#C8102E', r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
