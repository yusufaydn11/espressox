import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text } from 'react-native';
import {
  Wallet, Receipt, TrendingUp, Clock, PackageCheck, Truck, CheckCircle2,
  AlertCircle, ShoppingBag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  dashboardService,
  b2bFormatTRY, b2bTimeAgo,
  type B2BDashboardData,
} from '@/services/b2b';
import { getBalanceLabel } from '@shared/utils/payments';
import {
  B2BScreenWrapper, B2BSectionTitle, B2BErrorState,
  B2BDashboardSkeleton, B2BKpiCard,
} from '@/components/b2b';

export function B2BDashboard({ storeId, storeName }: { storeId: string; storeName: string }) {
  const [data, setData] = useState<B2BDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const d = await dashboardService.get(storeId);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Veri yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const openOrders = useMemo(() => {
    if (!data) return 0;
    const c = data.order_counts;
    return c.awaiting_payment + c.paid + c.confirmed + c.preparing + c.shipped;
  }, [data]);

  const monthlySpend = useMemo(() => {
    if (!data) return 0;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return data.recent_movements
      .filter(m => m.type === 'debit' && new Date(m.created_at) >= monthStart)
      .reduce((s, m) => s + m.amount, 0);
  }, [data]);

  const orderTrend = useMemo(() => {
    if (!data) return [];
    const c = data.order_counts;
    return [
      { label: 'Ödeme Bek.', value: c.awaiting_payment, color: 'bg-amber-400' },
      { label: 'Ödendi', value: c.paid, color: 'bg-blue-500' },
      { label: 'Hazırlık', value: c.confirmed + c.preparing, color: 'bg-orange-400' },
      { label: 'Kargo', value: c.shipped, color: 'bg-ink-500' },
      { label: 'Teslim', value: c.delivered, color: 'bg-green-500' },
    ];
  }, [data]);

  const maxTrend = Math.max(1, ...orderTrend.map(t => t.value));

  if (loading) {
    return (
      <B2BScreenWrapper>
        <B2BDashboardSkeleton />
      </B2BScreenWrapper>
    );
  }
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;
  if (!data) return <B2BScreenWrapper><B2BErrorState message="Veri bulunamadı" /></B2BScreenWrapper>;

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle
        title="Tedarik Dashboard"
        subtitle={`${storeName} — B2B operasyon özeti`}
        badge="Canlı"
      />

      <View className="flex-row flex-wrap gap-3 mb-5">
        <B2BKpiCard
          label="Açık Siparişler"
          value={String(openOrders)}
          sub="Aktif tedarik süreci"
          variant="primary"
          icon={<ShoppingBag size={16} color="#fff" />}
        />
        <B2BKpiCard
          label="Cari Bakiye"
          value={b2bFormatTRY(data.balance)}
          sub={getBalanceLabel(data.balance)}
          icon={<Wallet size={16} color={data.balance > 0 ? '#C8102E' : '#16a34a'} />}
        />
        <B2BKpiCard
          label="Son Ödeme"
          value={data.last_payment ? b2bFormatTRY(data.last_payment.amount) : '—'}
          sub={data.last_payment ? b2bTimeAgo(data.last_payment.paid_at) : 'Kayıt yok'}
          icon={<TrendingUp size={16} color="#2563eb" />}
        />
        <B2BKpiCard
          label="Aylık Tedarik"
          value={b2bFormatTRY(monthlySpend || data.open_invoice_total)}
          sub="Bu ay hareketler"
          variant="gold"
          icon={<Receipt size={16} color="#A8851E" />}
        />
      </View>

      <View className="rounded-3xl bg-white border border-ink-100 shadow-card p-5 mb-5">
        <Text className="text-sm font-bold text-ink-900 mb-1">Sipariş Trendi</Text>
        <Text className="text-[11px] text-ink-400 mb-4">Durum bazlı dağılım</Text>
        <View className="flex-row items-end justify-between gap-2 h-32">
          {orderTrend.map(item => (
            <View key={item.label} className="flex-1 items-center gap-1.5">
              <Text className="text-[10px] font-bold text-ink-700">{item.value}</Text>
              <View
                className={cn('w-full rounded-t-lg min-h-[4px]', item.color)}
                style={{ height: `${Math.max(8, (item.value / maxTrend) * 100)}%` }}
              />
              <Text className="text-[9px] text-ink-400 text-center" numberOfLines={2}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="rounded-3xl bg-white border border-ink-100 shadow-card p-5 mb-5">
        <Text className="text-sm font-bold text-ink-900 mb-4">Sipariş Durumları</Text>
        <View className="gap-3">
          <StatusRow icon={<Clock size={16} color="#9494A0" />} label="Ödeme Bekleniyor" count={data.order_counts.awaiting_payment} badgeColor="bg-amber-50" textColor="text-amber-700" />
          <StatusRow icon={<CheckCircle2 size={16} color="#2563eb" />} label="Ödeme Alındı" count={data.order_counts.paid} badgeColor="bg-blue-50" textColor="text-blue-700" />
          <StatusRow icon={<PackageCheck size={16} color="#d97706" />} label="Hazırlanıyor" count={data.order_counts.preparing + data.order_counts.confirmed} badgeColor="bg-amber-50" textColor="text-amber-700" />
          <StatusRow icon={<Truck size={16} color="#3D3D42" />} label="Kargoda" count={data.order_counts.shipped} badgeColor="bg-ink-100" textColor="text-ink-700" />
          <StatusRow icon={<CheckCircle2 size={16} color="#16a34a" />} label="Teslim Edildi" count={data.order_counts.delivered} badgeColor="bg-green-50" textColor="text-green-700" />
        </View>
      </View>

      <View className="rounded-3xl bg-white border border-ink-100 shadow-card p-5">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-sm font-bold text-ink-900">Harcama & Cari Hareketler</Text>
          {data.last_order && (
            <Text className="text-[11px] text-ink-400">Son: {data.last_order.order_number}</Text>
          )}
        </View>
        {data.recent_movements.length === 0 ? (
          <Text className="text-sm text-ink-400 text-center py-6">Henüz hareket yok</Text>
        ) : (
          <View>
            {data.recent_movements.slice(0, 6).map((m, i) => (
              <View key={i} className={cn('flex-row items-center gap-3 py-2.5', i > 0 && 'border-t border-ink-50')}>
                <View className={cn('h-8 w-8 rounded-lg items-center justify-center shrink-0', m.type === 'debit' ? 'bg-red-50' : 'bg-green-50')}>
                  {m.type === 'debit' ? <AlertCircle size={16} color="#C8102E" /> : <TrendingUp size={16} color="#16a34a" />}
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{m.description}</Text>
                  <Text className="text-[11px] text-ink-400">{b2bTimeAgo(m.created_at)}</Text>
                </View>
                <Text className={cn('text-sm font-bold shrink-0', m.type === 'debit' ? 'text-ex-red' : 'text-green-600')}>
                  {m.type === 'debit' ? '+' : '-'}{b2bFormatTRY(m.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </B2BScreenWrapper>
  );
}

function StatusRow({ icon, label, count, badgeColor, textColor }: { icon: React.ReactNode; label: string; count: number; badgeColor: string; textColor: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <View className="flex-row items-center gap-3">
        <View className="h-8 w-8 rounded-lg bg-cream-100 items-center justify-center">{icon}</View>
        <Text className="text-sm text-ink-600">{label}</Text>
      </View>
      <View className={cn('px-2.5 py-1 rounded-full', badgeColor)}>
        <Text className={cn('text-[11px] font-semibold', textColor)}>{count}</Text>
      </View>
    </View>
  );
}
