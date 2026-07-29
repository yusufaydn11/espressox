import { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, RefreshCw, Truck, Package, Calendar, CreditCard, CheckCircle2,
  ExternalLink, Banknote, FileText, Clock, Building2, Store as StoreIcon,
  MapPin, Phone, XCircle, PackageCheck, ChefHat, X,
} from 'lucide-react';
import {
  fetchB2BOrderDetail, fetchB2BInvoicesForOrder, fetchB2BPaymentsForOrder,
  advanceB2BOrderStatus, updateB2BShipping, confirmB2BPayment, rejectB2BOrder,
  fetchFranchiseInfo, fetchStoreInfo, fetchB2BOrderTimeline,
  getB2BInvoicePdfUrl,
} from '../lib/api';
import {
  Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader,
  Modal,
} from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatTRY, formatDateTime, formatDate } from '../lib/utils';
import type { B2BOrder, B2BOrderItem, B2BInvoice, B2BPayment, Franchise, Store } from '../lib/supabase';
import { statusLabels, statusTones } from './B2BOrdersScreen';

const NEXT_STATUS: Record<string, { status: string; label: string; icon: typeof CheckCircle2 } | null> = {
  paid: { status: 'confirmed', label: 'Siparişi Onayla', icon: CheckCircle2 },
  confirmed: { status: 'preparing', label: 'Hazırlamaya Başla', icon: ChefHat },
  preparing: { status: 'shipped', label: 'Kargoya Ver', icon: Truck },
  shipped: { status: 'delivered', label: 'Teslim Edildi', icon: PackageCheck },
  delivered: null,
  cancelled: null,
  awaiting_payment: null,
};

const TIMELINE_ICONS: Record<string, typeof Clock> = {
  b2b_order_created: Package,
  b2b_order_status_advanced: CheckCircle2,
  b2b_order_status_change: RefreshCw,
  b2b_order_rejected: XCircle,
};
const TIMELINE_LABELS: Record<string, string> = {
  b2b_order_created: 'Sipariş Oluşturuldu',
  b2b_order_status_advanced: 'Durum Güncellendi',
  b2b_order_status_change: 'Durum Değişti',
  b2b_order_rejected: 'Sipariş Reddedildi',
};

