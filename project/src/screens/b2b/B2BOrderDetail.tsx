import { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Linking, Image } from 'react-native';
import {
  ArrowLeft, Truck, Package, Calendar, CreditCard, CheckCircle2, ExternalLink,
  Banknote, Building2, Clock, Download, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  orderService, paymentService, invoiceService, notificationService,
  b2bFormatTRY, b2bFormatDate, b2bFormatDateTime,
  B2B_ORDER_STATUS_LABELS, B2B_ORDER_STATUS_TONES, B2B_TIMELINE_LABELS,
  type B2BOrder, type B2BOrderItem, type B2BInvoice,
} from '@/services/b2b';
import { B2B_PAYMENT_METHODS } from '@shared/constants/payments';
import { getInvoiceStatusUiLabel } from '@shared/utils/payments';
import { B2B_INVOICE_STATUS_UI_TONES } from '@shared/constants/payments';
import {
  B2BScreenWrapper, B2BStatusBadge, B2BOrderTimeline,
  B2BLoadingSpinner, B2BErrorState, B2BConfirmDialog,
} from '@/components/b2b';

type ToastFn = (msg: string) => void;

const PAYMENT_METHODS = B2B_PAYMENT_METHODS.map(m => ({
  ...m,
  icon: m.id === 'bank_transfer' ? Building2 : CreditCard,
}));


