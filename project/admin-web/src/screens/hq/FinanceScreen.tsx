import { Navigate, useNavigate } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { PageHeader, Button, ErrorState, Spinner } from '../../lib/ui';
import { useHqFinance } from '../../hooks/useHqFinance';
import { HqSkeleton } from '../../components/hq';
import {
  FinanceKpiGrid,
  OpenInvoicesPanel,
  PaymentMovementsPanel,
  FranchiseFinanceTable,
} from '../../components/finance';

const HQ_ROLES = new Set(['super_admin', 'admin']);

export function FinanceScreen() {
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data, openInvoices, recentPayments, loading, error, reload } = useHqFinance();

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_ROLES.has(primaryRole)) return <Navigate to="/orders" replace />;

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <PageHeader
        title="HQ Finans"
        subtitle="B2B cari özet, açık faturalar ve ödeme hareketleri"
        action={
          <Button variant="outline" size="sm" onClick={reload}>
            <RefreshCw size={14} className="mr-1.5 inline" />
            Yenile
          </Button>
        }
      />

      {loading ? <HqSkeleton /> : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? null : (
        <>
          <FinanceKpiGrid summary={data.summary} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <OpenInvoicesPanel
              invoices={openInvoices}
              onOpenOrder={(orderId) => navigate(`/b2b-orders/${orderId}`)}
            />
            <PaymentMovementsPanel payments={recentPayments} />
          </div>

          <FranchiseFinanceTable
            rows={data.franchiseRows}
            onSelect={(id) => navigate(`/hq/finance/${id}`)}
          />
        </>
      )}
    </div>
  );
}
