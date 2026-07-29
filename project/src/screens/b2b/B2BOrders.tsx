import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { PackageCheck, ChevronRight, RotateCcw, ChevronLeft } from 'lucide-react';
import { usePagination } from '@/lib/usePagination';
import {
  orderService,
  b2bFormatTRY, b2bFormatDate, B2B_ORDER_STATUS_LABELS, B2B_ORDER_STATUS_TONES,
  type B2BOrder,
} from '@/services/b2b';
import {
  B2BScreenWrapper, B2BSectionTitle, B2BFilterChips, B2BStatusBadge,
  B2BLoadingSpinner, B2BErrorState, B2BEmptyState, B2BConfirmDialog,
} from '@/components/b2b';

type ToastFn = (msg: string) => void;

const STATUS_FILTERS = [
  { id: 'all', label: 'Tümü' },
  { id: 'draft', label: 'Taslak' },
  { id: 'awaiting_payment', label: 'Ödeme Bekleniyor' },
  { id: 'paid', label: 'Ödeme Alındı' },
  { id: 'preparing', label: 'Hazırlanıyor' },
  { id: 'shipped', label: 'Kargoda' },
  { id: 'delivered', label: 'Teslim Edildi' },
  { id: 'cancelled', label: 'İptal' },
];

export function B2BOrders({ showToast, onSelectOrder }: { showToast: ToastFn; onSelectOrder: (orderId: string) => void }) {
  const [orders, setOrders] = useState<(B2BOrder & { b2b_order_items: { id: string; name: string }[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await orderService.listWithItems();
      setOrders(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Siparişler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'all') return orders;
    return orders.filter(o => o.status === filter);
  }, [orders, filter]);

  const { pageItems, page, setPage, totalPages, hasPrev, hasNext, total } = usePagination(filtered, 15);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    try {
      await orderService.cancel(cancelTarget, 'Kullanıcı iptali');
      showToast('Sipariş iptal edildi');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'İptal başarısız');
    }
  };

  const handleReorder = async () => {
    if (!reorderTarget) return;
    try {
      const result = await orderService.reorder(reorderTarget);
      if (result.error) { showToast(result.error); return; }
      showToast('Sipariş sepete eklendi');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Tekrar sipariş başarısız');
    }
  };

  if (loading) {
    return (
      <B2BScreenWrapper>
        <View className="gap-3 mb-2">
          {[1, 2, 3].map(i => <View key={i} className="h-16 bg-ink-100 rounded-2xl" />)}
        </View>
        <B2BLoadingSpinner label="Siparişler yükleniyor…" />
      </B2BScreenWrapper>
    );
  }
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Siparişlerim" subtitle="Tüm tedarik siparişleriniz" />

      <View className="mb-4"><B2BFilterChips options={STATUS_FILTERS} value={filter} onChange={setFilter} /></View>

      {filtered.length === 0 ? (
        <B2BEmptyState
          title={filter !== 'all' ? 'Bu filtrede sipariş yok' : 'Henüz sipariş yok'}
          subtitle={filter !== 'all' ? 'Farklı bir filtre deneyin' : 'Tedarik ürünlerinden sipariş oluşturun'}
          icon={<PackageCheck size={28} color="#C8C4CC" />}
        />
      ) : (
        <View className="gap-3">
          {pageItems.map(o => (
            <View key={o.id}>
              <Pressable
                onPress={() => onSelectOrder(o.id)}
                className="rounded-2xl bg-white border border-ink-100 shadow-card p-4"
              >
                <View className="flex-row items-center justify-between gap-3">
                  <View className="flex-row items-center gap-3 flex-1 min-w-0">
                    <View className="h-10 w-10 rounded-xl bg-cream-100 items-center justify-center shrink-0">
                      <PackageCheck size={20} color="#6E6E78" />
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-bold text-ink-900">{o.order_number}</Text>
                      <Text className="text-[11px] text-ink-400">{b2bFormatDate(o.created_at)} · {o.b2b_order_items.length} kalem</Text>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2 shrink-0">
                    <B2BStatusBadge label={B2B_ORDER_STATUS_LABELS[o.status]} tone={B2B_ORDER_STATUS_TONES[o.status]} />
                    <Text className="text-sm font-bold text-ink-900">{b2bFormatTRY(o.total)}</Text>
                    <ChevronRight size={16} color="#C8C4CC" />
                  </View>
                </View>
              </Pressable>

              {(o.status === 'draft' || o.status === 'awaiting_payment') && (
                <View className="flex-row gap-2 mt-2">
                  <Pressable
                    onPress={() => setCancelTarget(o.id)}
                    className="flex-1 py-2 rounded-xl bg-red-50 items-center"
                  >
                    <Text className="text-xs font-semibold text-ex-red">İptal Et</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setReorderTarget(o.id)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-2 rounded-xl bg-ink-50"
                  >
                    <RotateCcw size={12} color="#3D3D42" />
                    <Text className="text-xs font-semibold text-ink-600">Tekrarla</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))}
        </View>
      )}

      {totalPages > 1 && (
        <View className="flex-row items-center justify-between mt-4 px-1">
          <Text className="text-xs text-ink-400">{total} sipariş · Sayfa {page + 1}/{totalPages}</Text>
          <View className="flex-row gap-2">
            <Pressable
              disabled={!hasPrev}
              onPress={() => setPage(page - 1)}
              className={`h-9 w-9 rounded-xl items-center justify-center ${hasPrev ? 'bg-ink-100' : 'bg-ink-50 opacity-40'}`}
            >
              <ChevronLeft size={16} color="#3D3D42" />
            </Pressable>
            <Pressable
              disabled={!hasNext}
              onPress={() => setPage(page + 1)}
              className={`h-9 w-9 rounded-xl items-center justify-center ${hasNext ? 'bg-ink-100' : 'bg-ink-50 opacity-40'}`}
            >
              <ChevronRight size={16} color="#3D3D42" />
            </Pressable>
          </View>
        </View>
      )}

      <B2BConfirmDialog
        open={!!cancelTarget}
        title="Siparişi İptal Et"
        message="Bu siparişi iptal etmek istediğinizden emin misiniz?"
        confirmLabel="İptal Et"
        onConfirm={handleCancel}
        onClose={() => setCancelTarget(null)}
      />
      <B2BConfirmDialog
        open={!!reorderTarget}
        title="Tekrar Sipariş Ver"
        message="Bu siparişin ürünleri sepete eklensin mi?"
        confirmLabel="Sepete Ekle"
        onConfirm={handleReorder}
        onClose={() => setReorderTarget(null)}
        danger={false}
      />
    </B2BScreenWrapper>
  );
}
