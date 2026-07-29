import { View, Text, ScrollView } from 'react-native';
import { DollarSign, ShoppingBag, Users, TrendingUp, ArrowUpRight, Coffee, Crown, Zap } from 'lucide-react';
import { StatCard, BarChart, LineChart, DonutChart } from '@/components/ui/Charts';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAdmin } from '@/context/AdminContext';

export function AdminDashboard() {
  const { orders, customers, totalCustomers, totalRevenue, totalOrders, products } = useAdmin();

  const revenueData = [
    { label: 'Pzt', value: Math.round(totalRevenue * 0.12) },
    { label: 'Sal', value: Math.round(totalRevenue * 0.15) },
    { label: 'Çar', value: Math.round(totalRevenue * 0.14) },
    { label: 'Per', value: Math.round(totalRevenue * 0.18) },
    { label: 'Cum', value: Math.round(totalRevenue * 0.22) },
    { label: 'Cmt', value: Math.round(totalRevenue * 0.27) },
    { label: 'Paz', value: Math.round(totalRevenue * 0.21) },
  ];
  const ordersData = [
    { label: 'Pzt', value: Math.round(totalOrders * 0.12) },
    { label: 'Sal', value: Math.round(totalOrders * 0.15) },
    { label: 'Çar', value: Math.round(totalOrders * 0.14) },
    { label: 'Per', value: Math.round(totalOrders * 0.18) },
    { label: 'Cum', value: Math.round(totalOrders * 0.22) },
    { label: 'Cmt', value: Math.round(totalOrders * 0.27) },
    { label: 'Paz', value: Math.round(totalOrders * 0.21) },
  ];
  const categoryData = products.slice(0, 6).map((p, i) => ({ label: p.category, value: 30 - i * 4 }));
  const avgBasket = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[160px]"><StatCard label="Toplam ciro" value={`₺${totalRevenue.toLocaleString('tr-TR')}`} change="+12.4%" icon={<DollarSign size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Toplam sipariş" value={totalOrders.toLocaleString('tr-TR')} change="+8.1%" icon={<ShoppingBag size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Aktif müşteri" value={totalCustomers.toLocaleString('tr-TR')} change="+3.2%" icon={<Users size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Ort. sepet" value={`₺${avgBasket}`} change="+2.4%" icon={<TrendingUp size={18} color="#C8102E" />} /></View>
      </View>

      <View className="flex-row flex-wrap gap-5">
        <Card className="flex-[2] min-w-[280px] p-5">
          <SectionHeader title="Bu haftaki ciro" subtitle="Günlük brüt ciro" action={<View className="flex-row items-center gap-0.5"><ArrowUpRight size={13} color="#16a34a" /><Text className="text-xs text-green-600 font-medium">+%18</Text></View>} />
          <BarChart data={revenueData} height={180} />
        </Card>
        <Card className="flex-1 min-w-[200px] p-5">
          <SectionHeader title="Kategori dağılımı" subtitle="Kategoriye göre satış" />
          <DonutChart data={categoryData} />
        </Card>
      </View>

      <View className="flex-row flex-wrap gap-5">
        <Card className="flex-1 min-w-[280px] p-5">
          <SectionHeader title="Sipariş hacmi" subtitle="Günlük sipariş sayısı" />
          <LineChart data={ordersData} height={170} />
        </Card>
        <Card className="flex-1 min-w-[280px] p-5">
          <SectionHeader title="Canlı siparişler" subtitle="Anlık aktivite" action={<View className="flex-row items-center gap-1"><View className="h-1.5 w-1.5 rounded-full bg-green-500" /><Text className="text-xs text-green-600">Canlı</Text></View>} />
          <View className="gap-2 max-h-[200px]">
            {orders.slice(0, 6).map(o => (
              <View key={o.id} className="flex-row items-center gap-3 py-2 border-b border-ink-100">
                <View className="h-9 w-9 rounded-xl bg-ink-900 items-center justify-center shrink-0">
                  <Coffee size={15} color="#fff" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{o.customer}</Text>
                  <Text className="text-[11px] text-ink-400" numberOfLines={1}>{o.id} · {o.store} · {o.time}</Text>
                </View>
                <Text className="text-sm font-semibold text-ex-red">₺{o.total.toLocaleString('tr-TR')}</Text>
              </View>
            ))}
          </View>
        </Card>
      </View>

      <View className="flex-row flex-wrap gap-5">
        <Card className="flex-1 min-w-[280px] p-5">
          <SectionHeader title="En değerli müşteriler" subtitle="Bu ay en çok harcayanlar" />
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
                <Text className="text-sm font-semibold text-ex-red">{c.segment}</Text>
              </View>
            ))}
          </View>
        </Card>
        <Card className="flex-1 min-w-[280px] p-5">
          <SectionHeader title="Seviye dağılımı" subtitle="Üyelik dağılımı" />
          <View className="gap-3">
            {[
              { tier: 'VIP', count: 184, pct: 8, color: '#C8102E', icon: Crown },
              { tier: 'Siyah', count: 612, pct: 18, color: '#18181b', icon: Crown },
              { tier: 'Altın', count: 1640, pct: 32, color: '#C8102E', icon: Crown },
              { tier: 'Gümüş', count: 2890, pct: 42, color: '#9494A0', icon: Zap },
              { tier: 'Bronz', count: 1420, pct: 52, color: '#A87F54', icon: Zap },
            ].map(t => (
              <View key={t.tier}>
                <View className="flex-row items-center justify-between mb-1">
                  <View className="flex-row items-center gap-1.5">
                    <t.icon size={12} color={t.color} />
                    <Text className="text-xs font-medium text-ink-700">{t.tier}</Text>
                  </View>
                  <Text className="text-xs text-ink-400">{t.count.toLocaleString('tr-TR')} · %{t.pct}</Text>
                </View>
                <View className="h-2 rounded-full bg-ink-100 overflow-hidden">
                  <View className="h-full rounded-full" style={{ width: `${t.pct * 2}%`, backgroundColor: t.color }} />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </View>
    </View>
  );
}
