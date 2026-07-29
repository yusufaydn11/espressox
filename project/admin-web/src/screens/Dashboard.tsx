import { Navigate } from 'react-router-dom';
import {
  DollarSign, ShoppingBag, Store, Users, TrendingUp, RefreshCw,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { ErrorState, PageHeader, Button, Spinner } from '../lib/ui';
import { formatTRY, formatNum } from '../lib/utils';
import { useEnterpriseDashboard } from '../hooks/useEnterpriseDashboard';
import {
  EnterpriseKpiCard,
  DashboardSkeleton,
  SalesTrendChart,
  OrderDensityChart,
  RecentOrdersPanel,
  CriticalOrdersPanel,
  StoreActivityPanel,
  StorePerformanceGrid,
  LoyaltySnapshot,
} from '../components/dashboard';

const HQ_DASHBOARD_ROLES = new Set(['super_admin', 'admin']);

export function Dashboard() {
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const { data, loading, error, reload } = useEnterpriseDashboard();

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_DASHBOARD_ROLES.has(primaryRole)) {
    return <Navigate to="/orders" replace />;
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const { kpis, sales, stores, recentOrders, hourlyOrders, activeStores } = data;

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <PageHeader
        title="HQ Yönetim Merkezi"
        subtitle="Espresso X operasyon ve satış komuta merkezi"
        action={
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw size={14} className="mr-1.5 inline" />
            Yenile
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <EnterpriseKpiCard
          variant="primary"
          label="Toplam Ciro"
          value={formatTRY(kpis.monthRevenue)}
          sub="Bu ay"
          icon={<DollarSign size={18} className="text-white" />}
        />
        <EnterpriseKpiCard
          label="Sipariş Sayısı"
          value={formatNum(kpis.totalOrders)}
          sub="Tüm zamanlar"
          icon={<ShoppingBag size={18} className="text-ex-red" />}
        />
        <EnterpriseKpiCard
          variant="dark"
          label="Aktif Şube"
          value={String(activeStores)}
          sub="Satış kaydı olan şube"
          icon={<Store size={18} className="text-white" />}
        />
        <EnterpriseKpiCard
          label="Aktif Müşteri"
          value={formatNum(kpis.activeCustomers)}
          sub="Engellenmemiş profil"
          icon={<Users size={18} className="text-ink-600" />}
        />
        <EnterpriseKpiCard
          variant="gold"
          label="Bugünkü Satış"
          value={formatTRY(kpis.todaySales)}
          sub={`Ort. sepet ${formatTRY(kpis.avgBasket)}`}
          icon={<TrendingUp size={18} className="text-gold-700" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          <SalesTrendChart data={sales} />
          <OrderDensityChart data={hourlyOrders} />
        </div>
        <div className="min-w-0">
          <LoyaltySnapshot kpis={kpis} />
        </div>
      </div>

      <div className="min-w-0">
        <h2 className="text-base font-bold text-ink-900 dark:text-ink-100 font-display mb-4">Gerçek Zamanlı Operasyon</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <RecentOrdersPanel orders={recentOrders} />
          <StoreActivityPanel orders={recentOrders} />
          <CriticalOrdersPanel orders={recentOrders} />
        </div>
      </div>

      <StorePerformanceGrid stores={stores} />
    </div>
  );
}
