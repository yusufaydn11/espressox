import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CheckCircle2, XCircle, Clock, Wallet, Boxes, Trash2, RotateCcw, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  paymentService, templateService, notificationService, orderService,
  b2bFormatTRY, b2bFormatDateTime, b2bTimeAgo,
  B2B_PAYMENT_STATUS_LABELS, B2B_PAYMENT_STATUS_TONES,
  type B2BPayment, type B2BOrderTemplate,
} from '@/services/b2b';
import {
  B2BScreenWrapper, B2BSectionTitle, B2BStatusBadge,
  B2BLoadingSpinner, B2BErrorState, B2BEmptyState, B2BConfirmDialog,
} from '@/components/b2b';

type ToastFn = (msg: string) => void;

export function B2BPayments({ franchiseId }: { franchiseId: string }) {
  const [payments, setPayments] = useState<B2BPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await paymentService.getRecent();
      setPayments(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ödemeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner label="Ödemeler yükleniyor…" /></B2BScreenWrapper>;
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;

  const totalSuccess = payments.filter(p => p.status === 'success').reduce((s, p) => s + p.amount, 0);

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Ödemeler" subtitle="Ödeme geçmişiniz" />

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-4 flex-row items-center gap-3 mb-4">
        <View className="h-10 w-10 rounded-xl bg-green-50 items-center justify-center"><CheckCircle2 size={20} color="#16a34a" /></View>
        <View><Text className="text-xs text-ink-400">Toplam Başarılı Ödeme</Text><Text className="text-xl font-bold text-ink-900">{b2bFormatTRY(totalSuccess)}</Text></View>
      </View>

      {payments.length === 0 ? (
        <B2BEmptyState title="Ödeme bulunamadı" icon={<Wallet size={32} color="#C8C4CC" />} />
      ) : (
        <View className="gap-3">
          {payments.map(p => (
            <View key={p.id} className="rounded-2xl bg-white border border-ink-100 shadow-card p-4 flex-row items-center gap-3">
              <View className={cn('h-10 w-10 rounded-xl items-center justify-center shrink-0', B2B_PAYMENT_STATUS_TONES[p.status] === 'green' ? 'bg-green-50' : B2B_PAYMENT_STATUS_TONES[p.status] === 'amber' ? 'bg-amber-50' : 'bg-red-50')}>
                {p.status === 'success' ? <CheckCircle2 size={20} color="#16a34a" /> : p.status === 'pending' ? <Clock size={20} color="#d97706" /> : <XCircle size={20} color="#C8102E" />}
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-bold text-ink-900">{p.payment_number}</Text>
                <Text className="text-[11px] text-ink-400">{b2bFormatDateTime(p.created_at)} · {p.provider} · {p.payment_method}</Text>
              </View>
              <View className="items-end gap-1">
                <Text className="text-sm font-bold text-ink-900">{b2bFormatTRY(p.amount)}</Text>
                <B2BStatusBadge label={B2B_PAYMENT_STATUS_LABELS[p.status] ?? p.status} tone={B2B_PAYMENT_STATUS_TONES[p.status]} />
              </View>
            </View>
          ))}
        </View>
      )}
    </B2BScreenWrapper>
  );
}

