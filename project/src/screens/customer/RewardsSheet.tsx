import { useState } from 'react';
import { View, Text, Pressable, ScrollView, Image } from 'react-native';
import { Crown, Zap, Gift, Star, Lock, Check } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { TIERS } from '@shared/constants/loyalty';
import {
  formatPoints,
  formatRewardCost,
  getNextTier,
  getTierProgress,
  getRewardButtonLabel,
  computeStampProgress,
} from '@shared/utils/loyalty';
import { STAMP_CARD_SIZE } from '@shared/constants/loyalty';
import { redeemReward } from '@/services/loyalty';
import { useRewards, usePointsHistory, useLoyaltyStamps, useRewardRedemptions } from '@/lib/hooks';
import { useOperationContext } from '@/hooks/useOperationContext';
import { buildLoyaltyTimeline } from '@shared/utils/loyaltyTimeline';
import { getActiveTierBenefits } from '@shared/utils/tierBenefits';
import { LoyaltyTimelineList } from '@/components/loyalty/LoyaltyTimelineList';
import { Sheet } from '@/components/ui/Sheet';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StateWrapper } from '@/components/ui/States';
import { cn } from '@/lib/utils';

export function RewardsSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const { profile, refreshProfile } = useAuth();
  const { data: rewards, error: rewErr, loading: rewLoading, reload: rewReload } = useRewards();
  const { data: history, error: histErr, loading: histLoading, reload: histReload } = usePointsHistory();
  const { data: stamps } = useLoyaltyStamps();
  const { data: redemptions, reload: redReload } = useRewardRedemptions();
  const { ctx, loading: ctxLoading, error: ctxErr, reload: ctxReload } = useOperationContext();
  const [tab, setTab] = useState<'rewards' | 'history'>('rewards');

  const open = sheet === 'rewards';

  const points = profile?.points ?? 0;
  const tier = profile?.tier ?? 'Bronz';
  const redeemedIds = new Set(redemptions?.map(r => r.reward_id) ?? []);
  const activeStamps = stamps?.filter(s => !s.redeemed) ?? [];
  const { currentStamps, freeCoffees } = computeStampProgress(activeStamps.length, STAMP_CARD_SIZE);

  const nextTier = getNextTier(tier);
  const tierProgress = getTierProgress(points, tier);
  const activeBenefits = getActiveTierBenefits(tier, profile?.lifetime_points ?? 0);
  const timeline = buildLoyaltyTimeline({
    pointsHistory: ctx?.pointsHistory ?? history ?? [],
    stamps: ctx?.stamps ?? stamps ?? [],
    redemptions: ctx?.redemptions ?? redemptions ?? [],
    freeCoffees: ctx?.freeCoffees ?? [],
    qrScans: ctx?.qrScans ?? [],
    notifications: ctx?.notifications ?? [],
    rewards: ctx?.rewards ?? rewards ?? [],
    limit: 30,
  });

  const redeem = async (rewardId: string, title: string, cost: number) => {
    if (points < cost) { showToast(`${cost - points} puana daha ihtiyacın var`); return; }
    if (redeemedIds.has(rewardId) && cost === 0) { showToast('Bu ödül zaten kullanıldı'); return; }
    const result = await redeemReward(rewardId);
    if (result.error === 'insufficient_points') { showToast(`${result.needed ?? 0} puana daha ihtiyacın var`); return; }
    if (result.error) { showToast('Bir hata oluştu: ' + result.error); return; }
    showToast(`${title} kullanıldı`);
    await refreshProfile();
    redReload();
    histReload();
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="Sadakat & Ödüller">
      <View className="gap-5">
        {/* Digital loyalty card */}
        <View className="relative overflow-hidden rounded-3xl bg-ink-900 shadow-premium">
          <View className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-ex-red/20" />
          <View className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-ex-red/8" />
          <View className="absolute top-0 right-0 w-32 h-32 opacity-10">
            <Image source={{ uri: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=200' }} className="h-full w-full" resizeMode="cover" />
          </View>
          <View className="relative p-5">
            <View className="flex-row items-start justify-between mb-5">
              <View>
                <View className="flex-row items-center gap-1.5">
                  <View className="h-7 w-7 rounded-lg bg-ex-red items-center justify-center">
                    <Text className="text-xs font-extrabold text-white leading-none">X</Text>
                  </View>
                  <Text className="text-[11px] font-bold text-white/60 uppercase tracking-widest">Espresso X</Text>
                </View>
                <Text className="text-[10px] text-ink-300 mt-3 uppercase tracking-wide">Puan bakiyen</Text>
                <Text className="text-[40px] font-bold text-white leading-none mt-1 font-display">
                  {formatPoints(points)}
                </Text>
              </View>
              <View className="items-end">
                <View className="px-3 py-1.5 rounded-full bg-white/10 flex-row items-center gap-1.5">
                  <Crown size={12} color="#C8102E" fill="#C8102E" />
                  <Text className="text-xs font-bold text-white">{tier}</Text>
                </View>
                <Text className="text-[10px] text-ink-400 mt-2">#{profile?.user_id?.slice(0, 8).toUpperCase() ?? 'EX-0000'}</Text>
              </View>
            </View>

            <View className="h-px bg-white/10 mb-4" />

            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-[11px] text-ink-300 font-medium">{nextTier ? `${nextTier.name} seviyesine` : 'En üst seviye'}</Text>
              <Text className="text-[11px] font-bold text-white">{tierProgress}%</Text>
            </View>
            <View className="h-2 rounded-full bg-ink-800 overflow-hidden">
              <View className="h-full rounded-full bg-red-gradient" style={{ width: `${tierProgress}%` }} />
            </View>
            {nextTier && (
              <Text className="text-[10px] text-ink-400 mt-2">
                {(nextTier.minPoints - points).toLocaleString('tr-TR')} puan sonra {nextTier.name}
              </Text>
            )}
          </View>
        </View>

        {/* Stats */}
        <View className="flex-row gap-3">
          {[
            { label: 'Yaşam boyu', value: formatPoints(profile?.lifetime_points ?? 0), icon: Zap },
            { label: 'Seri', value: `${profile?.streak ?? 0} gün`, icon: Gift },
            { label: 'Damga', value: `${currentStamps}/${STAMP_CARD_SIZE}`, icon: Crown },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="flex-1 p-3.5 items-center">
              <View className="h-9 w-9 rounded-xl bg-ex-red/10 items-center justify-center">
                <Icon size={15} color="#C8102E" />
              </View>
              <Text className="text-base font-bold text-ink-900 leading-none mt-2">{value}</Text>
              <Text className="text-[10px] text-ink-400 mt-1">{label}</Text>
            </Card>
          ))}
        </View>

        {/* Tiers */}
        <View>
          <Text className="text-xs font-bold text-ink-400 uppercase tracking-wide mb-3">Seviyeler</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pb-1">
            {TIERS.map(t => {
              const isCurrent = t.name === tier;
              const reached = points >= t.minPoints;
              return (
                <View
                  key={t.name}
                  className={cn(
                    'shrink-0 w-52 p-4 rounded-2xl border',
                    isCurrent ? 'border-ex-red bg-red-50 shadow-soft' : reached ? 'border-ink-200 bg-white' : 'border-ink-100 bg-cream-50 opacity-60',
                  )}
                >
                  <View className="flex-row items-center gap-2 mb-3">
                    <View className="h-9 w-9 rounded-xl items-center justify-center shadow-soft" style={{ backgroundColor: t.color }}>
                      <Crown size={15} color="#fff" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-ink-900 leading-none">{t.name}</Text>
                      <Text className="text-[10px] text-ink-400 mt-0.5">{formatPoints(t.minPoints)}+ puan</Text>
                    </View>
                    {isCurrent && (
                      <View className="px-2 py-0.5 rounded-full bg-ex-red">
                        <Text className="text-[8px] font-bold text-white uppercase tracking-wide">Şimdi</Text>
                      </View>
                    )}
                    {reached && !isCurrent && <Check size={14} color="#16a34a" />}
                  </View>
                  <View className="gap-1.5">
                    {t.perks.map(perk => (
                      <View key={perk} className="flex-row items-center gap-1.5">
                        <Star size={9} color="#C8102E" fill="#C8102E" />
                        <Text className="text-[10px] text-ink-500 flex-1">{perk}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View className="rounded-2xl bg-white border border-ink-100 p-4">
          <Text className="text-xs font-bold text-ink-400 uppercase mb-2">Aktif VIP Avantajların</Text>
          <View className="gap-1.5">
            {activeBenefits.slice(0, 5).map(b => (
              <View key={b.id} className="flex-row items-center gap-2">
                <Text className={b.active ? 'text-green-600 text-xs' : 'text-ink-300 text-xs'}>{b.active ? '●' : '○'}</Text>
                <Text className="text-xs text-ink-600 flex-1">{b.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {freeCoffees > 0 && (
          <View className="px-4 py-3 rounded-2xl bg-green-50 border border-green-100">
            <Text className="text-sm font-semibold text-green-800">{freeCoffees} ücretsiz kahve hakkın var</Text>
            <Text className="text-[11px] text-green-700 mt-0.5">Şubede QR kodunu okutarak kullan</Text>
          </View>
        )}

        <View className="flex-row gap-2 p-1 rounded-xl bg-cream-100">
          {([['rewards', 'Ödüller'], ['history', 'Sadakat geçmişi']] as const).map(([t, label]) => (
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
                const isSingleUse = reward.points_cost === 0;
                const alreadyRedeemed = isSingleUse && redeemedIds.has(reward.id);
                return (
                  <Card key={reward.id} className="p-3 flex-row items-center gap-3.5">
                    <Image source={{ uri: reward.image }} className="h-16 w-16 rounded-2xl" resizeMode="cover" />
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-bold text-ink-900 leading-tight">{reward.title}</Text>
                      <Text className="text-[11px] text-ink-400 mt-0.5" numberOfLines={1}>{reward.description}</Text>
                      <View className="flex-row items-center gap-1.5 mt-1.5">
                        {canRedeem ? <Zap size={11} color="#C8102E" fill="#C8102E" /> : <Lock size={11} color="#9494A0" />}
                        <Text className={cn('text-xs font-bold', canRedeem ? 'text-ex-red' : 'text-ink-400')}>
                          {formatRewardCost(reward.points_cost)}
                        </Text>
                      </View>
                    </View>
                    <Button
                      size="sm"
                      variant={alreadyRedeemed ? 'outline' : canRedeem ? 'primary' : 'outline'}
                      disabled={!canRedeem || alreadyRedeemed}
                      onPress={() => redeem(reward.id, reward.title, reward.points_cost)}
                    >
                      {getRewardButtonLabel(canRedeem, alreadyRedeemed)}
                    </Button>
                  </Card>
                );
              })}
            </View>
          </StateWrapper>
        )}

        {tab === 'history' && (
          <StateWrapper
            loading={histLoading || ctxLoading}
            error={histErr ?? ctxErr}
            empty={!histLoading && !ctxLoading && timeline.length === 0}
            loadingLabel="Sadakat geçmişi yükleniyor…"
            emptyTitle="Kayıt yok"
            emptySubtitle="Puan, damga ve ödül hareketleri burada görünür"
            onRetry={() => { histReload(); ctxReload(); }}
          >
            <LoyaltyTimelineList items={timeline} />
          </StateWrapper>
        )}
      </View>
    </Sheet>
  );
}
