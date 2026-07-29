import { useEffect, useState, useCallback } from 'react';
import { Crown, Phone, Eye } from 'lucide-react';
import { fetchCustomers, fetchCustomerOrders } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, PageHeader, Modal, SearchInput, Pagination } from '../lib/ui';
import { formatTRY, formatNum, formatDate } from '../lib/utils';
import type { UserProfile, OrderRow } from '../lib/supabase';

const PAGE_SIZE = 12;

const SEGMENTS = [
  { id: 'all', label: 'Tümü' },
  { id: 'vip', label: 'VIP' },
  { id: 'new', label: 'Yeni' },
  { id: 'inactive', label: 'Pasif' },
];

export function CustomersScreen() {
  const [items, setItems] = useState<UserProfile[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [segment, setSegment] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchCustomers(segment)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Müşteriler yüklenemedi'); }
    finally { setLoading(false); }
  }, [segment]);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (c: UserProfile) => {
    setSelected(c);
    try { setOrders(await fetchCustomerOrders(c.user_id)); } catch { setOrders([]); }
  };

  const filtered = items?.filter(c => (c.full_name?.toLowerCase().includes(query.toLowerCase()) || c.phone?.includes(query))) ?? [];
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Müşteri Yönetimi" subtitle="Müşteri listesi ve segmentasyon" />

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {SEGMENTS.map(s => (
          <button key={s.id} onClick={() => setSegment(s.id)}
            className={`shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${segment === s.id ? 'bg-ink-900 text-white dark:bg-ink-100 dark:text-ink-900' : 'bg-white border border-ink-100 text-ink-500 hover:bg-cream-50 dark:bg-ink-800 dark:border-ink-700 dark:text-ink-400 dark:hover:bg-ink-700'}`}>
            {s.label}
          </button>
        ))}
        <div className="ml-auto">
          <SearchInput value={query} onChange={(v) => { setQuery(v); setPage(1); }} placeholder="İsim veya telefon ara…" />
        </div>
      </div>

      {loading ? <Spinner /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !filtered.length ? <EmptyState title="Müşteri yok" /> :
       <>
       <Card className="overflow-hidden">
         <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead className="bg-cream-50 dark:bg-ink-800 border-b border-ink-100 dark:border-ink-700">
               <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
                 <th className="px-4 py-3 font-semibold">Müşteri</th>
                 <th className="px-4 py-3 font-semibold">İletişim</th>
                 <th className="px-4 py-3 font-semibold">Seviye</th>
                 <th className="px-4 py-3 font-semibold">Puan</th>
                 <th className="px-4 py-3 font-semibold">Üyelik</th>
                 <th className="px-4 py-3"></th>
               </tr>
             </thead>
             <tbody>
               {pageItems.map(c => (
                 <tr key={c.id} className="border-b border-ink-100 dark:border-ink-800 last:border-0 table-row-hover">
                   <td className="px-4 py-3">
                     <div className="flex items-center gap-3">
                       <div className="h-9 w-9 rounded-xl bg-cream-200 dark:bg-ink-800 flex items-center justify-center text-xs font-bold text-ink-600 dark:text-ink-300 shrink-0">{c.full_name?.charAt(0).toUpperCase() ?? '?'}</div>
                       <div><p className="font-semibold text-ink-900 dark:text-ink-100">{c.full_name || 'İsimsiz'}</p>{c.is_blocked && <Badge tone="red">Engelli</Badge>}</div>
                     </div>
                   </td>
                   <td className="px-4 py-3.5 text-ink-600 dark:text-ink-300 text-xs">{c.phone || '—'}</td>
                   <td className="px-4 py-3.5"><Badge tone={c.tier === 'Altın' || c.tier === 'Siyah' || c.tier === 'VIP' ? 'gold' : 'neutral'}><Crown size={10} /> {c.tier}</Badge></td>
                   <td className="px-4 py-3.5 font-bold text-ink-900 dark:text-ink-100">{formatNum(c.points)}</td>
                   <td className="px-4 py-3.5 text-ink-400 text-xs">{formatDate(c.created_at)}</td>
                   <td className="px-4 py-3.5"><button onClick={() => openDetail(c)} className="text-ink-400 hover:text-ex-red"><Eye size={16} /></button></td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </Card>
       <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
       </>
      }

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Müşteri Detayı" size="lg">
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gold-gradient flex items-center justify-center text-xl font-bold text-white">{selected.full_name?.charAt(0).toUpperCase() ?? '?'}</div>
              <div>
                <h3 className="text-lg font-bold text-ink-900 dark:text-ink-100">{selected.full_name}</h3>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink-400">
                  {selected.phone && <span className="flex items-center gap-1"><Phone size={11} /> {selected.phone}</span>}
                  <Badge tone="gold"><Crown size={10} /> {selected.tier}</Badge>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Puan" value={formatNum(selected.points)} />
              <Stat label="Yaşamsal" value={formatNum(selected.lifetime_points)} />
              <Stat label="Seri" value={`${selected.streak}g`} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-2">Son Siparişler</h4>
              <div className="space-y-2">
                {orders.length === 0 && <p className="text-sm text-ink-400 py-4 text-center">Sipariş yok</p>}
                {orders.slice(0, 8).map(o => (
                  <div key={o.id} className="flex items-center justify-between py-2.5 px-3 bg-cream-50 dark:bg-ink-800 rounded-xl">
                    <div><p className="text-sm font-medium text-ink-900 dark:text-ink-100">#{o.order_number}</p><p className="text-xs text-ink-400">{formatDate(o.created_at)} · {o.store_name}</p></div>
                    <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(o.total))}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="bg-cream-50 dark:bg-ink-800 rounded-xl px-3 py-2.5 text-center"><p className="text-lg font-bold text-ink-900 dark:text-ink-100">{value}</p><p className="text-[10px] text-ink-400 mt-0.5">{label}</p></div>;
}