export function B2BTemplates({ showToast }: { showToast: ToastFn }) {
  const [templates, setTemplates] = useState<B2BOrderTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [reorderTarget, setReorderTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await templateService.getRecent();
      setTemplates(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Şablonlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await templateService.remove(deleteTarget);
      showToast('Şablon silindi');
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Silme başarısız');
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

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner label="Şablonlar yükleniyor…" /></B2BScreenWrapper>;
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Favori Siparişler" subtitle="Kaydedilmiş sipariş şablonlarınız" />

      {templates.length === 0 ? (
        <B2BEmptyState title="Şablon yok" subtitle="Siparişlerinizden 'Tekrarla' diyerek oluşturun" icon={<Boxes size={32} color="#C8C4CC" />} />
      ) : (
        <View className="gap-3">
          {templates.map(t => (
            <View key={t.id} className="rounded-2xl bg-white border border-ink-100 shadow-card p-4">
              <View className="flex-row items-start justify-between mb-2">
                <View className="h-10 w-10 rounded-xl bg-cream-100 items-center justify-center"><Boxes size={20} color="#6E6E78" /></View>
                <Pressable onPress={() => setDeleteTarget(t.id)} className="h-8 w-8 rounded-lg items-center justify-center">
                  <Trash2 size={16} color="#9494A0" />
                </Pressable>
              </View>
              <Text className="text-sm font-bold text-ink-900">{t.name}</Text>
              <Text className="text-[11px] text-ink-400 mt-1">{t.items.length} kalem · {b2bFormatDateTime(t.created_at)}</Text>
              <Pressable
                onPress={() => setReorderTarget(t.source_order_id ?? t.id)}
                className="flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl bg-ink-50 mt-3"
              >
                <RotateCcw size={14} color="#3D3D42" />
                <Text className="text-xs font-semibold text-ink-600">Tekrar Sipariş Ver</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <B2BConfirmDialog open={!!deleteTarget} title="Şablonu Sil" message="Bu şablonu silmek istediğinizden emin misiniz?" confirmLabel="Sil" onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} />
      <B2BConfirmDialog open={!!reorderTarget} title="Tekrar Sipariş Ver" message="Bu şablonun ürünleri sepete eklensin mi?" confirmLabel="Sepete Ekle" onConfirm={handleReorder} onClose={() => setReorderTarget(null)} danger={false} />
    </B2BScreenWrapper>
  );
}

export function B2BNotifications({ storeId, onOpenOrder }: { storeId: string; onOpenOrder?: (orderId: string) => void }) {
  const [notifs, setNotifs] = useState<Array<{ id: string; title: string; body: string; is_read: boolean; type: string; data: { order_id?: string; source?: string } | null; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveIndicator, setLiveIndicator] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await notificationService.getB2B();
      setNotifs(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bildirimler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const unsubscribe = notificationService.subscribeRealtime((newNotif) => {
      setNotifs(prev => [newNotif, ...prev].slice(0, 50));
      setLiveIndicator(true);
      setTimeout(() => setLiveIndicator(false), 2000);
    });
    return unsubscribe;
  }, [load]);

  const handlePress = async (n: { id: string; is_read: boolean; data: { order_id?: string } | null }) => {
    if (!n.is_read) {
      try {
        await notificationService.markRead(n.id);
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
      } catch { /* ignore */ }
    }
    const orderId = n.data?.order_id;
    if (orderId && onOpenOrder) onOpenOrder(orderId);
  };

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner label="Bildirimler yükleniyor…" /></B2BScreenWrapper>;
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Bildirimler" subtitle={liveIndicator ? 'Canlı — yeni bildirim alındı' : 'B2B sistem bildirimleriniz'} />

      {notifs.length === 0 ? (
        <B2BEmptyState title="Bildirim yok" icon={<Bell size={32} color="#C8C4CC" />} />
      ) : (
        <View className="gap-3">
          {notifs.map(n => {
            const orderId = n.data?.order_id;
            return (
              <Pressable
                key={n.id}
                onPress={() => handlePress(n)}
                disabled={!orderId || !onOpenOrder}
                className={cn('rounded-2xl border shadow-card p-4', n.is_read ? 'bg-white border-ink-100' : 'bg-white border-ex-red/20', orderId && onOpenOrder && 'active:opacity-70')}
              >
                <View className="flex-row items-start gap-3">
                  <View className={cn('h-9 w-9 rounded-xl items-center justify-center shrink-0', n.is_read ? 'bg-ink-50' : 'bg-ex-red/10')}>
                    <Bell size={16} color={n.is_read ? '#9494A0' : '#C8102E'} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-semibold text-ink-900">{n.title}</Text>
                    <Text className="text-sm text-ink-500 mt-0.5">{n.body}</Text>
                    <View className="flex-row items-center gap-2 mt-1.5">
                      <Text className="text-[11px] text-ink-300">{b2bTimeAgo(n.created_at)}</Text>
                      {orderId && onOpenOrder && (
                        <View className="flex-row items-center gap-1">
                          <View className="h-1 w-1 rounded-full bg-ink-300" />
                          <Text className="text-[11px] text-ex-red font-medium">Siparişe Git</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </B2BScreenWrapper>
  );
}
