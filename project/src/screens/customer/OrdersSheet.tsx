import { View, Text } from 'react-native';
import { RotateCcw, ShoppingBag } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useOrders } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateWrapper } from '@/components/ui/States';
import { formatPrice, cn } from '@/lib/utils';

const statusColors: Record<string, string> = {
  preparing: 'bg-red-50 text-ex-red',
  ready: 'bg-green-100 text-green-700',
  'picked-up': 'bg-ink-100 text-ink-600',
  delivered: 'bg-ink-100 text-ink-600',
  scheduled: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-ex-red',
};

const statusLabels: Record<string, string> = {
  preparing: 'Hazırlanıyor',
  ready: 'Hazır',
  'picked-up': 'Teslim Alındı',
  delivered: 'Teslim Edildi',
  scheduled: 'Planlandı',
  cancelled: 'İptal Edildi',
};

export function OrdersSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const { data: orders, error, loading, reload } = useOrders();
  const open = sheet === 'orders';

  const reorder = (orderNumber: string) => {
    showToast(`${orderNumber} yeniden sipariş ediliyor…`);
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="Siparişlerim">
      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && (orders?.length ?? 0) === 0}
        loadingLabel="Siparişler yükleniyor…"
        emptyTitle="Sipariş yok"
        emptySubtitle="İlk siparişini verdiğinde burada görünecek"
        emptyIcon={ShoppingBag}
        onRetry={reload}
      >
        <View className="gap-3">
          {orders?.map(order => (
            <Card key={order.id} className="p-4">
              <View className="flex-row items-start justify-between mb-2">
                <View>
                  <Text className="text-xs text-ink-400">{order.order_number}</Text>
                  <Text className="text-sm font-semibold text-ink-900">{new Date(order.created_at).toLocaleDateString('tr-TR')}</Text>
                </View>
                <View className={cn('px-2.5 py-1 rounded-full', statusColors[order.status] ?? 'bg-ink-100')}>
                  <Text className="text-[10px] font-bold uppercase tracking-wide">{statusLabels[order.status] ?? order.status}</Text>
                </View>
              </View>
              <View className="gap-1 mb-3">
                {order.order_items?.map(item => (
                  <Text key={item.id} className="text-sm text-ink-500">
                    <Text className="text-ink-300">{item.quantity}×</Text> {item.name}
                  </Text>
                ))}
              </View>
              <View className="flex-row items-center justify-between pt-3 border-t border-ink-100">
                <View>
                  <Text className="text-xs text-ink-400">{order.store_name} · +{order.points_earned} puan</Text>
                  <Text className="text-sm font-bold text-ex-red">{formatPrice(Number(order.total))}</Text>
                </View>
                <Button size="sm" variant="outline" onPress={() => reorder(order.order_number)}>
                  <RotateCcw size={13} /> Yeniden
                </Button>
              </View>
            </Card>
          ))}
        </View>
      </StateWrapper>
    </Sheet>
  );
}
