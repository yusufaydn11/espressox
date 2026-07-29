import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { Button, ErrorState, Spinner } from '../../lib/ui';
import { useCustomerDetail } from '../../hooks/useCustomerDetail';
import {
  CrmSkeleton,
  CustomerDetailHeader,
  LoyaltySummaryPanel,
  OrderHistoryPanel,
  LoyaltyHistoryPanel,
  CampaignActivityPanel,
} from '../../components/crm';
import { useCustomerLoyaltyDetail } from '../../hooks/useCustomerLoyaltyDetail';

const HQ_CRM_ROLES = new Set(['super_admin', 'admin']);

export function CustomerDetailScreen() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const { customer, orders, loading, error, reload } = useCustomerDetail(userId);
  const loyalty = useCustomerLoyaltyDetail(userId);

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_CRM_ROLES.has(primaryRole)) {
    return <Navigate to="/orders" replace />;
  }

  if (loading) return <CrmSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!customer) return <ErrorState message="Müşteri bulunamadı" onRetry={() => navigate('/crm')} />;

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <Button variant="ghost" size="sm" onClick={() => navigate('/crm')}>
        <ArrowLeft size={16} className="inline" />
        CRM'ye Dön
      </Button>

      <CustomerDetailHeader customer={customer} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LoyaltySummaryPanel customer={customer} />
        <OrderHistoryPanel orders={orders} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LoyaltyHistoryPanel
          items={loyalty.timeline}
          loading={loyalty.loading}
          error={loyalty.error}
          onRetry={loyalty.reload}
        />
        <CampaignActivityPanel items={loyalty.timeline} />
      </div>
    </div>
  );
}
