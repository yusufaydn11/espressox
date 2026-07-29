import { useState, useEffect, useCallback } from 'react';
import { View, Text } from 'react-native';
import { Wallet, Receipt, TrendingUp, Clock, PackageCheck, Truck, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  dashboardService,
  b2bFormatTRY, b2bTimeAgo,
  type B2BDashboardData,
} from '@/services/b2b';
import { getBalanceLabel } from '@shared/utils/payments';
import { B2BScreenWrapper, B2BSectionTitle, B2BStatTile, B2BLoadingSpinner, B2BErrorState } from '@/components/b2b';

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

  if (loading) return <B2BScreenWrapper><B2BLoadingSpinner label="Dashboard yükleniyor…" /></B2BScreenWrapper>;
  if (error) return <B2BScreenWrapper><B2BErrorState message={error} onRetry={load} /></B2BScreenWrapper>;
  if (!data) return <B2BScreenWrapper><B2BErrorState message="Veri bulunamadı" /></B2BScreenWrapper>;

  const counts = data.order_counts;

  return (
    <B2BScreenWrapper>
      <B2BSectionTitle title="Tedarik Dashboard" subtitle={`${storeName} — B2B tedarik özeti`} />

      <View className="flex-row flex-wrap gap-3 mb-5">
        <B2BStatTile label="Cari Bakiye" value={b2bFormatTRY(data.balance)} icon={<Wallet size={16} color={data.balance > 0 ? '#C8102E' : '#16a34a'} />} accent={data.balance > 0 ? 'bg-ex-red/10' : 'bg-green-50'} sub={getBalanceLabel(data.balance)} />
        <B2BStatTile label="Açık Faturalar" value={b2bFormatTRY(data.open_invoice_total)} icon={<Receipt size={16} color="#d97706" />} accent="bg-amber-50" />
        <B2BStatTile label="Son Ödeme" value={data.last_payment ? b2bFormatTRY(data.last_payment.amount) : '—'} icon={<TrendingUp size={16} color="#2563eb" />} accent="bg-blue-50" sub={data.last_payment ? b2bTimeAgo(data.last_payment.paid_at) : 'Yok'} />
        <B2BStatTile label="Son Sipariş" value={data.last_order ? data.last_order.order_number : '—'} icon={<Clock size={16} color="#6E6E78" />} accent="bg-ink-50" sub={data.last_order ? b2bTimeAgo(data.last_order.created_at) : 'Yok'} />
      </View>

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5 mb-5">
        <Text className="text-sm font-bold text-ink-900 mb-4">Sipariş Durumları</Text>
        <View className="gap-3">
          <StatusRow icon={<Clock size={16} color="#9494A0" />} label="Ödeme Bekleniyor" count={counts.awaiting_payment} badgeColor="bg-amber-50" textColor="text-amber-700" />
          <StatusRow icon={<CheckCircle2 size={16} color="#2563eb" />} label="Ödeme Alındı" count={counts.paid} badgeColor="bg-blue-50" textColor="text-blue-700" />
          <StatusRow icon={<PackageCheck size={16} color="#d97706" />} label="Hazırlanıyor" count={counts.preparing + counts.confirmed} badgeColor="bg-amber-50" textColor="text-amber-700" />
          <StatusRow icon={<Truck size={16} color="#3D3D42" />} label="Kargoda" count={counts.shipped} badgeColor="bg-ink-100" textColor="text-ink-700" />
          <StatusRow icon={<CheckCircle2 size={16} color="#16a34a" />} label="Teslim Edildi" count={counts.delivered} badgeColor="bg-green-50" textColor="text-green-700" />
        </View>
      </View>

      <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5">
        <Text className="text-sm font-bold text-ink-900 mb-4">Son Cari Hareketler</Text>
        {data.recent_movements.length === 0 ? (
          <Text className="text-sm text-ink-400 text-center py-6">Henüz hareket yok</Text>
        ) : (
          <View>
            {data.recent_movements.map((m, i) => (
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
        <View className="h-8 w-8 rounded-lg bg-ink-50 items-center justify-center">{icon}</View>
        <Text className="text-sm text-ink-600">{label}</Text>
      </View>
      <View className={cn('px-2.5 py-1 rounded-full', badgeColor)}>
        <Text className={cn('text-[11px] font-semibold', textColor)}>{count}</Text>
      </View>
    </View>
  );
}
