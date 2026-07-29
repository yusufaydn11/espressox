import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, ChevronRight, QrCode, Coffee, Gift, Stamp, Sparkles } from 'lucide-react';
import { formatPoints } from '@shared/utils/loyalty';
import { STAMP_CARD_SIZE } from '@shared/constants/loyalty';
import { colors } from '@shared/design/tokens';
import { AnimatedBlock } from './AnimatedBlock';

interface HomeHeroProps {
  greeting: string;
  firstName: string;
  tier: string;
  points: number;
  tierProgress: number;
  pointsToNextTier: number;
  nextTierLabel: string;
  stampCount: number;
  onOpenRewards: () => void;
  onOpenQr: () => void;
  onOrder: () => void;
}

export function HomeHero({
  greeting,
  firstName,
  tier,
  points,
  tierProgress,
  pointsToNextTier,
  nextTierLabel,
  stampCount,
  onOpenRewards,
  onOpenQr,
  onOrder,
}: HomeHeroProps) {
  const stampFilled = Math.min(stampCount, STAMP_CARD_SIZE);

  return (
    <View className="pt-2 pb-2 relative">
      <AnimatedBlock animation="fade-up" delay={0}>
        <View className="flex-row items-center gap-2 mb-1">
          <View className="h-1.5 w-1.5 rounded-full bg-ex-red" />
          <Text className="text-sm text-ink-400 font-medium">{greeting}</Text>
        </View>
        <Text className="text-[2.75rem] font-bold text-ink-900 leading-none font-display tracking-tight">
          {firstName}
        </Text>
        <Text className="text-sm text-ink-400 mt-2">Bugün ne içmek istersin?</Text>
      </AnimatedBlock>

      <AnimatedBlock animation="fade-up" delay={80} className="mt-6">
        <View className="flex-row gap-5">
          {/* Sadakat kartı */}
          <Pressable onPress={onOpenRewards} className="flex-1 active:scale-[0.99]">
            <View className="rounded-[1.75rem] overflow-hidden shadow-premium bg-white h-full border border-cream-200">
              <LinearGradient
                colors={[colors.ex.red, colors.ex.redDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="px-5 py-3.5 flex-row items-center justify-between"
              >
                <View className="flex-row items-center gap-2">
                  <View className="h-7 w-7 rounded-lg bg-white/20 items-center justify-center">
                    <Crown size={14} color="#fff" fill="#fff" />
                  </View>
                  <Text className="text-xs font-bold text-white uppercase tracking-widest">{tier} Üye</Text>
                </View>
                <ChevronRight size={18} color="rgba(255,255,255,0.8)" />
              </LinearGradient>
              <View className="px-5 py-5 bg-loyalty-gradient">
                <Text className="text-[3.25rem] font-bold text-ink-900 font-display leading-none">{formatPoints(points)}</Text>
                <Text className="text-sm text-ink-400 mt-1">sadakat puanın</Text>
                <View className="mt-5">
                  <View className="flex-row justify-between mb-2">
                    <Text className="text-xs text-ink-500">{nextTierLabel}</Text>
                    <Text className="text-xs font-bold text-ex-red">
                      {pointsToNextTier > 0 ? `${formatPoints(pointsToNextTier)} kaldı` : 'Maksimum seviye'}
                    </Text>
                  </View>
                  <View className="h-2 rounded-full bg-cream-200 overflow-hidden">
                    <View className="h-full rounded-full overflow-hidden" style={{ width: `${Math.max(tierProgress, 4)}%` }}>
                      <LinearGradient
                        colors={[colors.ex.redLight, colors.ex.red]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        className="h-full w-full"
                      />
                    </View>
                  </View>
                </View>
                <View className="mt-4 flex-row items-center gap-2 px-3 py-2 rounded-xl bg-white/80">
                  <Stamp size={14} color={colors.ex.red} />
                  <View className="flex-row gap-1.5 flex-1">
                    {Array.from({ length: STAMP_CARD_SIZE }).map((_, i) => (
                      <View
                        key={i}
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: i < stampFilled ? colors.ex.red : colors.cream[200] }}
                      />
                    ))}
                  </View>
                  <Text className="text-[10px] font-semibold text-ink-400">{stampFilled}/{STAMP_CARD_SIZE}</Text>
                </View>
              </View>
            </View>
          </Pressable>

          {/* Hızlı aksiyonlar */}
          <View className="gap-3 w-48">
            {[
              { icon: Coffee, label: 'Sipariş Ver', sub: 'Menüye git', onPress: onOrder, accent: true },
              { icon: QrCode, label: 'QR Kod', sub: 'Puan kazan', onPress: onOpenQr, accent: false },
              { icon: Gift, label: 'Ödüller', sub: 'Puan kullan', onPress: onOpenRewards, accent: false },
            ].map(({ icon: Icon, label, sub, onPress, accent }) => (
              <Pressable key={label} onPress={onPress} className="active:scale-[0.98]">
                {accent ? (
                  <LinearGradient
                    colors={[colors.ex.red, colors.ex.redDark]}
                    className="rounded-2xl px-4 py-4 flex-row items-center gap-3 shadow-red"
                  >
                    <View className="h-10 w-10 rounded-xl bg-white/20 items-center justify-center">
                      <Icon size={18} color="#fff" />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-white">{label}</Text>
                      <Text className="text-[10px] text-white/70">{sub}</Text>
                    </View>
                  </LinearGradient>
                ) : (
                  <View className="bg-white rounded-2xl px-4 py-4 flex-row items-center gap-3 shadow-soft border border-cream-200">
                    <View className="h-10 w-10 rounded-xl bg-ex-red/10 items-center justify-center">
                      <Icon size={18} color={colors.ex.red} />
                    </View>
                    <View>
                      <Text className="text-sm font-bold text-ink-900">{label}</Text>
                      <Text className="text-[10px] text-ink-400">{sub}</Text>
                    </View>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </AnimatedBlock>

      {/* Promo şerit */}
      <AnimatedBlock animation="fade-up" delay={160} className="mt-5">
        <Pressable onPress={onOrder} className="active:scale-[0.99]">
          <LinearGradient
            colors={['#FFF5F6', '#FFFFFF']}
            className="rounded-2xl px-5 py-4 flex-row items-center gap-4 border border-ex-red/10"
          >
            <View className="h-11 w-11 rounded-xl bg-ex-red items-center justify-center shadow-red">
              <Sparkles size={20} color="#fff" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold text-ink-900">Günün önerisi seni bekliyor</Text>
              <Text className="text-xs text-ink-400 mt-0.5">Sipariş ver, damga ve puan kazan</Text>
            </View>
            <ChevronRight size={18} color={colors.ex.red} />
          </LinearGradient>
        </Pressable>
      </AnimatedBlock>
    </View>
  );
}
