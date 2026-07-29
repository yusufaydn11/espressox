import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Truck, Package, Calendar, CreditCard, CheckCircle2,
  ExternalLink, Banknote, FileText, Clock, Building2, Store as StoreIcon,
  MapPin, XCircle, PackageCheck, ChefHat, User, MessageSquare, Download,
  StickyNote,
} from 'lucide-react';
import {
  fetchB2BOrderDetail, fetchB2BInvoicesForOrder, fetchB2BPaymentsForOrder,
  advanceB2BOrderStatus, updateB2BShipping, confirmB2BPayment, rejectB2BOrder,
  fetchFranchiseInfo, fetchStoreInfo, fetchB2BOrderTimeline, addB2BAdminNote,
  getB2BInvoicePdfUrl, getB2BOrderPdfUrl,
  type B2BTimelineEntry,
  type B2BOrderDetail,
} from '../lib/api';
import {
  Card, Spinner, ErrorState, Badge, Button, Modal,
} from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatTRY, formatDateTime, formatDate } from '../lib/utils';
import { getPaymentStatusLabel, getInvoiceStatusUiLabel } from '@shared/utils/payments';
import { B2B_PAYMENT_STATUS_UI_TONES, B2B_INVOICE_STATUS_UI_TONES } from '@shared/constants/payments';
import type { B2BOrderItem, B2BInvoice, B2BPayment, Franchise, Store } from '../lib/supabase';
import { B2B_STATUS_LABELS as statusLabels, B2B_STATUS_TONES as statusTones, B2B_STATUS_FLOW as STATUS_FLOW } from '../lib/b2b';
import { B2B_TIMELINE_LABELS } from '../lib/b2b';

const NEXT_STATUS: Record<string, { status: string; label: string; icon: typeof CheckCircle2; needsShipping?: boolean } | null> = {
  paid: { status: 'confirmed', label: 'Siparişi Onayla', icon: CheckCircle2 },
  confirmed: { status: 'preparing', label: 'Hazırlamaya Başla', icon: ChefHat },
  preparing: { status: 'shipped', label: 'Kargoya Ver', icon: Truck, needsShipping: true },
  shipped: { status: 'delivered', label: 'Teslim Edildi İşaretle', icon: PackageCheck },
  delivered: null,
  cancelled: null,
  awaiting_payment: null,
};

const TIMELINE_ICONS: Record<string, typeof Clock> = {
  b2b_order_created: Package,
  b2b_order_status_advanced: CheckCircle2,
  b2b_order_status_change: RefreshCw,
  b2b_order_rejected: XCircle,
  b2b_admin_note_added: StickyNote,
  b2b_shipping_updated: Truck,
  b2b_payment_processed: CreditCard,
};

