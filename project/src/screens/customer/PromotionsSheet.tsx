import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Copy, Check, Tag, Clock, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useCampaigns } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/States';
import { CustomerEmptyCard } from '@/components/customer';

export function PromotionsSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const { data: campaigns, loading, error, reload } = useCampaigns();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (code: string) => {
    setCopied(code);
    showToast(`${code} kodu kopyalandı`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Sheet open={sheet === 'promotions'} onClose={closeSheet} title="Promosyonlar">
      {loading ? (
        <Text className="text-sm text-ink-400 py-8 text-center">Kampanyalar yükleniyor…</Text>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !campaigns?.length ? (
        <CustomerEmptyCard preset="campaigns" />
      ) : (
        <View className="gap-3">
          {campaigns.map(c => (
            <View key={c.id} className="rounded-2xl overflow-hidden border border-ink-100 bg-white p-4">
              <View className="flex-row items-start gap-3">
                <View className="h-10 w-10 rounded-xl bg-ex-red/10 items-center justify-center">
                  <Sparkles size={18} color="#C8102E" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-ink-900">{c.title || c.name}</Text>
                  <Text className="text-xs text-ink-500 mt-0.5" numberOfLines={2}>{c.message}</Text>
                  {c.end_date && (
                    <View className="flex-row items-center gap-1 mt-2">
                      <Clock size={10} color="#9494A0" />
                      <Text className="text-[10px] text-ink-400">
                        {new Date(c.end_date).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-ink-100">
                <View className="flex-row items-center gap-2">
                  <View className="px-2.5 py-1.5 rounded-lg bg-cream-100">
                    <Text className="text-xs font-semibold text-ink-900 tracking-wider">{c.name.slice(0, 12).toUpperCase()}</Text>
                  </View>
                  <Pressable onPress={() => copy(c.id)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center">
                    {copied === c.id ? <Check size={13} color="#16a34a" /> : <Copy size={13} color="#525258" />}
                  </Pressable>
                </View>
                <Button size="sm" variant="gold" onPress={() => showToast(`${c.title || c.name} kampanyası görüntülendi`)}>
                  <Tag size={12} /> Detay
                </Button>
              </View>
            </View>
          ))}
        </View>
      )}
    </Sheet>
  );
}
