import { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
import { useApp } from '@/context/AppContext';
import { useOperationContext } from '@/hooks/useOperationContext';
import { fetchOrderByNumber, type OrderWithItems } from '@/services/orders/orderService';
import { resolveOrderBenefit } from '@shared/utils/orderBenefits';
import { formatOrderTotalDisplay } from '@shared/utils/orderDisplay';
import { ORDER_STATUS_LABELS_CUSTOMER, ORDER_STATUS_CHIP_CLASSES } from '@shared/constants/orders';
import { Sheet } from '@/components/ui/Sheet';
import { StateWrapper } from '@/components/ui/States';
import { OrderBenefitDetail } from '@/components/orders/OrderBenefitBadge';
import { formatPrice, cn } from '@/lib/utils';

export function OrderDetailSheet() {
  const { sheet, closeSheet, selectedOrderNumber, setSelectedOrderNumber } = useApp();
  const open = sheet === 'order-detail';
  const { ctx } = useOperationContext();
  const [order, setOrder] = useState<OrderWithItems | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selectedOrderNumber) {
      setOrder(null);
      return;
    }
    setLoading(true);
    setError(null);
    void fetchOrderByNumber(selectedOrderNumber).then(({ data, error: err }) => {
      if (err) setError(err);
      else setOrder(data);
      setLoading(false);
    });
  }, [open, selectedOrderNumber]);

  const benefit = useMemo(() => {
    if (!order || !ctx) return null;
    return resolveOrderBenefit(order, ctx);
  }, [order, ctx]);

  const handleClose = () => {
    setSelectedOrderNumber(null);
    closeSheet();
  };

  return (
    <Sheet open={open} onClose={handleClose} title={order ? `Sipariş ${order.order_number}` : 'Sipariş detayı'}>
      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && !order}
        loadingLabel="Sipariş yükleniyor…"
        emptyTitle="Sipariş bulunamadı"
        onRetry={() => selectedOrderNumber && void fetchOrderByNumber(selectedOrderNumber).then(r => setOrder(r.data))}
      >
        {order && (
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-ink-400">{new Date(order.created_at).toLocaleString('tr-TR')}</Text>
              <View className={cn('px-2.5 py-1 rounded-full', ORDER_STATUS_CHIP_CLASSES[order.status] ?? 'bg-ink-100')}>
                <Text className="text-[10px] font-bold uppercase">
                  {ORDER_STATUS_LABELS_CUSTOMER[order.status] ?? order.status}
                </Text>
              </View>
            </View>

            <View className="gap-1">
              <Text className="text-xs text-ink-400">Şube · {order.store_name}</Text>
              <Text className="text-xs text-ink-400 capitalize">Tür · {order.order_type}</Text>
            </View>

            {benefit && <OrderBenefitDetail benefit={benefit} />}

            <View className="gap-2">
              <Text className="text-xs font-bold text-ink-400 uppercase">Ürünler</Text>
              {order.order_items?.map(item => (
                <View key={item.id} className="flex-row justify-between py-2 border-b border-ink-50">
                  <Text className="text-sm text-ink-700 flex-1">{item.quantity}× {item.name}</Text>
                  <Text className="text-sm font-semibold text-ink-900">{formatPrice(Number(item.unit_price) * item.quantity)}</Text>
                </View>
              ))}
            </View>

            <View className="flex-row justify-between pt-2">
              <Text className="text-sm font-semibold text-ink-900">Toplam</Text>
              <Text className="text-base font-bold text-ex-red">
                {formatOrderTotalDisplay(Number(order.total), formatPrice)}
              </Text>
            </View>
          </View>
        )}
      </StateWrapper>
    </Sheet>
  );
}
