import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { Button, ErrorState, Spinner } from '../../lib/ui';
import { useHqStoreDetail } from '../../hooks/useHqStoreDetail';
import {
  HqSkeleton,
  StoreDetailHeader,
  FinanceSummaryPanel,
  OperationsSummaryPanel,
  StoreRecentOrdersPanel,
} from '../../components/hq';
import { StorePerformanceGrid } from '../../components/dashboard';

const HQ_ROLES = new Set(['super_admin', 'admin']);

export function StoreDetailScreen() {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const { data, opsSummary, loading, error, reload } = useHqStoreDetail(storeId);

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_ROLES.has(primaryRole)) return <Navigate to="/orders" replace />;

  if (loading) return <HqSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return <ErrorState message="Şube bulunamadı" onRetry={() => navigate('/hq/stores')} />;

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/hq/stores')}>
          <ArrowLeft size={16} className="mr-1.5 inline" />
          Performansa Dön
        </Button>
        <Button variant="outline" size="sm" onClick={reload} className="ml-auto">
          <RefreshCw size={14} className="mr-1.5 inline" />
          Yenile
        </Button>
      </div>

      <StoreDetailHeader store={data.store} franchise={data.franchise} rank={data.rank} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FinanceSummaryPanel
          revenue={data.revenue}
          revenueShare={data.revenueShare}
          rank={data.rank}
          kpis={data.kpis}
          avgOrderValue={data.avgOrderValue}
        />
        {opsSummary && (
          <OperationsSummaryPanel summary={opsSummary} storeName={data.store.name} />
        )}
      </div>

      <StoreRecentOrdersPanel orders={data.storeOrders} />

      <StorePerformanceGrid stores={data.comparison} />
    </div>
  );
}
