import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { Button, Card, ErrorState, Spinner, Badge } from '../../lib/ui';
import { formatTRY, formatNum } from '../../lib/utils';
import { useHqFinance, useFranchiseFinance } from '../../hooks/useHqFinance';
import { HqSkeleton } from '../../components/hq';
import { OpenInvoicesPanel, PaymentMovementsPanel } from '../../components/finance';
import { EnterpriseKpiCard } from '../../components/dashboard/EnterpriseKpiCard';
import { DollarSign, ShoppingBag, Clock, TrendingUp } from 'lucide-react';

const HQ_ROLES = new Set(['super_admin', 'admin']);

export function FranchiseFinanceScreen() {
  const { franchiseId } = useParams<{ franchiseId: string }>();
  const navigate = useNavigate();
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const { data, loading, error, reload } = useHqFinance();
  const detail = useFranchiseFinance(franchiseId, data);

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_ROLES.has(primaryRole)) return <Navigate to="/orders" replace />;

  if (loading) return <HqSkeleton />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!detail) return <ErrorState message="Franchise bulunamadı" onRetry={() => navigate('/hq/finance')} />;

  const { franchise, orders, invoices, payments, row } = detail;
  const openInvoices = invoices.filter(i => i.status === 'issued' || i.status === 'partial');

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/hq/finance')}>
          <ArrowLeft size={16} className="mr-1.5 inline" />
          Finansa Dön
        </Button>
        <Button variant="outline" size="sm" onClick={reload} className="ml-auto">
          <RefreshCw size={14} className="mr-1.5 inline" />
          Yenile
        </Button>
      </div>

      <Card className="p-5 min-w-0">
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-ink-900 flex items-center justify-center">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-ink-900 dark:text-ink-100 font-display">{franchise.company_name}</h2>
            <p className="text-xs text-ink-400 mt-1">{franchise.authorized_email || franchise.authorized_phone || 'Franchise cari hesabı'}</p>
            {franchise.status !== 'active' && <Badge tone="red">{franchise.status === 'suspended' ? 'Askıda' : 'Sonlandırıldı'}</Badge>}
          </div>
        </div>
      </Card>

      {row && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <EnterpriseKpiCard variant="primary" label="Toplam Hacim" value={formatTRY(row.totalVolume)} sub={`${formatNum(row.orderCount)} sipariş`} icon={<DollarSign size={18} className="text-white" />} />
          <EnterpriseKpiCard variant="gold" label="Açık Tutar" value={formatTRY(row.openAmount)} sub={`${row.openOrders} açık sipariş`} icon={<Clock size={18} className="text-gold-700" />} />
          <EnterpriseKpiCard label="Teslim Edilen" value={formatTRY(row.deliveredVolume)} sub="Tamamlanan" icon={<TrendingUp size={18} className="text-ex-red" />} />
          <EnterpriseKpiCard label="Bekleyen Ödeme" value={formatNum(row.pendingPayments)} sub="Onay bekleyen" icon={<ShoppingBag size={18} className="text-ink-600" />} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OpenInvoicesPanel
          invoices={openInvoices}
          onOpenOrder={(orderId) => navigate(`/b2b-orders/${orderId}`)}
        />
        <PaymentMovementsPanel payments={payments} />
      </div>

      <Card className="p-5 min-w-0">
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3">Son B2B Siparişleri</h3>
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {orders.slice(0, 15).map(o => (
            <button
              key={o.id}
              type="button"
              onClick={() => navigate(`/b2b-orders/${o.id}`)}
              className="w-full flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-cream-50 dark:bg-ink-800 border border-ink-50 dark:border-ink-700 text-left hover:border-ex-red/30 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">#{o.order_number}</p>
                <p className="text-xs text-ink-400">{o.store_name ?? '—'}</p>
              </div>
              <p className="text-sm font-bold text-ex-red shrink-0">{formatTRY(Number(o.total))}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
