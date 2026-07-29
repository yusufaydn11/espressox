import { View, Text, Pressable } from 'react-native';
import {
  DollarSign, ShoppingBag, Users, TrendingUp, Coffee, Crown, RefreshCw,
} from 'lucide-react';
import { BarChart } from '@/components/ui/Charts';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { B2BKpiCard } from '@/components/b2b/B2BKpiCard';
import { B2BDashboardSkeleton } from '@/components/b2b/B2BSkeleton';
import { ErrorState } from '@/components/ui/States';
import { useAdmin } from '@/context/AdminContext';
import { useMobileHqDashboard } from '@/hooks/useMobileHqDashboard';
import { VIP_TIER_FILTER } from '@shared/constants/loyalty';

function formatTRY(n: number) {
  return `₺${Math.round(n).toLocaleString('tr-TR')}`;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Yeni',
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  'picked-up': 'Teslim Alındı',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal',
};

export function AdminDashboard() {
  const { customers } = useAdmin();
  const { data, loading, error, reload } = useMobileHqDashboard();

  if (loading) {
    return (
      <View className="max-w-4xl w-full mx-auto gap-5">
        <B2BDashboardSkeleton />
      </View>
    );
  }

  if (error || !data) {
    return <ErrorState message={error ?? 'Veri yüklenemedi'} onRetry={reload} />;
  }

  const { kpis, sales, recentOrders } = data;
  const tierMap = customers.reduce((acc, c) => {
    acc[c.tier] = (acc[c.tier] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const tierEntries = Object.entries(tierMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTier = tierEntries[0]?.[1] ?? 1;
  const vipCount = customers.filter(c => VIP_TIER_FILTER.includes(c.tier as typeof VIP_TIER_FILTER[number])).length;

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="text-lg font-bold text-ink-900 font-display">HQ Komuta Merkezi</Text>
          <Text className="text-xs text-ink-400 mt-0.5">Canlı Supabase verileri</Text>
        </View>
        <Pressable onPress={reload} className="h-9 w-9 rounded-xl bg-ink-50 items-center justify-center active:bg-ink-100">
          <RefreshCw size={16} color="#6E6E78" />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-3">
        <B2BKpiCard variant="primary" label="Bugünkü Satış" value={formatTRY(kpis.todaySales)} sub="Canlı KPI" icon={<DollarSign size={18} color="#fff" />} />
        <B2BKpiCard label="Aylık Ciro" value={formatTRY(kpis.monthRevenue)} sub="Bu ay" icon={<TrendingUp size={18} color="#C8102E" />} />
        <B2BKpiCard label="Toplam Sipariş" value={kpis.totalOrders.toLocaleString('tr-TR')} sub={`Ort. ${formatTRY(kpis.avgBasket)}`} icon={<ShoppingBag size={18} color="#C8102E" />} />
        <B2BKpiCard variant="gold" label="Aktif Müşteri" value={kpis.activeCustomers.toLocaleString('tr-TR')} sub={`${vipCount} VIP`} icon={<Users size={18} color="#D4AF37" />} />
      </View>

      <Card className="p-5">
        <SectionHeader title="7 Günlük Satış" subtitle="get_admin_sales_series" />
        <BarChart data={sales} height={180} />
      </Card>

      <Card className="p-5">
        <SectionHeader
          title="Canlı Siparişler"
          subtitle="Son operasyon kayıtları"
          action={
            <View className="flex-row items-center gap-1">
              <View className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <Text className="text-xs text-green-600">Canlı</Text>
            </View>
          }
        />
        {recentOrders.length === 0 ? (
          <Text className="text-sm text-ink-400 py-4 text-center">Henüz sipariş yok</Text>
        ) : (
          <View className="gap-2">
            {recentOrders.map(o => (
              <View key={o.id} className="flex-row items-center gap-3 py-2 border-b border-ink-100">
                <View className="h-9 w-9 rounded-xl bg-ink-900 items-center justify-center shrink-0">
                  <Coffee size={15} color="#fff" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>#{o.order_number}</Text>
                  <Text className="text-[11px] text-ink-400" numberOfLines={1}>
                    {o.store_name} · {STATUS_LABELS[o.status] ?? o.status}
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-ex-red">{formatTRY(Number(o.total))}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <View className="flex-row flex-wrap gap-5">
        <Card className="flex-1 min-w-[280px] p-5">
          <SectionHeader title="En değerli müşteriler" subtitle="VIP segment" />
          <View className="gap-2">
            {customers.filter(c => c.status === 'vip').slice(0, 4).map((c, i) => (
              <View key={c.id} className="flex-row items-center gap-3 py-2.5 border-b border-ink-100">
                <View className={i === 0 ? 'h-7 w-7 rounded-lg bg-ex-red items-center justify-center' : 'h-7 w-7 rounded-lg bg-ink-50 items-center justify-center'}>
                  <Text className={i === 0 ? 'text-xs font-bold text-white' : 'text-xs font-bold text-ink-600'}>{i + 1}</Text>
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{c.name}</Text>
                  <Text className="text-[11px] text-ink-400">{c.tier}</Text>
                </View>
                <Text className="text-sm font-semibold text-ex-red">₺{c.spent.toLocaleString('tr-TR')}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Card className="flex-1 min-w-[280px] p-5">
          <SectionHeader title="Seviye dağılımı" subtitle="Gerçek profil verisi" />
          <View className="gap-3">
            {tierEntries.length === 0 ? (
              <Text className="text-sm text-ink-400">Profil verisi yok</Text>
            ) : tierEntries.map(([tier, count]) => (
              <View key={tier}>
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <Crown size={12} color="#C8102E" />
                    <Text className="text-xs font-medium text-ink-700">{tier}</Text>
                  </View>
                  <Text className="text-xs text-ink-400">{count.toLocaleString('tr-TR')}</Text>
                </View>
                <View className="h-2 rounded-full bg-ink-100 overflow-hidden">
                  <View className="h-full rounded-full bg-ex-red" style={{ width: `${Math.round((count / maxTier) * 100)}%` }} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>

      {kpis.topProduct !== '—' && (
        <Card className="p-4">
          <Text className="text-xs text-ink-400">En çok satan ürün</Text>
          <Text className="text-sm font-bold text-ink-900 mt-1">{kpis.topProduct}</Text>
        </Card>
      )}
    </View>
  );
}
