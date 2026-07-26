import { View } from 'react-native';
import { DollarSign, TrendingUp, ShoppingCart, Percent } from 'lucide-react-native';
import { StatCard, BarChart, LineChart } from '@/components/ui/Charts';
import { Card } from '@/components/ui/Card';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { useAdmin } from '@/context/AdminContext';

export function AdminSales() {
  const { totalRevenue, totalOrders, stores } = useAdmin();
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
  const storeData = stores.map(s => ({ label: s.name.split(' ')[0], value: Math.round(totalRevenue / Math.max(stores.length, 1)) }));

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[160px]"><StatCard label="Brüt ciro" value="₺5,2M" change="+14.2%" icon={<DollarSign size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Net ciro" value="₺4,6M" change="+12.8%" icon={<TrendingUp size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Toplam sipariş" value="24.180" change="+9.4%" icon={<ShoppingCart size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Kar marjı" value="%38,2" change="+1.8%" icon={<Percent size={18} color="#C8102E" />} /></View>
      </View>

      <View className="flex-row flex-wrap gap-5">
        <View className="flex-[2] min-w-[280px]">
          <Card className="p-5">
            <SectionHeader title="Ciro trendi" subtitle="Son 7 gün" />
            <BarChart data={revenueData} height={200} color="#C8102E" />
          </Card>
        </View>
        <View className="flex-1 min-w-[200px]">
          <Card className="p-5">
            <SectionHeader title="Sipariş trendi" subtitle="Son 7 gün" />
            <LineChart data={ordersData} height={200} color="#C8102E" />
          </Card>
        </View>
      </View>

      <Card className="p-5">
        <SectionHeader title="Mağazeye göre satış" subtitle="Ciro karşılaştırması" />
        <BarChart data={storeData} height={180} color="#C8102E" />
      </Card>

      <Card className="p-5">
        <SectionHeader title="Saatlik satışlar" subtitle="Bugünün saatlik performansı" />
        <BarChart
          data={[
            { label: '06', value: 1200 }, { label: '07', value: 2800 }, { label: '08', value: 4200 },
            { label: '09', value: 3600 }, { label: '10', value: 2400 }, { label: '11', value: 1800 },
            { label: '12', value: 3200 }, { label: '13', value: 2800 }, { label: '14', value: 1600 },
            { label: '15', value: 1400 }, { label: '16', value: 2200 }, { label: '17', value: 3400 },
          ]}
          height={160}
          color="#6b6b73"
        />
      </Card>
    </View>
  );
}
