import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { LayoutGrid, List } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { Card, ErrorState, EmptyState, PageHeader, SearchInput, Pagination, Spinner } from '../../lib/ui';
import { useCrmCustomers, useCustomerSearch, type CrmSegment } from '../../hooks/useCrmCustomers';
import {
  CrmSkeleton,
  CrmDashboardPanels,
  CrmSegmentChips,
  CustomerProfileCard,
  CustomerListTable,
} from '../../components/crm';
import type { UserProfile } from '../../lib/supabase';

const HQ_CRM_ROLES = new Set(['super_admin', 'admin']);
const PAGE_SIZE = 12;

export function CrmScreen() {
  const { primaryRole, rolesLoaded, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [segment, setSegment] = useState<CrmSegment>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'grid' | 'table'>('grid');

  const { customers, summary, loading, error, reload } = useCrmCustomers(segment);
  const filtered = useCustomerSearch(customers, query);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (authLoading || !rolesLoaded) return <Spinner label="Yetkiler doğrulanıyor…" />;
  if (!primaryRole || !HQ_CRM_ROLES.has(primaryRole)) {
    return <Navigate to="/orders" replace />;
  }

  const openDetail = (c: UserProfile) => navigate(`/crm/${c.user_id}`);

  return (
    <div className="space-y-6 min-w-0 overflow-x-hidden">
      <PageHeader
        title="CRM"
        subtitle="Müşteri ilişkileri, segmentasyon ve sadakat yönetimi"
      />

      {loading ? <CrmSkeleton /> : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <>
          {segment === 'all' && summary && <CrmDashboardPanels summary={summary} />}

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CrmSegmentChips value={segment} onChange={(s) => { setSegment(s); setPage(1); }} />
            <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
              <SearchInput
                value={query}
                onChange={(v) => { setQuery(v); setPage(1); }}
                placeholder="İsim, telefon veya seviye ara…"
              />
              <div className="flex rounded-xl border border-ink-200 overflow-hidden shrink-0">
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
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="Müşteri bulunamadı" subtitle="Farklı bir segment veya arama deneyin" />
          ) : view === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {pageItems.map(c => (
                <CustomerProfileCard key={c.id} customer={c} onClick={() => openDetail(c)} />
              ))}
            </div>
          ) : (
            <Card className="overflow-hidden min-w-0">
              <CustomerListTable customers={pageItems} onSelect={openDetail} />
            </Card>
          )}

          <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
