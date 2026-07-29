import { View, Text } from 'react-native';
import { CheckCircle2, Circle, Clock, CreditCard, Package, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { B2B_ORDER_STATUS_LABELS } from '@/services/b2b';

const STEPS = [
  { key: 'created', label: 'Sipariş oluşturuldu', statuses: ['awaiting_payment', 'draft'] },
  { key: 'payment', label: 'Ödeme', statuses: ['paid'] },
  { key: 'preparing', label: 'Hazırlanıyor', statuses: ['confirmed', 'preparing'] },
  { key: 'shipped', label: 'Kargoda', statuses: ['shipped'] },
  { key: 'delivered', label: 'Teslim edildi', statuses: ['delivered'] },
] as const;

const STATUS_ORDER = ['awaiting_payment', 'draft', 'paid', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];

function stepIndex(status: string): number {
  if (status === 'cancelled') return -1;
  const idx = STATUS_ORDER.indexOf(status);
  if (idx <= 0) return 0;
  if (idx === 1) return 0;
  if (idx === 2) return 1;
  if (idx <= 4) return 2;
  if (idx === 5) return 3;
  return 4;
}

const STEP_ICONS = [Clock, CreditCard, Package, Truck, CheckCircle2];

export function B2BOrderTimeline({ status }: { status: string }) {
  if (status === 'cancelled') {
    return (
      <View className="rounded-2xl bg-red-50 border border-red-100 p-4">
        <Text className="text-sm font-semibold text-ex-red">Sipariş iptal edildi</Text>
      </View>
    );
  }

  const activeIdx = stepIndex(status);

  return (
    <View className="rounded-2xl bg-white border border-ink-100 shadow-card p-5">
      <Text className="text-sm font-bold text-ink-900 mb-4">Sipariş Durumu</Text>
      <View className="gap-0">
        {STEPS.map((step, i) => {
          const done = i < activeIdx;
          const current = i === activeIdx;
          const Icon = STEP_ICONS[i];
          return (
            <View key={step.key} className="flex-row gap-3">
              <View className="items-center">
                <View
                  className={cn(
                    'h-9 w-9 rounded-full items-center justify-center border-2',
                    done ? 'bg-green-50 border-green-500' : current ? 'bg-ex-red/10 border-ex-red' : 'bg-ink-50 border-ink-200',
                  )}
                >
                  {done ? (
                    <CheckCircle2 size={16} color="#16a34a" />
                  ) : current ? (
                    <Icon size={16} color="#C8102E" />
                  ) : (
                    <Circle size={14} color="#C4C4CC" />
                  )}
                </View>
                {i < STEPS.length - 1 && (
                  <View className={cn('w-0.5 flex-1 min-h-[24px]', done ? 'bg-green-300' : 'bg-ink-200')} />
                )}
              </View>
              <View className="flex-1 pb-5">
                <Text className={cn('text-sm font-semibold', current ? 'text-ex-red' : done ? 'text-ink-800' : 'text-ink-400')}>
                  {step.label}
                </Text>
                {current && (
                  <Text className="text-[11px] text-ink-500 mt-0.5">
                    {B2B_ORDER_STATUS_LABELS[status] ?? status}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