export function B2BOrderDetail({ orderId, onBack, showToast }: { orderId: string; onBack: () => void; showToast: ToastFn }) {
  const [order, setOrder] = useState<(B2BOrder & { b2b_order_items: B2BOrderItem[] }) | null>(null);
  const [invoice, setInvoice] = useState<B2BInvoice | null>(null);
  const [timeline, setTimeline] = useState<Array<{ action: string; created_at: string; actor_name: string; details: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('bank_transfer');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [data, tl] = await Promise.all([
        orderService.getWithItems(orderId),
        orderService.getTimeline(orderId),
      ]);
      setOrder(data);
      setTimeline(tl);
      if (data && data.status !== 'awaiting_payment' && data.status !== 'cancelled') {
        const inv = await invoiceService.getForOrder(orderId);
        setInvoice(inv);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sipariş yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!order?.store_id) return;
    const unsubscribe = notificationService.subscribeOrderChanges(order.store_id, (updated) => {
      if (updated.id === orderId) void load();
    });
    return unsubscribe;
  }, [order?.store_id, orderId, load]);

  const handlePayment = async () => {
    if (!order) return;
    setPaying(true);
    try {
      const result = await paymentService.initiate(order.id, 'manual', selectedMethod);
      if (!result.success) {
        showToast(result.error ?? 'Ödeme başarısız');
        return;
      }
      if (result.pending) {
        showToast('Ödeme altyapısı hazırlanıyor');
      } else {
        showToast('Ödeme işlendi');
      }
      setShowPaymentSheet(false);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Ödeme başarısız');
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    try {
      await orderService.cancel(order.id, 'Kullanıcı iptali');
      showToast('Sipariş iptal edildi');
      onBack();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'İptal başarısız');
    }
  };

  const openOrderPdf = async () => {
    if (!order) return;
    try {
      const url = await invoiceService.getOrderPdfUrl(order.id);
      await Linking.openURL(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'PDF açılamadı');
    }
  };

  const openInvoicePdf = async (invoiceId: string) => {
    try {
      const url = await invoiceService.getInvoicePdfUrl(invoiceId);
      await Linking.openURL(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'PDF açılamadı');
    }
  };

  if (loading) {
    return (
      <B2BScreenWrapper>
        <View className="gap-3 mb-4">
          <View className="h-6 w-32 bg-ink-100 rounded-lg" />
          <View className="h-24 bg-ink-100 rounded-2xl" />
          <View className="h-40 bg-ink-100 rounded-2xl" />
        </View>
        <B2BLoadingSpinner label="Sipariş yükleniyor…" />
      </B2BScreenWrapper>
    );
  }
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;
  if (!order) return <B2BScreenWrapper><B2BErrorState message="Sipariş bulunamadı" onRetry={onBack} /></B2BScreenWrapper>;

  return (
    <B2BScreenWrapper>
      <Pressable onPress={onBack} className="flex-row items-center gap-2 mb-4">
        <ArrowLeft size={16} color="#6E6E78" />
        <Text className="text-sm text-ink-500">Siparişlere Dön</Text>
      </Pressable>

      <View className="flex-row items-start justify-between mb-5 gap-3">
        <View className="flex-1">
          <Text className="text-xl font-bold text-ink-900">{order.order_number}</Text>
          <Text className="text-xs text-ink-400 mt-1">{b2bFormatDateTime(order.created_at)}</Text>
        </View>
        <B2BStatusBadge label={B2B_ORDER_STATUS_LABELS[order.status]} tone={B2B_ORDER_STATUS_TONES[order.status]} />
      </View>

      <View className="mb-4">
        <B2BOrderTimeline status={order.status} />
      </View>

      <Pressable
        onPress={() => { void openOrderPdf(); }}
        className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-ink-50 border border-ink-100 mb-4"
      >
        <Download size={16} color="#3D3D42" />
        <Text className="text-sm font-semibold text-ink-600">Sipariş PDF / Yazdır</Text>
      </Pressable>

      {/* Items */}
      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-4">
        <Text className="text-sm font-bold text-ink-900 mb-4">Sipariş Kalemleri</Text>
        <View>
          {order.b2b_order_items.map((item, i) => (
            <View key={item.id} className={cn('flex-row items-center gap-3 py-3', i > 0 && 'border-t border-ink-50')}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} className="h-11 w-11 rounded-xl bg-ink-50" />
              ) : (
                <View className="h-11 w-11 rounded-xl bg-cream-100 items-center justify-center">
                  <Package size={18} color="#9494A0" />
                </View>
              )}
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-medium text-ink-900">{item.name}</Text>
                <Text className="text-[11px] text-ink-400 mt-0.5">{item.sku} · {item.quantity} {item.unit} × {b2bFormatTRY(item.unit_price)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-sm font-bold text-ink-900">{b2bFormatTRY(item.line_total)}</Text>
                <Text className="text-[10px] text-ink-400">KDV %{item.vat_rate}</Text>
              </View>
            </View>
          ))}
        </View>
        <View className="border-t border-ink-100 mt-4 pt-4 gap-2">
          <TotalRow label="Ara Toplam" value={b2bFormatTRY(order.subtotal)} />
          <TotalRow label="KDV" value={b2bFormatTRY(order.vat_total)} />
          <TotalRow label="Genel Toplam" value={b2bFormatTRY(order.total)} bold accent />
        </View>
      </View>

      {order.notes ? (
        <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-4">
          <Text className="text-sm font-bold text-ink-900 mb-2">Sipariş Notunuz</Text>
          <Text className="text-sm text-ink-500">{order.notes}</Text>
        </View>
      ) : null}

      {order.admin_notes ? (
        <View className="rounded-2xl bg-amber-50 border border-amber-100 shadow-card p-5 mb-4">
          <View className="flex-row items-center gap-2 mb-2">
            <MessageSquare size={16} color="#d97706" />
            <Text className="text-sm font-bold text-ink-900">Merkez Notları</Text>
          </View>
          <Text className="text-sm text-ink-600 leading-relaxed">{order.admin_notes}</Text>
        </View>
      ) : null}

      {(order.carrier_company || order.tracking_number || order.estimated_delivery) && (
        <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-4">
          <Text className="text-sm font-bold text-ink-900 mb-4">Kargo & Teslimat</Text>
          <View className="flex-row flex-wrap gap-4">
            {order.carrier_company ? <InfoItem icon={<Truck size={16} color="#6E6E78" />} label="Kargo" value={order.carrier_company} /> : null}
            {order.tracking_number ? <InfoItem icon={<Package size={16} color="#6E6E78" />} label="Takip No" value={order.tracking_number} /> : null}
            {order.estimated_delivery ? <InfoItem icon={<Calendar size={16} color="#6E6E78" />} label="Tahmini Teslim" value={b2bFormatDate(order.estimated_delivery)} /> : null}
          </View>
          {order.tracking_url ? (
            <Pressable onPress={() => Linking.openURL(order.tracking_url)} className="flex-row items-center gap-1.5 mt-4 py-2">
              <ExternalLink size={14} color="#C8102E" />
              <Text className="text-sm text-ex-red">Kargo Takibi</Text>
            </Pressable>
          ) : null}
        </View>
      )}

      {timeline.length > 0 && (
        <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-4">
          <Text className="text-sm font-bold text-ink-900 mb-4">Sipariş Geçmişi</Text>
          {[...timeline].reverse().map((t, i) => {
            const d = t.details;
            const fromLabel = (d.from_label as string) ?? B2B_ORDER_STATUS_LABELS[d.from as string] ?? '';
            const toLabel = (d.to_label as string) ?? B2B_ORDER_STATUS_LABELS[d.to as string] ?? '';
            return (
              <View key={i} className={cn('flex-row gap-3', i > 0 && 'mt-3 pt-3 border-t border-ink-50')}>
                <View className="h-8 w-8 rounded-full bg-cream-100 items-center justify-center shrink-0">
                  <Clock size={14} color="#9494A0" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-ink-900">{B2B_TIMELINE_LABELS[t.action] ?? t.action}</Text>
                  <Text className="text-[11px] text-ink-400 mt-0.5">{b2bFormatDateTime(t.created_at)} · {t.actor_name}</Text>
                  {fromLabel && toLabel ? (
                    <Text className="text-[11px] text-ink-500 mt-0.5">{fromLabel} → {toLabel}</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {invoice && (
        <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-4">
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-sm font-bold text-ink-900">Fatura</Text>
            <B2BStatusBadge label={getInvoiceStatusUiLabel(invoice.status)} tone={B2B_INVOICE_STATUS_UI_TONES[invoice.status] ?? 'neutral'} />
          </View>
          <Text className="text-sm text-ink-500 mb-3">Fatura No: {invoice.invoice_number}</Text>
          <Pressable onPress={() => { void openInvoicePdf(invoice.id); }} className="flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-ink-50">
            <ExternalLink size={16} color="#3D3D42" />
            <Text className="text-sm font-semibold text-ink-600">Faturayı Görüntüle</Text>
          </Pressable>
        </View>
      )}

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5">
        <Text className="text-sm font-bold text-ink-900 mb-4">İşlemler</Text>
        {order.status === 'awaiting_payment' && (
          <>
            {!showPaymentSheet ? (
              <Pressable onPress={() => setShowPaymentSheet(true)} className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-ex-red active:bg-ex-redDark mb-3">
                <CreditCard size={18} color="#fff" />
                <Text className="text-sm font-semibold text-white">Ödeme Yap — {b2bFormatTRY(order.total)}</Text>
              </Pressable>
            ) : (
              <PaymentSheet
                selectedMethod={selectedMethod}
                onSelectMethod={setSelectedMethod}
                onCancel={() => setShowPaymentSheet(false)}
                onPay={handlePayment}
                paying={paying}
                total={order.total}
              />
            )}
            <Pressable onPress={() => setShowCancel(true)} className="flex-row items-center justify-center gap-2 py-3 rounded-xl bg-red-50">
              <Text className="text-sm font-semibold text-ex-red">Siparişi İptal Et</Text>
            </Pressable>
          </>
        )}
        {order.status === 'paid' && (
          <View className="flex-row items-center gap-2">
            <CheckCircle2 size={18} color="#16a34a" />
            <Text className="text-sm text-green-700">Ödeme işlendi — merkez sipariş onayını bekliyor</Text>
          </View>
        )}
        {order.status === 'confirmed' && (
          <View className="flex-row items-center gap-2"><CheckCircle2 size={18} color="#2563eb" /><Text className="text-sm text-blue-600">Sipariş onaylandı, hazırlanıyor</Text></View>
        )}
        {order.status === 'preparing' && (
          <View className="flex-row items-center gap-2"><Package size={18} color="#d97706" /><Text className="text-sm text-amber-600">Sipariş hazırlanıyor</Text></View>
        )}
        {order.status === 'shipped' && (
          <View className="flex-row items-center gap-2"><Truck size={18} color="#3D3D42" /><Text className="text-sm text-ink-700">Kargoya verildi{order.carrier_company ? ` — ${order.carrier_company}` : ''}</Text></View>
        )}
        {order.status === 'delivered' && (
          <View className="flex-row items-center gap-2"><CheckCircle2 size={18} color="#16a34a" /><Text className="text-sm text-green-600">Teslim edildi</Text></View>
        )}
        {order.status === 'cancelled' && <Text className="text-sm text-ex-red">{order.cancel_reason || 'Sipariş iptal edildi'}</Text>}
      </View>

      <B2BConfirmDialog open={showCancel} title="Siparişi İptal Et" message="Bu siparişi iptal etmek istediğinizden emin misiniz?" confirmLabel="İptal Et" onConfirm={handleCancel} onClose={() => setShowCancel(false)} />
    </B2BScreenWrapper>
  );
}

function PaymentSheet({ selectedMethod, onSelectMethod, onCancel, onPay, paying, total }: {
  selectedMethod: string; onSelectMethod: (m: string) => void;
  onCancel: () => void; onPay: () => void; paying: boolean; total: number;
}) {
  return (
    <View className="mb-3">
      <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Ödeme Yöntemi</Text>
      <View className="gap-2 mb-4">
        {PAYMENT_METHODS.map(m => {
          const Icon = m.icon;
          const selected = selectedMethod === m.id;
          const isCard = m.id === 'card';
          return (
            <Pressable key={m.id} onPress={() => !isCard && onSelectMethod(m.id)} disabled={isCard}
              className={cn('flex-row items-center gap-3 p-3.5 rounded-xl border', selected ? 'border-ex-red bg-ex-red/5' : 'border-ink-100', isCard && 'opacity-50')}>
              <Icon size={18} color={selected ? '#C8102E' : '#6E6E78'} />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink-900">{m.label}</Text>
                <Text className="text-[11px] text-ink-400">{isCard ? 'Ödeme altyapısı hazırlanıyor' : m.desc}</Text>
              </View>
              {selected && <CheckCircle2 size={18} color="#C8102E" />}
            </Pressable>
          );
        })}
      </View>
      <View className="flex-row gap-2">
        <Pressable onPress={onCancel} className="flex-1 py-2.5 rounded-xl bg-ink-50 items-center"><Text className="text-sm font-medium text-ink-600">Vazgeç</Text></Pressable>
        <Pressable onPress={onPay} disabled={paying} className="flex-[2] flex-row items-center justify-center gap-2 py-2.5 rounded-xl bg-ex-red disabled:opacity-40">
          {paying ? <View className="h-5 w-5 rounded-full border-2 border-white border-t-transparent" /> : (
            <><Banknote size={16} color="#fff" /><Text className="text-sm font-semibold text-white">{b2bFormatTRY(total)} Öde</Text></>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function TotalRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <View className="flex-row justify-between">
      <Text className={cn('text-sm', accent ? 'font-bold text-ink-900' : 'text-ink-400')}>{label}</Text>
      <Text className={cn('text-sm', bold ? 'text-lg font-bold' : 'font-medium', accent ? 'text-ex-red' : 'text-ink-900')}>{value}</Text>
    </View>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View className="flex-row items-center gap-2">
      {icon}
      <View><Text className="text-[11px] text-ink-400">{label}</Text><Text className="text-sm font-medium text-ink-900">{value}</Text></View>
    </View>
  );
}
