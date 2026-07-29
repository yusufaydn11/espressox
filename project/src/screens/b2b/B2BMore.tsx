import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { CheckCircle2, XCircle, Clock, Wallet, Boxes, Trash2, RotateCcw, Bell, PackageCheck, Truck, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  paymentService, templateService, notificationService, orderService,
  b2bFormatTRY, b2bFormatDateTime, b2bTimeAgo,
  B2B_PAYMENT_STATUS_LABELS, B2B_PAYMENT_STATUS_TONES,
  type B2BPayment, type B2BOrderTemplate,
} from '@/services/b2b';
import { sumSuccessfulPaymentAmount } from '@shared/utils/payments';
import {
  B2B_NOTIFICATION_CATEGORIES,
  getB2BNotificationCategory,
  type B2BNotificationCategory,
} from '@shared/constants/b2bNotifications';
import {
  B2BScreenWrapper, B2BSectionTitle, B2BStatusBadge,
  B2BLoadingSpinner, B2BErrorState, B2BEmptyState, B2BConfirmDialog, B2BKpiCard,
} from '@/components/b2b';

type ToastFn = (msg: string) => void;

export function B2BPayments({ franchiseId: _franchiseId }: { franchiseId: string }) {
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

  const totalSuccess = sumSuccessfulPaymentAmount(payments);

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Ödemeler" subtitle="Ödeme geçmişiniz" />

      <View className="mb-4">
        <B2BKpiCard
          label="Toplam Başarılı Ödeme"
          value={b2bFormatTRY(totalSuccess)}
          icon={<CheckCircle2 size={18} color="#16a34a" />}
          variant="gold"
        />
      </View>

      {payments.length === 0 ? (
        <B2BEmptyState preset="payments" icon={<Wallet size={32} color="#C8C4CC" />} />
      ) : (
        <View className="gap-3">
          {payments.map(p => (
            <View key={p.id} className="rounded-3xl bg-white border border-ink-100 shadow-soft p-4 flex-row items-center gap-3">
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
      const num = result.new_order?.order_number;
      showToast(num ? `Yeni sipariş oluşturuldu: ${num}` : 'Yeni sipariş oluşturuldu');
      load();
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
        <B2BEmptyState preset="templates" icon={<Boxes size={32} color="#C8C4CC" />} />
      ) : (
        <View className="gap-3">
          {templates.map(t => (
            <View key={t.id} className="rounded-3xl bg-white border border-ink-100 shadow-soft p-4">
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
      <B2BConfirmDialog open={!!reorderTarget} title="Tekrar Sipariş Ver" message="Bu şablondan yeni bir sipariş oluşturulsun mu?" confirmLabel="Sipariş Oluştur" onConfirm={handleReorder} onClose={() => setReorderTarget(null)} danger={false} />
    </B2BScreenWrapper>
  );
}

type B2BNotifRow = {
  id: string;
  title: string;
  body: string;
  is_read: boolean;
  type: string;
  data: { order_id?: string; source?: string } | null;
  created_at: string;
};

const CATEGORY_ICONS: Record<B2BNotificationCategory, typeof Bell> = {
  order: PackageCheck,
  payment: Wallet,
  shipping: Truck,
  system: Info,
};

function filterB2BNotifications(rows: B2BNotifRow[], category: B2BNotificationCategory | 'all') {
  if (category === 'all') return rows;
  return rows.filter(n => getB2BNotificationCategory(n.data?.source, n.type) === category);
}

export function B2BNotifications({ storeId: _storeId, onOpenOrder }: { storeId: string; onOpenOrder?: (orderId: string) => void }) {
  const [notifs, setNotifs] = useState<B2BNotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [category, setCategory] = useState<B2BNotificationCategory | 'all'>('all');
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(
    () => filterB2BNotifications(notifs, category),
    [notifs, category],
  );

  const unreadCount = useMemo(() => notifs.filter(n => !n.is_read).length, [notifs]);

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
    void load();
    const unsubscribe = notificationService.subscribeRealtime((newNotif) => {
      setNotifs(prev => [newNotif, ...prev].slice(0, 50));
      setLiveIndicator(true);
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
      liveTimerRef.current = setTimeout(() => {
        setLiveIndicator(false);
        liveTimerRef.current = null;
      }, 2000);
    });
    return () => {
      unsubscribe();
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [load]);

  const handlePress = async (n: B2BNotifRow) => {
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
      <B2BSectionTitle
        title={unreadCount > 0 ? `B2B Bildirimleri (${unreadCount})` : 'B2B Bildirimleri'}
        subtitle={liveIndicator ? 'Canlı — yeni bildirim alındı' : 'Sipariş, ödeme ve kargo güncellemeleri'}
      />

      <View className="flex-row flex-wrap gap-2 mb-4">
        {B2B_NOTIFICATION_CATEGORIES.map(cat => (
          <Pressable
            key={cat.id}
            onPress={() => setCategory(cat.id)}
            className={cn(
              'px-3 py-1.5 rounded-full border',
              category === cat.id ? 'bg-ex-red border-ex-red' : 'bg-white border-ink-200',
            )}
          >
            <Text className={cn('text-xs font-semibold', category === cat.id ? 'text-white' : 'text-ink-500')}>
              {cat.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <B2BEmptyState preset="notifications" icon={<Bell size={32} color="#C8C4CC" />} />
      ) : (
        <View className="gap-3">
          {filtered.map(n => {
            const orderId = n.data?.order_id;
            const cat = getB2BNotificationCategory(n.data?.source, n.type);
            const CatIcon = CATEGORY_ICONS[cat];
            return (
              <Pressable
                key={n.id}
                onPress={() => handlePress(n)}
                disabled={!orderId || !onOpenOrder}
                className={cn('rounded-3xl border shadow-soft p-4', n.is_read ? 'bg-white border-ink-100' : 'bg-white border-ex-red/20', orderId && onOpenOrder && 'active:opacity-70')}
              >
                <View className="flex-row items-start gap-3">
                  <View className={cn('h-9 w-9 rounded-xl items-center justify-center shrink-0', n.is_read ? 'bg-ink-50' : 'bg-ex-red/10')}>
                    <CatIcon size={16} color={n.is_read ? '#9494A0' : '#C8102E'} />
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