export function B2BOrderDetailScreen({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<B2BOrderDetail | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [invoices, setInvoices] = useState<B2BInvoice[]>([]);
  const [payments, setPayments] = useState<B2BPayment[]>([]);
  const [timeline, setTimeline] = useState<B2BTimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [pendingAdvance, setPendingAdvance] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [adminNote, setAdminNote] = useState('');
  const [carrier, setCarrier] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [eta, setEta] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const { success, error: toastError } = useToast();

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [od, inv, pay, tl] = await Promise.all([
        fetchB2BOrderDetail(orderId),
        fetchB2BInvoicesForOrder(orderId),
        fetchB2BPaymentsForOrder(orderId),
        fetchB2BOrderTimeline(orderId),
      ]);
      setOrder(od);
      setInvoices(inv);
      setPayments(pay);
      setTimeline(tl);
      if (od?.franchise_id) setFranchise(await fetchFranchiseInfo(od.franchise_id));
      if (od?.store_id) setStore(await fetchStoreInfo(od.store_id));
      if (od) {
        setCarrier(od.carrier_company ?? '');
        setTrackingNo(od.tracking_number ?? '');
        setTrackingUrl(od.tracking_url ?? '');
        setEta(od.estimated_delivery ? od.estimated_delivery.split('T')[0] : '');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sipariş yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const handleAdvance = async (newStatus: string, opts?: { trackingNo?: string; carrier?: string; eta?: string }) => {
    setActionLoading(true);
    try {
      const result = await advanceB2BOrderStatus(orderId, newStatus, {
        ...opts,
        orderNumber: order?.order_number,
      });
      if (result.error === 'carrier_required') {
        toastError('Kargoya vermeden önce kargo firması girin');
        setShowShipModal(true);
        setPendingAdvance(newStatus);
        return;
      }
      if (result.error) { toastError(result.error); return; }
      success(`Sipariş durumu: ${statusLabels[newStatus]}`);
      setShowShipModal(false);
      setPendingAdvance(null);
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Durum güncellenemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      const result = await rejectB2BOrder(orderId, rejectReason, order?.order_number);
      if (result.error) { toastError(result.error); return; }
      success('Sipariş iptal edildi');
      setShowReject(false);
      setRejectReason('');
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'İptal başarısız');
    } finally {
      setActionLoading(false);
    }
  };

  const openOrderPdf = async () => {
    try {
      const url = await getB2BOrderPdfUrl(orderId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'PDF açılamadı');
    }
  };

  const openInvoicePdf = async (invoiceId: string) => {
    try {
      const url = await getB2BInvoicePdfUrl(invoiceId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'PDF açılamadı');
    }
  };

  const handleShippingSave = async () => {
    setActionLoading(true);
    try {
      const result = await updateB2BShipping(orderId, carrier, trackingNo, trackingUrl, eta || undefined, order?.order_number);
      if (result.error) { toastError(result.error); return; }
      success('Kargo bilgileri güncellendi');
      setShowShippingForm(false);
      if (pendingAdvance === 'shipped') {
        await handleAdvance('shipped', { trackingNo, carrier, eta: eta || undefined });
        return;
      }
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Kargo güncellenemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!adminNote.trim()) return;
    setActionLoading(true);
    try {
      const result = await addB2BAdminNote(orderId, adminNote.trim());
      if (result.error) { toastError(result.error); return; }
      success('Not eklendi');
      setAdminNote('');
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Not eklenemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPayment = async (paymentId: string) => {
    setActionLoading(true);
    try {
      const result = await confirmB2BPayment(paymentId);
      if (result.error) { toastError(result.error); return; }
      success('Ödeme onaylandı');
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Ödeme onaylanamadı');
    } finally {
      setActionLoading(false);
    }
  };

  const onAdvanceClick = (next: NonNullable<typeof NEXT_STATUS[string]>) => {
    if (next.needsShipping && !carrier.trim()) {
      setPendingAdvance(next.status);
      setShowShipModal(true);
      return;
    }
    const opts = next.status === 'shipped'
      ? { trackingNo, carrier, eta: eta || undefined }
      : undefined;
    handleAdvance(next.status, opts);
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-10 w-48 bg-ink-100 dark:bg-ink-800 rounded-xl" />
        <div className="grid lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-48 bg-ink-100 dark:bg-ink-800 rounded-2xl" />
            <div className="h-64 bg-ink-100 dark:bg-ink-800 rounded-2xl" />
          </div>
          <div className="h-72 bg-ink-100 dark:bg-ink-800 rounded-2xl" />
        </div>
        <Spinner label="Sipariş yükleniyor…" />
      </div>
    );
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!order) return <ErrorState message="Sipariş bulunamadı" onRetry={onBack} />;

  const nextStatus = NEXT_STATUS[order.status];
  const canReject = ['awaiting_payment', 'paid', 'confirmed', 'preparing'].includes(order.status);
  const pendingPayment = payments.find(p => p.status === 'pending');
  const currentFlowIdx = (STATUS_FLOW as readonly string[]).indexOf(order.status);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="h-10 w-10 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-600 dark:text-ink-300">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display tracking-tight">{order.order_number}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge tone={statusTones[order.status]}>{statusLabels[order.status]}</Badge>
              <span className="text-xs text-ink-400">{formatDateTime(order.created_at)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { void openOrderPdf(); }}>
            <Download size={14} /> Sipariş PDF
          </Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw size={14} /> Yenile</Button>
        </div>
      </div>

      {/* Status stepper */}
      {order.status !== 'cancelled' && order.status !== 'awaiting_payment' && (
        <Card className="p-5 mb-5">
          <div className="flex items-center justify-between overflow-x-auto gap-1 pb-1">
            {STATUS_FLOW.map((step, i) => {
              const done = currentFlowIdx > i;
              const active = order.status === step;
              return (
                <div key={step} className="flex items-center flex-1 min-w-[80px]">
                  <div className="flex flex-col items-center flex-1">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      done ? 'bg-green-500 text-white' : active ? 'bg-ex-red text-white' : 'bg-ink-100 dark:bg-ink-800 text-ink-400'
                    }`}>
                      {done ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    <span className={`text-[10px] mt-1.5 text-center leading-tight ${active ? 'font-bold text-ex-red' : 'text-ink-400'}`}>
                      {statusLabels[step]}
                    </span>
                  </div>
                  {i < STATUS_FLOW.length - 1 && (
                    <div className={`h-0.5 flex-1 mx-1 mb-4 ${done ? 'bg-green-400' : 'bg-ink-100 dark:bg-ink-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          {/* Order summary */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Sipariş Bilgileri</h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <SummaryItem icon={<Building2 size={15} />} label="Franchise" value={order.franchise_name ?? franchise?.company_name ?? '—'} />
              <SummaryItem icon={<StoreIcon size={15} />} label="Şube" value={order.store_name ?? store?.name ?? '—'} />
              <SummaryItem icon={<User size={15} />} label="Siparişi Oluşturan" value={order.creator_name ?? '—'} />
              <SummaryItem icon={<Calendar size={15} />} label="Sipariş Tarihi" value={formatDateTime(order.created_at)} />
            </div>
            {order.notes && (
              <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800">
                <p className="text-xs text-ink-400 mb-1">Franchise Notu</p>
                <p className="text-sm text-ink-700 dark:text-ink-200">{order.notes}</p>
              </div>
            )}
          </Card>

          {/* Items table */}
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-ink-100 dark:border-ink-800">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100">Sipariş Kalemleri</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-50 dark:bg-ink-800">
                  <tr className="text-left text-xs text-ink-400 uppercase tracking-wide">
                    <th className="px-4 py-3 w-14" />
                    <th className="px-4 py-3">Ürün</th>
                    <th className="px-4 py-3 text-center">Miktar</th>
                    <th className="px-4 py-3 text-right">Birim Fiyat</th>
                    <th className="px-4 py-3 text-right">KDV</th>
                    <th className="px-4 py-3 text-right">Satır Toplamı</th>
                  </tr>
                </thead>
                <tbody>
                  {order.b2b_order_items.map(it => (
                    <ItemRow key={it.id} item={it} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-5 border-t border-ink-100 dark:border-ink-800 space-y-2 bg-cream-50/50 dark:bg-ink-900/50">
              <TotalRow label="Ara Toplam" value={formatTRY(Number(order.subtotal))} />
              <TotalRow label="KDV" value={formatTRY(Number(order.vat_total))} />
              <TotalRow label="Genel Toplam" value={formatTRY(Number(order.total))} bold accent />
            </div>
          </Card>

          {/* Payment */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-ink-400" /> Ödeme Durumu
            </h3>
            <PaymentStatus order={order} />
            {payments.length > 0 && (
              <div className="mt-3 space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2.5 px-3 bg-cream-50 dark:bg-ink-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <Banknote size={16} className="text-ink-400" />
                      <div>
                        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{p.payment_number}</p>
                        <p className="text-xs text-ink-400">{p.provider} · {p.payment_method}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold">{formatTRY(Number(p.amount))}</span>
                      <Badge tone={B2B_PAYMENT_STATUS_UI_TONES[p.status] ?? 'neutral'}>{getPaymentStatusLabel(p.status)}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {order.status === 'awaiting_payment' && pendingPayment && (
              <div className="flex items-center justify-between mt-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                <p className="text-sm text-amber-800 dark:text-amber-400">Beklemede ödeme var — manuel onaylayın</p>
                <Button size="sm" disabled={actionLoading} onClick={() => handleConfirmPayment(pendingPayment.id)}>Ödemeyi Onayla</Button>
              </div>
            )}
          </Card>

          {/* Invoices */}
          {invoices.length > 0 && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2">
                <FileText size={16} className="text-ink-400" /> Faturalar
              </h3>
              <div className="space-y-2">
                {invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between py-2.5 px-3 bg-cream-50 dark:bg-ink-800 rounded-xl">
                    <div className="flex items-center gap-3">
                      <FileText size={16} className="text-ink-400" />
                      <div>
                        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{inv.invoice_number}</p>
                        <p className="text-xs text-ink-400">{formatDate(inv.issued_at)} · {formatTRY(Number(inv.total))}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge tone={B2B_INVOICE_STATUS_UI_TONES[inv.status] ?? 'neutral'}>{getInvoiceStatusUiLabel(inv.status)}</Badge>
                      <button
                        type="button"
                        onClick={() => { void openInvoicePdf(inv.id); }}
                        className="text-ex-red hover:underline flex items-center gap-1 text-xs font-semibold"
                      >
                        <ExternalLink size={14} /> PDF
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Sipariş Geçmişi</h3>
            {timeline.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-6">Henüz geçmiş kaydı yok</p>
            ) : (
              <div className="space-y-0">
                {[...timeline].reverse().map((t, i) => (
                  <TimelineRow key={i} entry={t} isLast={i === timeline.length - 1} />
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {franchise && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-ink-400" /> Franchise
              </h3>
              <div className="space-y-2.5">
                <InfoRow label="Firma" value={franchise.company_name} />
                <InfoRow label="Yetkili" value={franchise.authorized_person} />
                {franchise.authorized_phone && <InfoRow label="Telefon" value={franchise.authorized_phone} />}
              </div>
            </Card>
          )}

          {store && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3 flex items-center gap-2">
                <StoreIcon size={16} className="text-ink-400" /> Şube
              </h3>
              <div className="space-y-2.5">
                <InfoRow label="Şube" value={store.name} />
                {store.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-ink-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-ink-600 dark:text-ink-300">{store.address}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Admin notes */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3 flex items-center gap-2">
              <MessageSquare size={16} className="text-ink-400" /> Merkez Notları
            </h3>
            {order.admin_notes ? (
              <div className="text-sm text-ink-600 dark:text-ink-300 whitespace-pre-wrap mb-4 p-3 bg-cream-50 dark:bg-ink-800 rounded-xl leading-relaxed">
                {order.admin_notes}
              </div>
            ) : (
              <p className="text-xs text-ink-400 mb-3">Henüz not eklenmedi</p>
            )}
            {order.status !== 'cancelled' && (
              <div className="space-y-2">
                <textarea
                  className="admin-input min-h-[72px] w-full text-sm"
                  placeholder="Franchise'in göreceği not yazın…"
                  value={adminNote}
                  onChange={e => setAdminNote(e.target.value)}
                />
                <Button size="sm" full disabled={actionLoading || !adminNote.trim()} onClick={handleAddNote}>
                  Not Ekle
                </Button>
              </div>
            )}
          </Card>

          {/* Shipping */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 flex items-center gap-2">
                <Truck size={16} className="text-ink-400" /> Kargo & Teslimat
              </h3>
              {!showShippingForm && order.status !== 'cancelled' && (
                <Button variant="ghost" size="sm" onClick={() => setShowShippingForm(true)}>Düzenle</Button>
              )}
            </div>
            {!showShippingForm ? (
              <div className="space-y-2.5">
                <InfoRow label="Kargo Firması" value={order.carrier_company || '—'} />
                <InfoRow label="Takip No" value={order.tracking_number || '—'} />
                <InfoRow label="Tahmini Teslim" value={order.estimated_delivery ? formatDate(order.estimated_delivery) : '—'} />
                {order.tracking_url && (
                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-ex-red hover:underline flex items-center gap-1 text-xs font-semibold mt-2">
                    <ExternalLink size={14} /> Kargo Takibi
                  </a>
                )}
              </div>
            ) : (
              <ShippingForm
                carrier={carrier} trackingNo={trackingNo} trackingUrl={trackingUrl} eta={eta}
                onCarrier={setCarrier} onTrackingNo={setTrackingNo} onTrackingUrl={setTrackingUrl} onEta={setEta}
                onCancel={() => setShowShippingForm(false)}
                onSave={handleShippingSave}
                loading={actionLoading}
              />
            )}
          </Card>

          {/* Actions */}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3">Durum İşlemleri</h3>
              {nextStatus && (
                <Button full disabled={actionLoading} onClick={() => onAdvanceClick(nextStatus)}>
                  <nextStatus.icon size={16} /> {nextStatus.label}
                </Button>
              )}
              {canReject && (
                <Button variant="danger" full disabled={actionLoading} className="mt-2" onClick={() => setShowReject(true)}>
                  <XCircle size={16} /> Siparişi İptal Et
                </Button>
              )}
            </Card>
          )}

          {order.status === 'delivered' && (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-green-600" />
                <p className="text-sm text-green-700 dark:text-green-400">Sipariş teslim edildi</p>
              </div>
            </Card>
          )}
          {order.status === 'cancelled' && (
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-2">
                <XCircle size={18} className="text-ex-red" />
                <p className="text-sm text-ex-red">Sipariş iptal edildi</p>
              </div>
              {order.cancel_reason && <p className="text-sm text-ink-400">{order.cancel_reason}</p>}
            </Card>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      <Modal open={showReject} onClose={() => setShowReject(false)} title="Siparişi İptal Et" size="sm">
        <p className="text-sm text-ink-600 dark:text-ink-300 mb-3">Bu işlem geri alınamaz. Franchise bilgilendirilecektir.</p>
        <textarea className="admin-input min-h-[80px] w-full" placeholder="İptal nedeni (opsiyonel)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowReject(false)}>Vazgeç</Button>
          <Button variant="danger" size="sm" disabled={actionLoading} onClick={handleReject}>İptal Et</Button>
        </div>
      </Modal>

      {/* Shipping required modal */}
      <Modal open={showShipModal} onClose={() => { setShowShipModal(false); setPendingAdvance(null); }} title="Kargo Bilgileri Gerekli" size="sm">
        <p className="text-sm text-ink-600 dark:text-ink-300 mb-4">Kargoya vermeden önce kargo bilgilerini girin.</p>
        <ShippingForm
          carrier={carrier} trackingNo={trackingNo} trackingUrl={trackingUrl} eta={eta}
          onCarrier={setCarrier} onTrackingNo={setTrackingNo} onTrackingUrl={setTrackingUrl} onEta={setEta}
          onCancel={() => { setShowShipModal(false); setPendingAdvance(null); }}
          onSave={handleShippingSave}
          loading={actionLoading}
        />
      </Modal>
    </div>
  );
}

function ItemRow({ item }: { item: B2BOrderItem }) {
  return (
    <tr className="border-b border-ink-50 dark:border-ink-800 last:border-0">
      <td className="px-4 py-3">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="h-10 w-10 rounded-lg object-cover bg-ink-50" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-cream-100 dark:bg-ink-800 flex items-center justify-center">
            <Package size={16} className="text-ink-400" />
          </div>
        )}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium text-ink-900 dark:text-ink-100">{item.name}</p>
        <p className="text-xs text-ink-400 mt-0.5">{item.sku}</p>
      </td>
      <td className="px-4 py-3 text-center text-ink-600 dark:text-ink-300">{item.quantity} {item.unit}</td>
      <td className="px-4 py-3 text-right text-ink-600 dark:text-ink-300">{formatTRY(Number(item.unit_price))}</td>
      <td className="px-4 py-3 text-right text-ink-400">%{item.vat_rate}</td>
      <td className="px-4 py-3 text-right font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(item.line_total))}</td>
    </tr>
  );
}

function TimelineRow({ entry, isLast }: { entry: B2BTimelineEntry; isLast: boolean }) {
  const Icon = TIMELINE_ICONS[entry.action] ?? Clock;
  const label = B2B_TIMELINE_LABELS[entry.action] ?? entry.action;
  const d = entry.details;
  const fromLabel = (d.from_label as string) ?? statusLabels[d.from as string] ?? (d.from as string);
  const toLabel = (d.to_label as string) ?? statusLabels[d.to as string] ?? (d.to as string);

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 rounded-full bg-cream-100 dark:bg-ink-800 flex items-center justify-center shrink-0">
          <Icon size={14} className="text-ink-500" />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-ink-100 dark:bg-ink-700 my-1 min-h-[16px]" />}
      </div>
      <div className="pb-4 flex-1">
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{label}</p>
        <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(entry.created_at)} · {entry.actor_name}</p>
        {(d.from != null && d.to != null) && (
          <p className="text-xs text-ink-500 mt-1">{fromLabel} → {toLabel}</p>
        )}
        {d.note ? <p className="text-xs text-ink-400 mt-1 italic">&quot;{String(d.note)}&quot;</p> : null}
      </div>
    </div>
  );
}

function PaymentStatus({ order }: { order: B2BOrderDetail }) {
  if (order.paid_at) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950">
        <CheckCircle2 size={18} className="text-green-600" />
        <p className="text-sm text-green-700 dark:text-green-400">Ödeme alındı — {formatDateTime(order.paid_at)}</p>
      </div>
    );
  }
  if (order.status === 'cancelled') {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950">
        <XCircle size={18} className="text-ex-red" />
        <p className="text-sm text-ex-red">Sipariş iptal edildi</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950">
      <Clock size={18} className="text-amber-600" />
      <p className="text-sm text-amber-700 dark:text-amber-400">Ödeme bekleniyor</p>
    </div>
  );
}

function ShippingForm({ carrier, trackingNo, trackingUrl, eta, onCarrier, onTrackingNo, onTrackingUrl, onEta, onCancel, onSave, loading }: {
  carrier: string; trackingNo: string; trackingUrl: string; eta: string;
  onCarrier: (v: string) => void; onTrackingNo: (v: string) => void;
  onTrackingUrl: (v: string) => void; onEta: (v: string) => void;
  onCancel: () => void; onSave: () => void; loading: boolean;
}) {
  return (
    <div className="space-y-3">
      <input className="admin-input w-full" placeholder="Kargo firması *" value={carrier} onChange={e => onCarrier(e.target.value)} />
      <input className="admin-input w-full" placeholder="Takip numarası" value={trackingNo} onChange={e => onTrackingNo(e.target.value)} />
      <input className="admin-input w-full" placeholder="Takip linki (opsiyonel)" value={trackingUrl} onChange={e => onTrackingUrl(e.target.value)} />
      <input type="date" className="admin-input w-full" value={eta} onChange={e => onEta(e.target.value)} />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" full onClick={onCancel}>İptal</Button>
        <Button size="sm" full disabled={loading} onClick={onSave}>Kaydet</Button>
      </div>
    </div>
  );
}

function SummaryItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-8 w-8 rounded-lg bg-cream-100 dark:bg-ink-800 flex items-center justify-center shrink-0 text-ink-400">{icon}</div>
      <div>
        <p className="text-[11px] text-ink-400">{label}</p>
        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{value}</p>
      </div>
    </div>
  );
}

function TotalRow({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-bold' : 'text-sm'}`}>
      <span className={accent ? 'text-ink-900 dark:text-ink-100' : 'text-ink-400'}>{label}</span>
      <span className={accent ? 'text-ex-red' : 'font-medium text-ink-900 dark:text-ink-100'}>{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-400">{label}</span>
      <span className="text-sm font-medium text-ink-900 dark:text-ink-100 text-right">{value}</span>
    </div>
  );
}
