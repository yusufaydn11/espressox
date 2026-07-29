import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { RefreshCw, Crown } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../lib/auth';
import { PageHeader, Button, ErrorState, Spinner, Card, EmptyState } from '../lib/ui';
import { useHqAnalytics } from '../hooks/useHqAnalytics';
import {
  HqSkeleton,
  HqAnalyticsKpiGrid,
  AnalyticsTrendPanel,
  StatusBreakdownPanel,
  CategoryRevenuePanel,
  TopProductsRankPanel,
  RangeSelector,
} from '../components/hq';
import { OrderDensityChart, StorePerformanceGrid } from '../components/dashboard';

const HQ_ROLES = new Set(['super_admin', 'admin']);
const RANGE_OPTIONS = [
  { value: 7, label: '7 Gün' },
  { value: 14, label: '14 Gün' },
  { value: 30, label: '30 Gün' },
  { value: 90, label: '90 Gün' },
];
const PIE_COLORS = ['#C8102E', '#18181B', '#D4AF37', '#3D3D42', '#9494A0', '#E2DFD7'];

export function AnalyticsScreen() {
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const [range, setRange] = useState(14);
  const { data, summary, loading, error, reload } = useHqAnalytics(range);

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_ROLES.has(primaryRole)) return <Navigate to="/orders" replace />;

  if (loading) return <HqSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data || !summary) return null;

  const hasTiers = data.tiers.some(t => t.value > 0);

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <PageHeader
        title="HQ Analitik"
        subtitle="Detaylı performans, trend ve segment analizi"
        action={
          <div className="flex items-center gap-2">
            <RangeSelector value={range} options={RANGE_OPTIONS} onChange={setRange} />
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw size={14} className="mr-1.5 inline" />
              Yenile
            </Button>
          </div>
        }
      />

      <HqAnalyticsKpiGrid summary={summary} range={range} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <AnalyticsTrendPanel data={data.trend} range={range} />
        <StatusBreakdownPanel data={data.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OrderDensityChart data={data.hourly} />
        <Card className="p-5 min-w-0">
          <div className="flex items-center gap-2 mb-4">
            <Crown size={16} className="text-amber-500" />
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Üye Tier Dağılımı</h3>
          </div>
          {!hasTiers ? (
            <EmptyState title="Üye verisi yok" subtitle="Tier dağılımı bulunamadı" />
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.tiers} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
                  {data.tiers.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #EFEFF1', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CategoryRevenuePanel data={data.categoryRevenue} />
        <StorePerformanceGrid stores={data.stores} />
      </div>

      <TopProductsRankPanel data={data.topProducts} />
    </div>
  );
}
