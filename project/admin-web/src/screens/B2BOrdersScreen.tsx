import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ChevronRight, RefreshCw, Building2, Store as StoreIcon,
} from 'lucide-react';
import { fetchB2BOrders, enrichB2BOrdersWithMeta } from '../lib/api';
import { supabase } from '../lib/supabase';
import {
  B2B_FILTER_CHIPS, B2B_STATUS_LABELS, B2B_STATUS_TONES,
  type B2BStatusFilter,
} from '../lib/b2b';
import { usePagination } from '../lib/usePagination';
import {
  Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader,
  SearchInput, Pagination,
} from '../lib/ui';
import { formatTRY, formatDateTime } from '../lib/utils';
import type { B2BOrderWithMeta } from '../lib/api';


const PAGE_SIZE = 25;

export function B2BOrdersScreen({ onOpenOrder }: { onOpenOrder: (orderId: string) => void }) {
  const [orders, setOrders] = useState<B2BOrderWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<B2BStatusFilter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchB2BOrders(filter === 'all' ? undefined : filter);
      setOrders(await enrichB2BOrdersWithMeta(data));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'B2B siparişler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-b2b-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'b2b_orders' }, () => {
        void loadRef.current();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = orders.filter(o =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.franchise_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (o.store_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const { page, setPage, pageCount, pageItems } = usePagination(filtered, PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="B2B Siparişleri"
        subtitle="Franchise tedarik siparişlerini yönetin ve takip edin"
        action={<Button variant="outline" size="sm" onClick={() => void load()}><RefreshCw size={14} /> Yenile</Button>}
      />

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {B2B_FILTER_CHIPS.map(chip => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key)}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
              filter === chip.key
                ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900'
                : 'bg-white border border-ink-100 text-ink-500 hover:bg-cream-50 dark:bg-ink-800 dark:border-ink-700 dark:text-ink-400'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Sipariş no, franchise veya şube ara…" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-ink-100 dark:bg-ink-800 rounded-xl animate-pulse" />
          ))}
          <Spinner label="B2B siparişler yükleniyor…" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={search ? 'Arama sonucu bulunamadı' : 'Sipariş bulunamadı'}
          subtitle={search ? `"${search}" için eşleşen sipariş yok` : 'Bu filtreye uygun B2B sipariş yok'}
        />
      ) : (
        <>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Sipariş No</th>
                    <th className="px-4 py-3 font-semibold">Franchise</th>
                    <th className="px-4 py-3 font-semibold">Şube</th>
                    <th className="px-4 py-3 font-semibold">Tarih</th>
                    <th className="px-4 py-3 font-semibold">Tutar</th>
                    <th className="px-4 py-3 font-semibold">Durum</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map(o => (
                    <tr
                      key={o.id}
                      onClick={() => onOpenOrder(o.id)}
                      className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover cursor-pointer"
                    >
                      <td className="px-4 py-3.5 font-semibold text-ink-900 dark:text-ink-100">{o.order_number}</td>
                      <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300">
                        <div className="flex items-center gap-1.5">
                          <Building2 size={13} className="text-ink-400" />
                          {o.franchise_name ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300">
                        <div className="flex items-center gap-1.5">
                          <StoreIcon size={13} className="text-ink-400" />
                          {o.store_name ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-ink-400 text-xs">{formatDateTime(o.created_at)}</td>
                      <td className="px-4 py-3.5 font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(o.total))}</td>
                      <td className="px-4 py-3.5"><Badge tone={B2B_STATUS_TONES[o.status]}>{B2B_STATUS_LABELS[o.status]}</Badge></td>
                      <td className="px-4 py-3.5">
                        <ChevronRight size={16} className="text-ink-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {pageCount > 1 && (
            <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
