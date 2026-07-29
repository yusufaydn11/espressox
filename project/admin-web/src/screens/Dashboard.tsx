import { useEffect, useState } from 'react';
import { TrendingUp, DollarSign, ShoppingBag, Users, Crown, Zap, UserPlus, Award } from 'lucide-react';import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { fetchDashboardKpis, fetchSalesSeries, fetchStoreComparison, fetchTopProducts, fetchOrders } from '../lib/api';
import { Card, StatCard, Spinner, ErrorState, Badge } from '../lib/ui';
import { formatTRY, formatNum, timeAgo } from '../lib/utils';
import { useAuth } from '../lib/auth';
import { Link } from 'react-router-dom';

export function Dashboard() {
  const { primaryRole, storeId } = useAuth();
  const [kpis, setKpis] = useState<Awaited<ReturnType<typeof fetchDashboardKpis>> | null>(null);
  const [sales, setSales] = useState<{ label: string; value: number }[]>([]);
  const [stores, setStores] = useState<{ label: string; value: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ label: string; value: number }[]>([]);
  const [recentOrders, setRecentOrders] = useState<Awaited<ReturnType<typeof fetchOrders>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [k, s, st, tp, ro] = await Promise.all([
        fetchDashboardKpis(), fetchSalesSeries(14), fetchStoreComparison(),
        fetchTopProducts(6), fetchOrders('all'),
      ]);
      setKpis(k); setSales(s); setStores(st); setTopProducts(tp);
      setRecentOrders(ro.slice(0, 6));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  if (loading) return <Spinner label="Dashboard yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!kpis) return null;

  const isScoped = primaryRole !== 'super_admin' && storeId;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display tracking-tight">Dashboard</h1>
        <p className="text-sm text-ink-400 mt-1">
          {isScoped ? 'Sadece sizin şubenizin performansı' : 'Tüm şubelerin genel performansı'}
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Bugünkü Satış" value={formatTRY(kpis.todaySales)} icon={<DollarSign size={18} className="text-ex-red" />} accent />
        <StatCard label="Aylık Ciro" value={formatTRY(kpis.monthRevenue)} sub="Bu ay başından beri" icon={<TrendingUp size={18} className="text-ink-600" />} />
        <StatCard label="Toplam Sipariş" value={formatNum(kpis.totalOrders)} icon={<ShoppingBag size={18} className="text-ink-600" />} />
        <StatCard label="Ort. Sepet" value={formatTRY(kpis.avgBasket)} icon={<DollarSign size={18} className="text-ink-600" />} />
        <StatCard label="Aktif Müşteri" value={formatNum(kpis.activeCustomers)} icon={<Users size={18} className="text-ink-600 dark:text-ink-300" />} />
        <StatCard label="Kullanılan Puan" value={formatNum(kpis.pointsRedeemed)} sub="Bu ay kullanılan sadakat puanı" icon={<Crown size={18} className="text-amber-600" />} />
        <StatCard label="Yeni Üyeler" value={formatNum(kpis.newMembers)} sub="Bu ay katılan" icon={<UserPlus size={18} className="text-ink-600 dark:text-ink-300" />} />
        <StatCard label="En Çok Satan" value={kpis.topProduct} sub="Tüm zamanlar" icon={<Award size={18} className="text-ink-600 dark:text-ink-300" />} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Satış Trendi</h3>
              <p className="text-xs text-ink-400">Son 14 gün</p>
            </div>
            <Badge tone="green"><TrendingUp size={11} /> Canlı</Badge>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={sales}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C8102E" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#C8102E" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEFF1" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Area type="monotone" dataKey="value" stroke="#C8102E" strokeWidth={2.5} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-1">Şube Karşılaştırma</h3>
          <p className="text-xs text-ink-400 mb-4">Toplam ciro</p>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stores} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" tick={{ fontSize: 10, fill: '#9494A0' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: '#6E6E78' }} axisLine={false} tickLine={false} width={70} />
              <Tooltip formatter={(v: number) => formatTRY(v)} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
              <Bar dataKey="value" fill="#18181B" radius={[0, 6, 6, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent orders */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Son Siparişler</h3>
            <Link to="/orders" className="text-xs font-semibold text-ex-red hover:underline">Tümü</Link>
          </div>
          <div className="space-y-2">
            {recentOrders?.length === 0 && <p className="text-sm text-ink-400 py-8 text-center">Henüz sipariş yok</p>}
            {recentOrders?.map(o => (
              <div key={o.id} className="flex items-center gap-3 py-2.5 border-b border-ink-100 last:border-0">
                <div className="h-9 w-9 rounded-lg bg-cream-100 flex items-center justify-center shrink-0">
                  <ShoppingBag size={15} className="text-ink-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">#{o.order_number}</p>
                  <p className="text-xs text-ink-400 truncate">{o.store_name} · {timeAgo(o.created_at)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(o.total))}</p>
                  <StatusBadge status={o.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top products */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">En Çok Satan Ürünler</h3>
          <div className="space-y-3">
            {topProducts.length === 0 && <p className="text-sm text-ink-400 py-8 text-center">Veri yok</p>}
            {topProducts.map((p, i) => {
              const max = topProducts[0]?.value || 1;
              return (
                <div key={p.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-ink-700 dark:text-ink-300 flex items-center gap-2">
                      <span className="text-xs font-bold text-ink-400 w-4">{i + 1}</span>
                      {p.label}
                    </span>
                    <span className="text-xs font-bold text-ink-900">{p.value} adet</span>
                  </div>
                  <div className="h-2 rounded-full bg-ink-100 overflow-hidden">
                    <div className="h-full rounded-full bg-red-gradient" style={{ width: `${(p.value / max) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'amber' | 'blue' | 'green' | 'red' | 'neutral'; label: string }> = {
    pending: { tone: 'amber', label: 'Yeni' },
    preparing: { tone: 'amber', label: 'Hazırlanıyor' },
    ready: { tone: 'blue', label: 'Hazır' },
    'picked-up': { tone: 'green', label: 'Teslim Alındı' },
    delivered: { tone: 'green', label: 'Teslim Edildi' },
    cancelled: { tone: 'red', label: 'İptal' },
  };
  const s = map[status] ?? { tone: 'neutral' as const, label: status };
  const tones: Record<string, string> = {
    amber: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400', blue: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400',
    green: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400', red: 'bg-ex-100 text-ex-red dark:bg-red-950 dark:text-red-400', neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  };
  return <span className={`badge ${tones[s.tone]}`}>{s.label}</span>;
}
