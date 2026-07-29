import { View, Text, Pressable, ScrollView } from 'react-native';
import { Flame, Gift, ChevronRight, Tag } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useCampaigns } from '@/lib/hooks';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { StateWrapper } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';

export function CampaignsScreen() {
  const { openSheet } = useApp();
  const { profile } = useAuth();
  const { data: campaigns, error, loading, reload } = useCampaigns();

  return (
    <View className="mx-auto max-w-md px-5 pt-3 pb-32 w-full">
      <SectionHeader title="Kampanyalar" subtitle="Sana özel fırsatlar" />

      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && (campaigns?.length ?? 0) === 0}
        loadingLabel="Kampanyalar yükleniyor…"
        emptyTitle="Aktif kampanya yok"
        emptySubtitle="Yeni kampanyalar için takipte kal"
        onRetry={reload}
      >
        <View className="gap-4">
          {campaigns?.map(c => (
            <Card key={c.id} onPress={() => openSheet('promotions')} className="p-5 overflow-hidden relative">
              <View className="flex-row items-start gap-4">
                <View className="h-12 w-12 rounded-2xl bg-ex-red items-center justify-center shrink-0">
                  <Flame size={22} color="#fff" />
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 self-start mb-1.5">
                    <Tag size={9} color="#C8102E" />
                    <Text className="text-[9px] font-bold uppercase tracking-wide text-ex-red">Aktif Kampanya</Text>
                  </View>
                  <Text className="text-base font-bold text-ink-900 leading-tight">{c.title || c.name}</Text>
                  <Text className="text-sm text-ink-500 mt-0.5" numberOfLines={2}>{c.message}</Text>
                </View>
                <ChevronRight size={20} color="#C4C4CC" />
              </View>
            </Card>
          ))}
        </View>
      </StateWrapper>

      <View className="mt-6">
        <SectionHeader title="Kuponlar & Promosyonlar" />
        <Card onPress={() => openSheet('promotions')} className="p-5 flex-row items-center gap-4">
          <View className="h-12 w-12 rounded-2xl bg-cream-100 items-center justify-center shrink-0">
            <Gift size={22} color="#C8102E" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-semibold text-ink-900">Tüm promosyonları gör</Text>
            <Text className="text-xs text-ink-400 mt-0.5">İndirim kuponları ve özel fırsatlar</Text>
          </View>
          <ChevronRight size={20} color="#C4C4CC" />
        </Card>
      </View>

      <View className="mt-6">
        <Card className="p-5">
          <View className="flex-row items-center justify-between mb-3">
            <View>
              <Text className="text-sm font-semibold text-ink-900">Sadakat puanların</Text>
              <Text className="text-xs text-ink-400 mt-0.5">{(profile?.points ?? 0).toLocaleString('tr-TR')} puan hazır</Text>
            </View>
            <Text className="text-2xl font-bold text-ex-red">{(profile?.points ?? 0).toLocaleString('tr-TR')}</Text>
          </View>
          <Button variant="outline" full onPress={() => openSheet('rewards')}>
            <Gift size={16} /> Ödülleri kullan
          </Button>
        </Card>
      </View>
    </View>
  );
}
