import { View, Text, Pressable } from 'react-native';
import { RotateCcw, ShoppingBag, ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useOrders } from '@/lib/hooks';
import { useOperationContext } from '@/hooks/useOperationContext';
import { Sheet } from '@/components/ui/Sheet';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateWrapper } from '@/components/ui/States';
import { OrderBenefitBadge } from '@/components/orders/OrderBenefitBadge';
import { formatPrice, cn } from '@/lib/utils';
import {
  ORDER_STATUS_LABELS_CUSTOMER,
  ORDER_STATUS_CHIP_CLASSES,
} from '@shared/constants/orders';
import { formatOrderTotalDisplay } from '@shared/utils/orderDisplay';
import { resolveOrderBenefit } from '@shared/utils/orderBenefits';

const statusColors = ORDER_STATUS_CHIP_CLASSES;
const statusLabels = ORDER_STATUS_LABELS_CUSTOMER;

export function OrdersSheet() {
  const { sheet, closeSheet, showToast, openSheet, setSelectedOrderNumber } = useApp();
  const { data: orders, error, loading, reload } = useOrders();
  const { ctx } = useOperationContext();
  const open = sheet === 'orders';

  const enriched = useMemo(() => {
    if (!orders || !ctx) return [];
    return orders.map(order => ({
      order,
      benefit: resolveOrderBenefit(order, ctx),
    }));
  }, [orders, ctx]);

  const openDetail = (orderNumber: string) => {
    setSelectedOrderNumber(orderNumber);
    openSheet('order-detail');
  };

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
          {enriched.map(({ order, benefit }) => (
            <Pressable key={order.id} onPress={() => openDetail(order.order_number)}>
              <Card className={cn('p-4', benefit.kind !== 'paid' && 'border-green-200 bg-green-50/20')}>
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text className="text-xs text-ink-400">{order.order_number}</Text>
                    <Text className="text-sm font-semibold text-ink-900">{new Date(order.created_at).toLocaleDateString('tr-TR')}</Text>
                  </View>
                  <View className="items-end gap-1">
                    <OrderBenefitBadge benefit={benefit} compact />
                    <View className={cn('px-2.5 py-1 rounded-full', statusColors[order.status] ?? 'bg-ink-100')}>
                      <Text className="text-[10px] font-bold uppercase tracking-wide">{statusLabels[order.status] ?? order.status}</Text>
                    </View>
                  </View>
                </View>
                <Text className="text-[11px] text-ink-500 mb-2" numberOfLines={1}>{benefit.detail}</Text>
                <View className="gap-1 mb-3">
                  {order.order_items?.slice(0, 3).map(item => (
                    <Text key={item.id} className="text-sm text-ink-500">
                      <Text className="text-ink-300">{item.quantity}×</Text> {item.name}
                    </Text>
                  ))}
                </View>
                <View className="flex-row items-center justify-between pt-3 border-t border-ink-100">
                  <View className="flex-1 pr-2">
                    <Text className="text-xs text-ink-400">{order.store_name}{order.points_earned > 0 ? ` · +${order.points_earned} puan` : ''}</Text>
                    <Text className={cn('text-sm font-bold', benefit.kind !== 'paid' ? 'text-green-700' : 'text-ex-red')}>
                      {formatOrderTotalDisplay(Number(order.total), formatPrice)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <Button size="sm" variant="outline" onPress={() => reorder(order.order_number)}>
                      <RotateCcw size={13} /> Yeniden
                    </Button>
                    <ChevronRight size={16} color="#9494A0" />
                  </View>
                </View>
              </Card>
            </Pressable>
          ))}
        </View>
      </StateWrapper>
    </Sheet>
  );
}
