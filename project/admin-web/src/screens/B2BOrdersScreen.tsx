import { useEffect, useState, useCallback } from 'react';
import {
  ChevronRight, RefreshCw, Building2, Store as StoreIcon, Calendar, Package,
} from 'lucide-react';
import {
  fetchB2BOrders, fetchStoreName, advanceB2BOrderStatus, rejectB2BOrder,
} from '../lib/api';
import {
  Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader,
  SearchInput,
} from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatTRY, formatDateTime } from '../lib/utils';
import type { B2BOrder, B2BOrderItem } from '../lib/supabase';

const STATUS_OPTIONS = ['all', 'paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];
const statusLabels: Record<string, string> = {
  all: 'Tümü',
  awaiting_payment: 'Ödeme Bekleniyor',
  paid: 'Onay Bekliyor',
  confirmed: 'Onaylandı',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoda',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};
const statusTones: Record<string, 'amber' | 'blue' | 'green' | 'red' | 'dark' | 'neutral'> = {
  awaiting_payment: 'amber',
  paid: 'amber',
  confirmed: 'blue',
  preparing: 'amber',
  shipped: 'dark',
  delivered: 'green',
  cancelled: 'red',
};

interface OrderWithMeta extends B2BOrder {
  b2b_order_items: B2BOrderItem[];
  franchise_name?: string;
  store_name?: string;
}

export function B2BOrdersScreen({ onOpenOrder }: { onOpenOrder: (orderId: string) => void }) {
  const [orders, setOrders] = useState<OrderWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const { success, error: toastError } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchB2BOrders(filter === 'all' ? undefined : filter);
      const sIds = [...new Set(data.map(o => o.store_id).filter(Boolean))] as string[];
      const fIds = [...new Set(data.map(o => o.franchise_id).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      const fNames: Record<string, string> = {};
      for (const sid of sIds) names[sid] = await fetchStoreName(sid);
      for (const fid of fIds) {
        const { data: f } = await (await import('../lib/supabase')).supabase
          .from('franchises').select('company_name').eq('id', fid).maybeSingle();
        if (f) fNames[fid] = (f as { company_name: string }).company_name;
      }
      setOrders(data.map(o => ({
        ...o,
        store_name: o.store_id ? names[o.store_id] ?? '—' : '—',
        franchise_name: o.franchise_id ? fNames[o.franchise_id] ?? '—' : '—',
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'B2B siparişler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.franchise_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (o.store_name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  const filterChips = [
    { key: 'all', label: 'Tümü' },
    { key: 'paid', label: 'Onay Bekliyor' },
    { key: 'confirmed', label: 'Onaylandı' },
    { key: 'preparing', label: 'Hazırlanıyor' },
    { key: 'shipped', label: 'Kargoda' },
    { key: 'delivered', label: 'Teslim Edildi' },
    { key: 'cancelled', label: 'İptal' },
  ] as const;

  return (
    <div>
      <PageHeader
        title="B2B Siparişleri"
        subtitle="Franchise tedarik siparişlerini yönetin ve takip edin"
        action={<Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /> Yenile</Button>}
      />

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {filterChips.map(chip => (
          <button
            key={chip.key}
            onClick={() => setFilter(chip.key as StatusFilter)}
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

      {loading ? <Spinner label="B2B siparişler yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       filtered.length === 0 ? <EmptyState title="Sipariş bulunamadı" subtitle="Bu filtreye uygun B2B sipariş yok" /> :
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
               {filtered.map(o => (
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
                   <td className="px-4 py-3.5"><Badge tone={statusTones[o.status]}>{statusLabels[o.status]}</Badge></td>
                   <td className="px-4 py-3.5">
                     <ChevronRight size={16} className="text-ink-400" />
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
       </Card>
      }
    </div>
  );
}

export { statusLabels, statusTones };
