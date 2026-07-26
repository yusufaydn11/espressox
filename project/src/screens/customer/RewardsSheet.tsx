import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { Crown, Zap, Gift, ChevronRight, Star } from 'lucide-react-native';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { TIERS } from '@/data';
import { useRewards, usePointsHistory, useLoyaltyStamps, useRewardRedemptions } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateWrapper } from '@/components/ui/States';
import { cn } from '@/lib/utils';

export function RewardsSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const { profile } = useAuth();
  const { data: rewards, error: rewErr, loading: rewLoading, reload: rewReload } = useRewards();
  const { data: history, error: histErr, loading: histLoading, reload: histReload } = usePointsHistory();
  const { data: stamps } = useLoyaltyStamps();
  const { data: redemptions, reload: redReload } = useRewardRedemptions();
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards');

  const open = sheet === 'rewards';

  const points = profile?.points ?? 0;
  const tier = profile?.tier ?? 'Bronz';
  const redeemedIds = new Set(redemptions?.map(r => r.reward_id) ?? []);

  const currentTierIdx = TIERS.findIndex(t => t.name === tier);
  const nextTier = TIERS[currentTierIdx + 1];
  const tierProgress = nextTier
    ? Math.min(100, Math.round(((points - TIERS[currentTierIdx].minPoints) / (nextTier.minPoints - TIERS[currentTierIdx].minPoints)) * 100))
    : 100;

  const redeem = async (rewardId: string, title: string, cost: number) => {
    if (points < cost) { showToast(`${cost - points} puana daha ihtiyacın var`); return; }
    if (redeemedIds.has(rewardId) && cost === 0) { showToast('Bu ödül zaten kullanıldı'); return; }
    const { supabase } = await import('@/lib/supabase');
    const { data, error } = await supabase.rpc('redeem_reward', { p_reward_id: rewardId });
    if (error) { showToast('Bir hata oluştu: ' + error.message); return; }
    const result = data as { error: string | null; needed?: number };
    if (result.error === 'insufficient_points') { showToast(`${result.needed ?? 0} puana daha ihtiyacın var`); return; }
    if (result.error) { showToast('Bir hata oluştu: ' + result.error); return; }
    showToast(`${title} kullanıldı`);
    redReload();
    histReload();
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="Sadakat & Ödüller">
      <View className="gap-5">
        <View className="p-5 rounded-2xl bg-ink-900">
          <View className="flex-row items-start justify-between mb-4">
            <View>
              <Text className="text-[10px] uppercase tracking-wide text-ink-300">Puan bakiyen</Text>
              <Text className="text-3xl font-bold text-white leading-none mt-1">{points.toLocaleString('tr-TR')}</Text>
            </View>
            <View className="h-11 w-11 rounded-2xl bg-ex-red items-center justify-center">
              <Crown size={20} color="#fff" />
            </View>
          </View>
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="flex-row items-center gap-1">
              <Crown size={11} color="#9494A0" />
              <Text className="text-xs text-ink-300">{tier}</Text>
            </View>
            <Text className="text-xs text-ink-300">{nextTier ? nextTier.name : 'En üst seviye'}</Text>
          </View>
          <View className="h-2 rounded-full bg-ink-800 overflow-hidden">
            <View className="h-full bg-ex-red rounded-full" style={{ width: `${tierProgress}%` }} />
          </View>
          {nextTier && (
            <Text className="text-[10px] text-ink-400 mt-1.5">{nextTier.name} seviyesine {(nextTier.minPoints - points).toLocaleString('tr-TR')} puan kaldı</Text>
          )}
        </View>

        <View className="flex-row gap-3">
          {[
            { label: 'Toplam puan', value: (profile?.lifetime_points ?? 0).toLocaleString('tr-TR'), icon: Zap },
            { label: 'Seri', value: `${profile?.streak ?? 0} gün`, icon: Gift },
            { label: 'Seviye', value: tier, icon: Crown },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="flex-1 p-3 items-center">
              <Icon size={16} color="#C8102E" />
              <Text className="text-sm font-bold text-ink-900 leading-none mt-1">{value}</Text>
              <Text className="text-[10px] text-ink-400 mt-1">{label}</Text>
            </Card>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-5 pb-1">
          {TIERS.map(t => {
            const isCurrent = t.name === tier;
            const reached = points >= t.minPoints;
            return (
              <View
                key={t.name}
                className={cn(
                  'shrink-0 w-48 p-4 rounded-2xl border',
                  isCurrent ? 'border-ex-red bg-red-50' : reached ? 'border-ink-200 bg-white' : 'border-ink-100 bg-cream-50 opacity-60',
                )}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <View className="h-8 w-8 rounded-xl items-center justify-center" style={{ backgroundColor: t.color }}>
                    <Crown size={14} color="#fff" />
                  </View>
                  <View>
                    <Text className="text-sm font-bold text-ink-900 leading-none">{t.name}</Text>
                    <Text className="text-[10px] text-ink-400">{t.minPoints.toLocaleString('tr-TR')}+ puan</Text>
                  </View>
                  {isCurrent && <View className="ml-auto px-1.5 py-0.5 rounded-full bg-ex-red"><Text className="text-[8px] font-bold text-white">MEVCUT</Text></View>}
                </View>
                <View className="gap-1">
                  {t.perks.map(perk => (
                    <View key={perk} className="flex-row items-center gap-1.5">
                      <Star size={9} color="#C8102E" />
                      <Text className="text-[10px] text-ink-500 flex-1">{perk}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View className="flex-row gap-2 p-1 rounded-xl bg-cream-100">
          {([['rewards', 'Ödüller'], ['history', 'Geçmiş']] as const).map(([t, label]) => (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              className={cn(
                'flex-1 py-2.5 rounded-lg',
                tab === t ? 'bg-white shadow-card' : '',
              )}
            >
              <Text className={cn('text-xs font-medium text-center', tab === t ? 'text-ink-900' : 'text-ink-400')}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'rewards' && (
          <StateWrapper
            loading={rewLoading}
            error={rewErr}
            empty={!rewLoading && !rewErr && (rewards?.length ?? 0) === 0}
            loadingLabel="Ödüller yükleniyor…"
            emptyTitle="Ödül yok"
            emptySubtitle="Yakında yeni ödüller eklenecek"
            onRetry={rewReload}
          >
            <View className="gap-3">
              {rewards?.map(reward => {
                const canRedeem = points >= reward.points_cost;
                const alreadyRedeemed = redeemedIds.has(reward.id) && reward.points_cost === 0;
                return (
                  <Card key={reward.id} className="p-3 flex-row items-center gap-3.5">
                    <Image source={{ uri: reward.image }} className="h-14 w-14 rounded-xl" resizeMode="cover" />
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-semibold text-ink-900 leading-tight">{reward.title}</Text>
                      <Text className="text-[11px] text-ink-400 mt-0.5" numberOfLines={1}>{reward.description}</Text>
                      <Text className="text-xs font-semibold text-ex-red mt-1">{reward.points_cost === 0 ? 'Ücretsiz (doğum günü)' : `${reward.points_cost} puan`}</Text>
                    </View>
                    <Button
                      size="sm"
                      variant={alreadyRedeemed ? 'outline' : canRedeem ? 'primary' : 'outline'}
                      disabled={!canRedeem || alreadyRedeemed}
                      onPress={() => redeem(reward.id, reward.title, reward.points_cost)}
                    >
                      {alreadyRedeemed ? 'Kullanıldı' : canRedeem ? 'Kullan' : 'Kilitli'}
                    </Button>
                  </Card>
                );
              })}
            </View>
          </StateWrapper>
        )}

        {tab === 'history' && (
          <StateWrapper
            loading={histLoading}
            error={histErr}
            empty={!histLoading && !histErr && (history?.length ?? 0) === 0}
            loadingLabel="Geçmiş yükleniyor…"
            emptyTitle="Puan geçmişi boş"
            emptySubtitle="Sipariş verdiğinde puanlar burada görünecek"
            onRetry={histReload}
          >
            <Card className="p-0 overflow-hidden">
              {history?.map((h, i) => (
                <View key={h.id} className={cn('flex-row items-center gap-3 px-4 py-3', i < (history.length - 1) && 'border-b border-ink-100')}>
                  <View className={cn(
                    'h-9 w-9 rounded-xl items-center justify-center shrink-0',
                    h.type === 'earn' ? 'bg-green-50' : h.type === 'bonus' ? 'bg-red-50' : 'bg-ink-100',
                  )}>
                    {h.type === 'earn' ? <Zap size={15} color="#16a34a" /> :
                      h.type === 'bonus' ? <Gift size={15} color="#C8102E" /> :
                      <ChevronRight size={15} color="#9494A0" />}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{h.title}</Text>
                    <Text className="text-[11px] text-ink-400">{new Date(h.created_at).toLocaleDateString('tr-TR')}</Text>
                  </View>
                  <Text className={cn('text-sm font-semibold', h.points > 0 ? 'text-green-600' : 'text-ex-red')}>
                    {h.points > 0 ? '+' : ''}{h.points}
                  </Text>
                </View>
              ))}
            </Card>
          </StateWrapper>
        )}
      </View>
    </Sheet>
  );
}
