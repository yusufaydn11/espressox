import { useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../lib/auth';
import { PageHeader, Button, ErrorState, Spinner } from '../lib/ui';
import { formatTRY } from '../lib/utils';
import { useHqReports } from '../hooks/useHqReports';
import {
  HqSkeleton,
  HqReportsKpiGrid,
  TopProductsRankPanel,
  RangeSelector,
} from '../components/hq';
import { SalesTrendChart, StorePerformanceGrid } from '../components/dashboard';

const HQ_ROLES = new Set(['super_admin', 'admin']);
const RANGE_OPTIONS = [
  { value: 7, label: '7 Gün' },
  { value: 30, label: '30 Gün' },
  { value: 90, label: '90 Gün' },
];
const PIE_COLORS = ['#C8102E', '#18181B', '#D4AF37', '#6E6E78', '#9494A0', '#C4C4CC'];

export function ReportsScreen() {
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const [range, setRange] = useState(30);
  const { data, summary, loading, error, reload } = useHqReports(range);

  const exportCsv = useCallback(() => {
    if (!data) return;
    const salesRows = [['Tarih', 'Ciro'], ...data.sales.map(s => [s.label, String(s.value)])];
    const storeRows = [['Şube', 'Ciro'], ...data.stores.map(s => [s.label, String(s.value)])];
    const productRows = [['Ürün', 'Adet'], ...data.topProducts.map(p => [p.label, String(p.value)])];
    const csv = [
      `# Espresso X Rapor — ${range} gün`,
      '',
      '--- Satış Trendi ---',
      ...salesRows.map(r => r.join(',')),
      '',
      '--- Şube Performansı ---',
      ...storeRows.map(r => r.join(',')),
      '',
      '--- En Çok Satan ---',
      ...productRows.map(r => r.join(',')),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `espresso-x-hq-rapor-${range}gun.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, range]);

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_ROLES.has(primaryRole)) return <Navigate to="/orders" replace />;

  if (loading) return <HqSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !summary) return null;

  const hasProducts = data.topProducts.some(p => p.value > 0);

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <PageHeader
        title="HQ Yönetim Raporları"
        subtitle="Satış analizi, şube karşılaştırması ve ürün performansı"
        action={
          <div className="flex items-center gap-2">
            <RangeSelector value={range} options={RANGE_OPTIONS} onChange={setRange} />
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download size={14} className="mr-1.5 inline" />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw size={14} className="mr-1.5 inline" />
              Yenile
            </Button>
          </div>
        }
      />

      <HqReportsKpiGrid
        totalRevenue={summary.totalRevenue}
        avgBasket={summary.avgBasket}
        newMembers={summary.newMembers}
        topStore={summary.topStore}
        range={range}
      />

      <SalesTrendChart data={data.sales} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StorePerformanceGrid stores={data.stores} />
        {hasProducts ? (
          <div className="admin-card p-5 min-w-0">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Ürün Satış Dağılımı</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={data.topProducts} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} innerRadius={50}>
                  {data.topProducts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => `${v} adet`} contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <TopProductsRankPanel data={[]} />
        )}
      </div>

      <TopProductsRankPanel data={data.topProducts} />

      <div className="admin-card p-5 text-xs text-ink-400">
        <p>Finans özeti: Aylık ciro {formatTRY(data.kpis.monthRevenue)} · Bugünkü satış {formatTRY(data.kpis.todaySales)} · Toplam sipariş {summary.totalOrders}</p>
      </div>
    </div>
  );
}