export function B2BOrderDetailScreen({ orderId, onBack }: { orderId: string; onBack: () => void }) {
  const [order, setOrder] = useState<(B2BOrder & { b2b_order_items: B2BOrderItem[] }) | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [invoices, setInvoices] = useState<B2BInvoice[]>([]);
  const [payments, setPayments] = useState<B2BPayment[]>([]);
  const [timeline, setTimeline] = useState<{ action: string; created_at: string; details: Record<string, unknown> }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
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
      if (od?.franchise_id) {
        const f = await fetchFranchiseInfo(od.franchise_id);
        setFranchise(f);
      }
      if (od?.store_id) {
        const s = await fetchStoreInfo(od.store_id);
        setStore(s);
      }
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
      const result = await advanceB2BOrderStatus(orderId, newStatus, opts);
      if (result.error) { toastError(result.error); return; }
      success(`Sipariş durumu: ${statusLabels[newStatus]}`);
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
      const result = await rejectB2BOrder(orderId, rejectReason);
      if (result.error) { toastError(result.error); return; }
      success('Sipariş reddedildi');
      setShowReject(false);
      setRejectReason('');
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Reddetme başarısız');
    } finally {
      setActionLoading(false);
    }
  };

  const handleShippingSave = async () => {
    setActionLoading(true);
    try {
      const result = await updateB2BShipping(orderId, carrier, trackingNo, trackingUrl, eta || undefined);
      if (result.error) { toastError(result.error); return; }
      success('Kargo bilgileri güncellendi');
      setShowShippingForm(false);
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Kargo güncellenemedi');
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

  if (loading) return <Spinner label="Sipariş yükleniyor…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!order) return <ErrorState message="Sipariş bulunamadı" />;

  const nextStatus = NEXT_STATUS[order.status];
  const canReject = ['awaiting_payment', 'paid', 'confirmed', 'preparing'].includes(order.status);
  const pendingPayment = payments.find(p => p.status === 'pending');

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="h-10 w-10 rounded-xl hover:bg-ink-100 dark:hover:bg-ink-800 flex items-center justify-center text-ink-600 dark:text-ink-300">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-ink-900 dark:text-ink-100 font-display tracking-tight">{order.order_number}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge tone={statusTones[order.status]}>{statusLabels[order.status]}</Badge>
            <span className="text-xs text-ink-400">{formatDateTime(order.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Left column: Items + Payment + Invoice + Timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Items */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Sipariş Kalemleri</h3>
            <div className="space-y-1">
              {order.b2b_order_items.map(it => (
                <div key={it.id} className="flex items-center justify-between py-3 border-b border-ink-50 dark:border-ink-800 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{it.name}</p>
                    <p className="text-xs text-ink-400 mt-0.5">{it.sku} · {it.quantity} {it.unit} × {formatTRY(Number(it.unit_price))}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{formatTRY(Number(it.line_total))}</p>
                    <p className="text-[11px] text-ink-400">KDV %{it.vat_rate}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-ink-100 dark:border-ink-800 space-y-2">
              <div className="flex justify-between text-sm"><span className="text-ink-400">Ara Toplam</span><span className="font-medium text-ink-900 dark:text-ink-100">{formatTRY(Number(order.subtotal))}</span></div>
              <div className="flex justify-between text-sm"><span className="text-ink-400">KDV</span><span className="font-medium text-ink-900 dark:text-ink-100">{formatTRY(Number(order.vat_total))}</span></div>
              <div className="flex justify-between text-base font-bold"><span className="text-ink-900 dark:text-ink-100">Genel Toplam</span><span className="text-ex-red">{formatTRY(Number(order.total))}</span></div>
            </div>
          </Card>

          {/* Payment */}
          <Card className="p-5">
            <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2">
              <CreditCard size={16} className="text-ink-400" /> Ödeme Durumu
            </h3>
            {order.paid_at ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950">
                <CheckCircle2 size={18} className="text-green-600" />
                <p className="text-sm text-green-700 dark:text-green-400">Ödeme alındı — {formatDateTime(order.paid_at)}</p>
              </div>
            ) : order.status === 'cancelled' ? (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950">
                <XCircle size={18} className="text-ex-red" />
                <p className="text-sm text-ex-red">Sipariş iptal edildi</p>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950">
                <Clock size={18} className="text-amber-600" />
                <p className="text-sm text-amber-700 dark:text-amber-400">Ödeme bekleniyor</p>
              </div>
            )}
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
                      {p.status === 'success' && <Badge tone="green">Başarılı</Badge>}
                      {p.status === 'pending' && <Badge tone="amber">Beklemede</Badge>}
                      {p.status === 'failed' && <Badge tone="red">Başarısız</Badge>}
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

          {/* Invoice */}
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
                      {inv.status === 'paid' && <Badge tone="green">Ödendi</Badge>}
                      {inv.status === 'issued' && <Badge tone="amber">Açık</Badge>}
                      <a href={getB2BInvoicePdfUrl(inv.id)} target="_blank" rel="noopener noreferrer" className="text-ex-red hover:underline flex items-center gap-1 text-xs font-semibold">
                        <ExternalLink size={14} /> PDF
                      </a>
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
              <p className="text-sm text-ink-400">Geçmiş kaydı yok</p>
            ) : (
              <div className="space-y-0">
                {timeline.map((t, i) => {
                  const Icon = TIMELINE_ICONS[t.action] ?? Clock;
                  const label = TIMELINE_LABELS[t.action] ?? t.action;
                  const details = t.details as Record<string, string>;
                  return (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-8 w-8 rounded-full bg-cream-100 dark:bg-ink-800 flex items-center justify-center shrink-0">
                          <Icon size={14} className="text-ink-500" />
                        </div>
                        {i < timeline.length - 1 && <div className="w-0.5 flex-1 bg-ink-100 dark:bg-ink-700 my-1" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium text-ink-900 dark:text-ink-100">{label}</p>
                        <p className="text-xs text-ink-400 mt-0.5">{formatDateTime(t.created_at)}</p>
                        {details.from && details.to && (
                          <p className="text-xs text-ink-400 mt-1">{statusLabels[details.from] ?? details.from} → {statusLabels[details.to] ?? details.to}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right column: Franchise + Store + Shipping + Actions */}
        <div className="space-y-5">
          {/* Franchise Info */}
          {franchise && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3 flex items-center gap-2">
                <Building2 size={16} className="text-ink-400" /> Franchise Bilgileri
              </h3>
              <div className="space-y-2.5">
                <InfoRow label="Firma" value={franchise.company_name} />
                <InfoRow label="Vergi No" value={franchise.tax_id ?? '—'} />
                <InfoRow label="Yetkili" value={franchise.authorized_person} />
                {franchise.authorized_email && <InfoRow label="E-posta" value={franchise.authorized_email} />}
                {franchise.authorized_phone && <InfoRow label="Telefon" value={franchise.authorized_phone} />}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-ink-400">Durum</span>
                  <Badge tone={franchise.status === 'active' ? 'green' : franchise.status === 'suspended' ? 'amber' : 'red'}>
                    {franchise.status === 'active' ? 'Aktif' : franchise.status === 'suspended' ? 'Askıda' : 'Sona Erdi'}
                  </Badge>
                </div>
              </div>
            </Card>
          )}

          {/* Store Info */}
          {store && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3 flex items-center gap-2">
                <StoreIcon size={16} className="text-ink-400" /> Şube Bilgileri
              </h3>
              <div className="space-y-2.5">
                <InfoRow label="Şube" value={store.name} />
                {store.address && (
                  <div className="flex items-start gap-2">
                    <MapPin size={14} className="text-ink-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-ink-600 dark:text-ink-300">{store.address}</p>
                  </div>
                )}
                {store.phone && <InfoRow label="Telefon" value={store.phone} />}
              </div>
            </Card>
          )}

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
                <InfoRow label="Teslim Tarihi" value={order.delivered_at ? formatDateTime(order.delivered_at) : '—'} />
                {order.tracking_url && (
                  <a href={order.tracking_url} target="_blank" rel="noopener noreferrer" className="text-ex-red hover:underline flex items-center gap-1 text-xs font-semibold mt-2">
                    <ExternalLink size={14} /> Kargo Takibi
                  </a>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <input className="admin-input w-full" placeholder="Kargo firması" value={carrier} onChange={e => setCarrier(e.target.value)} />
                <input className="admin-input w-full" placeholder="Takip numarası" value={trackingNo} onChange={e => setTrackingNo(e.target.value)} />
                <input className="admin-input w-full" placeholder="Takip linki (opsiyonel)" value={trackingUrl} onChange={e => setTrackingUrl(e.target.value)} />
                <input type="date" className="admin-input w-full" value={eta} onChange={e => setEta(e.target.value)} />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" full onClick={() => setShowShippingForm(false)}>İptal</Button>
                  <Button size="sm" full disabled={actionLoading} onClick={handleShippingSave}>Kaydet</Button>
                </div>
              </div>
            )}
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-2">Sipariş Notu</h3>
              <p className="text-sm text-ink-600 dark:text-ink-300">{order.notes}</p>
            </Card>
          )}

          {/* Actions */}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Card className="p-5">
              <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-3">İşlemler</h3>
              {nextStatus && (
                <Button full disabled={actionLoading} onClick={() => {
                  const opts: { trackingNo?: string; carrier?: string; eta?: string } = {};
                  if (nextStatus.status === 'shipped') {
                    opts.trackingNo = trackingNo;
                    opts.carrier = carrier;
                    opts.eta = eta || undefined;
                  }
                  handleAdvance(nextStatus.status, opts);
                }}>
                  {nextStatus.label}
                </Button>
              )}
              {canReject && (
                <Button variant="danger" full disabled={actionLoading} className="mt-2" onClick={() => setShowReject(true)}>
                  <XCircle size={16} /> Siparişi Reddet
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
      <Modal open={showReject} onClose={() => setShowReject(false)} title="Siparişi Reddet" size="sm">
        <p className="text-sm text-ink-600 dark:text-ink-300 mb-3">Bu siparişi reddetmek istediğinize emin misiniz? Franchise bilgilendirilecektir.</p>
        <textarea className="admin-input min-h-[80px]" placeholder="Reddetme nedeni (opsiyonel)" value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
        <div className="flex gap-2 mt-4 justify-end">
          <Button variant="outline" size="sm" onClick={() => setShowReject(false)}>Vazgeç</Button>
          <Button variant="danger" size="sm" disabled={actionLoading} onClick={handleReject}>Reddet</Button>
        </div>
      </Modal>
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
