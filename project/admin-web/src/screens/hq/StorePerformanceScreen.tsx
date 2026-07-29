import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LayoutGrid, List, RefreshCw } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import {
  Card, ErrorState, EmptyState, PageHeader, SearchInput, Pagination, Button, Spinner,
} from '../../lib/ui';
import { useHqStorePerformance, useStorePerformanceSearch } from '../../hooks/useHqStorePerformance';
import {
  HqSkeleton,
  HqStoreKpiGrid,
  StorePerformanceCard,
  StorePerformanceTable,
  OperationsSummaryPanel,
} from '../../components/hq';
import { StorePerformanceGrid } from '../../components/dashboard';
import type { StorePerformanceRow } from '../../hooks/useHqStorePerformance';

const HQ_ROLES = new Set(['super_admin', 'admin']);
const PAGE_SIZE = 12;

export function StorePerformanceScreen() {
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'grid' | 'table'>('grid');

  const { data, loading, error, reload } = useHqStorePerformance();
  const filtered = useStorePerformanceSearch(data?.stores ?? [], query);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_ROLES.has(primaryRole)) return <Navigate to="/orders" replace />;

  const openDetail = (s: StorePerformanceRow) => navigate(`/hq/stores/${s.id}`);

  const networkOps = data ? {
    totalRecent: data.recentOrders.length,
    pending: data.recentOrders.filter(o => o.status === 'pending').length,
    preparing: data.recentOrders.filter(o => o.status === 'preparing').length,
    ready: data.recentOrders.filter(o => o.status === 'ready').length,
    completed: data.recentOrders.filter(o => ['picked-up', 'delivered'].includes(o.status)).length,
  } : null;

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <PageHeader
        title="Şube Performansı"
        subtitle="HQ şube karşılaştırması, KPI ve operasyon özeti"
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
          <HqStoreKpiGrid summary={data.summary} />

          {networkOps && (
            <OperationsSummaryPanel summary={networkOps} storeName="Tüm ağ" />
          )}

          <StorePerformanceGrid stores={data.comparison} />

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <SearchInput
              value={query}
              onChange={(v) => { setQuery(v); setPage(1); }}
              placeholder="Şube veya adres ara…"
            />
            <div className="flex rounded-xl border border-ink-200 overflow-hidden shrink-0 sm:ml-auto">
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`p-2 ${view === 'grid' ? 'bg-ex-red text-white' : 'bg-white text-ink-500'}`}
                aria-label="Kart görünümü"
              >
                <LayoutGrid size={16} />
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={`p-2 ${view === 'table' ? 'bg-ex-red text-white' : 'bg-white text-ink-500'}`}
                aria-label="Tablo görünümü"
              >
                <List size={16} />
              </button>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Şube bulunamadı" subtitle="Farklı bir arama deneyin" />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pageItems.map(s => (
                <StorePerformanceCard key={s.id} store={s} onClick={() => openDetail(s)} />
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden min-w-0">
              <StorePerformanceTable stores={pageItems} onSelect={openDetail} />
            </Card>
          )}

          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
