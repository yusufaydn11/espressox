import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ChevronRight } from 'lucide-react';
import { fetchOrders, updateOrderStatus } from '../lib/api';
import { fetchOperationContextForUser } from '../services/loyalty/operationDataService';
import { resolveOrderBenefit } from '@shared/utils/orderBenefits';
import { OrderBenefitBlock } from '../components/operations/OrderBenefitBlock';
import type { OrderBenefitInfo } from '@shared/types/operations';
import { Card, Spinner, ErrorState, EmptyState, Button, PageHeader, Modal, SearchInput, Pagination, FilterChips } from '../lib/ui';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { formatTRY, formatDateTime } from '../lib/utils';
import { formatOrderTotalDisplay, getFreeOrderBadge } from '@shared/utils/orderDisplay';
import type { OrderRow, OrderItemRow } from '../lib/supabase';

const STATUSES = ['all', 'pending', 'preparing', 'ready', 'picked-up', 'delivered', 'cancelled'] as const;
type Status = typeof STATUSES[number];
import { ORDER_STATUS_LABELS_ADMIN } from '@shared/constants/orders';
const PAGE_SIZE = 15;

export function OrdersScreen() {
  const [orders, setOrders] = useState<(OrderRow & { order_items: OrderItemRow[] })[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<(OrderRow & { order_items: OrderItemRow[] }) | null>(null);
  const [selectedBenefit, setSelectedBenefit] = useState<OrderBenefitInfo | null>(null);
  const { success, error: toastError } = useToast();
  const { primaryRole } = useAuth();
  const canUpdateStatus = primaryRole !== 'staff';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setOrders(await fetchOrders(filter === 'all' ? undefined : filter));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Siparişler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!selected) {
      setSelectedBenefit(null);
      return;
    }
    void fetchOperationContextForUser(selected.user_id).then(ctx => {
      setSelectedBenefit(resolveOrderBenefit(selected, ctx));
    }).catch(() => setSelectedBenefit(null));
  }, [selected]);

  const changeStatus = async (id: string, status: string) => {
    try {
      await updateOrderStatus(id, status);
      setOrders(prev => prev?.map(o => o.id === id ? { ...o, status } : o) ?? null);
      if (selected?.id === id) setSelected({ ...selected, status });
      success('Sipariş durumu güncellendi');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Durum güncellenemedi');
    }
  };

  const filteredOrders = (orders ?? []).filter(o =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    o.store_name?.toLowerCase().includes(search.toLowerCase()),
  );
  const pageCount = Math.ceil(filteredOrders.length / PAGE_SIZE);
  const displayOrders = filteredOrders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader
        title="Sipariş Yönetimi"
        subtitle="Canlı sipariş akışı ve durum yönetimi"
        action={<Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /> Yenile</Button>}
      />

      <FilterChips
        options={[...STATUSES]}
        value={filter}
        onChange={(v) => { setFilter(v); setPage(1); }}
        labels={ORDER_STATUS_LABELS_ADMIN}
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Sipariş no veya şube ara…" />
      </div>

      {loading ? <Spinner label="Siparişler yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !orders || orders.length === 0 ? <EmptyState title="Sipariş bulunamadı" subtitle="Bu filtreye uygun sipariş yok" /> :
       <>
       <Card className="overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
               <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
                 <th className="px-4 py-3 font-semibold">Sipariş</th>
                 <th className="px-4 py-3 font-semibold">Şube</th>
                 <th className="px-4 py-3 font-semibold">Tür</th>
                 <th className="px-4 py-3 font-semibold">Tutar</th>
                 <th className="px-4 py-3 font-semibold">Tarih</th>
                 <th className="px-4 py-3 font-semibold">Durum</th>
                 <th className="px-4 py-3"></th>
               </tr>
             </thead>
             <tbody>
               {displayOrders.map(o => (
                 <tr key={o.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
                   <td className="px-4 py-3.5 font-semibold text-ink-900 dark:text-ink-100">#{o.order_number}</td>
                   <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300">{o.store_name}</td>
                   <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300 capitalize">{o.order_type}</td>
                   <td className="px-4 py-3.5 font-bold text-ink-900 dark:text-ink-100">
                     {formatOrderTotalDisplay(Number(o.total), formatTRY)}
                     {getFreeOrderBadge(Number(o.total)) && (
                       <span className="ml-2 text-[10px] font-semibold text-green-700 uppercase">Ücretsiz</span>
                     )}
                   </td>
                   <td className="px-4 py-3.5 text-ink-400 text-xs">{formatDateTime(o.created_at)}</td>
                   <td className="px-4 py-3.5"><StatusBadge status={o.status} /></td>
                   <td className="px-4 py-3.5">
                     <button onClick={() => setSelected(o)} className="text-ink-400 hover:text-ex-red">
                       <ChevronRight size={16} />
                     </button>
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </Card>
       <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
       </>
      }

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `Sipariş #${selected.order_number}` : ''} size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow label="Şube" value={selected.store_name} />
              <InfoRow label="Tür" value={selected.order_type} />
              <InfoRow label="Tarih" value={formatDateTime(selected.created_at)} />
              <InfoRow label="Puan Kazanıldı" value={`+${selected.points_earned}`} />
            </div>

            {selectedBenefit && <OrderBenefitBlock benefit={selectedBenefit} />}

            <div>
              <h4 className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-2">Ürünler</h4>
              <div className="space-y-2">
                {selected.order_items.map(it => (
                  <div key={it.id} className="flex items-center justify-between py-2.5 px-3 bg-cream-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-ink-900">{it.name}</p>
                      <p className="text-xs text-ink-400">Adet: {it.quantity}</p>
                    </div>
                    <p className="text-sm font-bold text-ink-900">{formatTRY(Number(it.unit_price) * it.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 px-3">
                <span className="text-sm font-semibold text-ink-600">Toplam</span>
                <span className={`text-lg font-bold font-display ${getFreeOrderBadge(Number(selected.total)) ? 'text-green-700' : 'text-ink-900'}`}>
                  {formatOrderTotalDisplay(Number(selected.total), formatTRY)}
                </span>
              </div>
              {getFreeOrderBadge(Number(selected.total)) && (
                <p className="text-xs text-ink-400 px-3">{getFreeOrderBadge(Number(selected.total))!.hint}</p>
              )}
            </div>

            {canUpdateStatus && (
            <div>
              <h4 className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-2">Durumu Değiştir</h4>
              <div className="flex flex-wrap gap-2">
                {STATUSES.filter(s => s !== 'all').map(s => (
                  <button
                    key={s}
                    onClick={() => changeStatus(selected.id, s)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${selected.status === s ? 'bg-ex-red text-white shadow-red' : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
                  >
                    {ORDER_STATUS_LABELS_ADMIN[s]}
                  </button>
                ))}
              </div>
            </div>
            )}
            {!canUpdateStatus && (
              <p className="text-xs text-ink-400">Personel hesapları sipariş durumunu güncelleyemez.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-cream-50 rounded-xl px-3.5 py-2.5">
      <p className="text-[10px] font-bold text-ink-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold text-ink-900 mt-0.5 capitalize">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    pending: { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400', label: 'Yeni' },
    preparing: { cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400', label: 'Hazırlanıyor' },
    ready: { cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400', label: 'Hazır' },
    'picked-up': { cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400', label: 'Teslim Alındı' },
    delivered: { cls: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-400', label: 'Teslim Edildi' },
    cancelled: { cls: 'bg-ex-100 text-ex-red dark:bg-red-950 dark:text-red-400', label: 'İptal' },
  };
  const s = map[status] ?? { cls: 'bg-ink-100 text-ink-600', label: status };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}
