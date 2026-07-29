import { Gift, Coffee, Zap, Bell } from 'lucide-react';
import { Card, EmptyState, Spinner, ErrorState } from '../../lib/ui';
import type { LoyaltyTimelineItem } from '@shared/types/operations';

const ICONS = {
  points: Zap,
  stamp: Coffee,
  reward: Gift,
  free_coffee: Coffee,
  qr: Gift,
  campaign: Bell,
  coupon: Gift,
  payment: Zap,
};

export function LoyaltyHistoryPanel({
  items,
  loading,
  error,
  onRetry,
}: {
  items: LoyaltyTimelineItem[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-5 min-w-0">
      <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Sadakat Geçmişi</h3>
      {loading ? <Spinner label="Geçmiş yükleniyor…" /> :
       error ? <ErrorState message={error} onRetry={onRetry} /> :
       items.length === 0 ? <EmptyState title="Kayıt yok" subtitle="Puan, damga veya ödül hareketi bulunamadı" /> : (
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {items.map(item => {
            const Icon = ICONS[item.category];
            return (
              <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-cream-50 dark:bg-ink-800 border border-ink-100 dark:border-ink-700">
                <div className="h-9 w-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  <Icon size={15} className="text-ex-red" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink-900 dark:text-ink-100">{item.title}</p>
                  <p className="text-xs text-ink-400">{item.subtitle}</p>
                  <p className="text-[10px] text-ink-300 mt-1">{new Date(item.at).toLocaleString('tr-TR')}</p>
                </div>
                {item.delta != null && (
                  <span className={`text-xs font-bold shrink-0 ${item.delta >= 0 ? 'text-ex-red' : 'text-ink-500'}`}>
                    {item.delta >= 0 ? '+' : ''}{item.delta}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function CampaignActivityPanel({ items }: { items: LoyaltyTimelineItem[] }) {
  const campaigns = items.filter(i => i.category === 'campaign' || i.category === 'reward');
  return (
    <Card className="p-5 min-w-0">
      <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4">Kampanya & Ödül Aktivitesi</h3>
      {campaigns.length === 0 ? (
        <EmptyState title="Aktivite yok" subtitle="Kampanya bildirimi veya ödül kullanımı kaydı yok" />
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {campaigns.map(item => (
            <div key={item.id} className="py-2 px-3 rounded-xl bg-cream-50 dark:bg-ink-800 text-sm">
              <p className="font-medium text-ink-900 dark:text-ink-100">{item.title}</p>
              <p className="text-xs text-ink-400">{new Date(item.at).toLocaleString('tr-TR')}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
