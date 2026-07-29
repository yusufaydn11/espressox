import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Gift, ChevronRight, Tag, Sparkles } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { useCampaigns } from '@/lib/hooks';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { StateWrapper } from '@/components/ui/States';
import { Button } from '@/components/ui/Button';
import { PageHeader, ScreenWrapper } from '@/components/customer';
import { AnimatedBlock } from '@/components/customer/AnimatedBlock';
import { colors } from '@shared/design/tokens';

export function CampaignsScreen() {
  const { openSheet } = useApp();
  const { profile } = useAuth();
  const { data: campaigns, error, loading, reload } = useCampaigns();

  const featured = campaigns?.[0];
  const rest = campaigns?.slice(1) ?? [];

  return (
    <ScreenWrapper width="default">
      <PageHeader title="Kampanyalar" subtitle="Sana özel fırsatlar ve indirimler" />

      <StateWrapper
        loading={loading}
        error={error}
        empty={!loading && !error && (campaigns?.length ?? 0) === 0}
        loadingLabel="Kampanyalar yükleniyor…"
        emptyTitle="Aktif kampanya yok"
        emptySubtitle="Yeni kampanyalar için takipte kal"
        onRetry={reload}
      >
        {featured && (
          <AnimatedBlock animation="fade-up" delay={0}>
            <Card onPress={() => openSheet('promotions')} className="p-0 overflow-hidden mb-5 border-0">
              <LinearGradient
                colors={[colors.ex.red, colors.ex.redDark]}
                className="p-6 relative overflow-hidden"
              >
                <View className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
                <View className="absolute bottom-0 left-0 h-24 w-24 rounded-full bg-white/5 -ml-8 -mb-8" />
                <View className="flex-row items-start gap-4 relative">
                  <View className="h-14 w-14 rounded-2xl bg-white/20 items-center justify-center">
                    <Sparkles size={26} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 self-start mb-2">
                      <Tag size={9} color="#fff" />
                      <Text className="text-[9px] font-bold uppercase tracking-wide text-white">Öne Çıkan</Text>
                    </View>
                    <Text className="text-xl font-bold text-white leading-tight font-display">{featured.title || featured.name}</Text>
                    <Text className="text-sm text-white/80 mt-1" numberOfLines={2}>{featured.message}</Text>
                  </View>
                  <ChevronRight size={22} color="rgba(255,255,255,0.8)" />
                </View>
              </LinearGradient>
            </Card>
          </AnimatedBlock>
        )}

        <View className="gap-3">
          {rest.map((c, idx) => (
            <AnimatedBlock key={c.id} animation="fade-up" delay={80 + idx * 60}>
              <Card onPress={() => openSheet('promotions')} className="p-5 overflow-hidden relative border border-cream-200">
                <View className="flex-row items-start gap-4">
                  <View className="h-12 w-12 rounded-2xl bg-ex-red items-center justify-center shrink-0 shadow-red">
                    <Flame size={22} color="#fff" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full bg-ex-red/10 self-start mb-1.5">
                      <Tag size={9} color={colors.ex.red} />
                      <Text className="text-[9px] font-bold uppercase tracking-wide text-ex-red">Aktif</Text>
                    </View>
                    <Text className="text-base font-bold text-ink-900 leading-tight font-display">{c.title || c.name}</Text>
                    <Text className="text-sm text-ink-500 mt-0.5" numberOfLines={2}>{c.message}</Text>
                  </View>
                  <ChevronRight size={20} color={colors.ink[300]} />
                </View>
              </Card>
            </AnimatedBlock>
          ))}
        </View>
      </StateWrapper>

      <View className="mt-8">
        <SectionHeader title="Kuponlar & Promosyonlar" />
        <Card onPress={() => openSheet('promotions')} className="p-5 flex-row items-center gap-4 border border-cream-200">
          <View className="h-12 w-12 rounded-2xl bg-ex-red/10 items-center justify-center shrink-0">
            <Gift size={22} color={colors.ex.red} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-ink-900">Tüm promosyonları gör</Text>
            <Text className="text-xs text-ink-400 mt-0.5">İndirim kuponları ve özel fırsatlar</Text>
          </View>
          <ChevronRight size={20} color={colors.ink[300]} />
        </Card>
      </View>

      <View className="mt-6">
        <LinearGradient
          colors={['#FFF5F6', '#FFFFFF']}
          className="rounded-[1.25rem] p-5 border border-ex-red/10"
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-sm font-bold text-ink-900">Sadakat puanların</Text>
              <Text className="text-xs text-ink-400 mt-0.5">{(profile?.points ?? 0).toLocaleString('tr-TR')} puan hazır</Text>
            </View>
            <Text className="text-3xl font-bold text-ex-red font-display">{(profile?.points ?? 0).toLocaleString('tr-TR')}</Text>
          </View>
          <Button variant="primary" full onPress={() => openSheet('rewards')}>
            <Gift size={16} /> Ödülleri kullan
          </Button>
        </LinearGradient>
      </View>
    </ScreenWrapper>
  );
}
