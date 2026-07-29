import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, ChevronRight, QrCode, Coffee, Stamp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatPoints } from '@shared/utils/loyalty';
import { STAMP_CARD_SIZE } from '@shared/constants/loyalty';
import { tierColor } from '@shared/constants/loyalty';

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
  const accent = tierColor(tier);
  const stampFilled = Math.min(stampCount, STAMP_CARD_SIZE);

  return (
    <View className="px-5 pt-4">
      <Text className="text-sm text-ink-500 font-medium">{greeting},</Text>
      <Text className="text-[32px] font-bold text-ink-900 leading-tight mt-0.5 font-display">
        {firstName}
      </Text>

      <Pressable onPress={onOpenRewards} className="mt-5 active:scale-[0.99]">
        <Card variant="premium" className="overflow-hidden p-0">
          <LinearGradient
            colors={['#C8102E', '#A00D24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="p-5"
          >
            <View className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Crown size={14} color="#FFFFFF" fill="#FFFFFF" />
                  <Text className="text-[11px] font-bold text-white/90 uppercase tracking-widest">
                    {tier} Üye
                  </Text>
                </View>
                <Text className="text-[36px] font-bold text-white mt-2 font-display leading-none">
                  {formatPoints(points)}
                  <Text className="text-base font-normal text-white/70 font-sans"> puan</Text>
                </Text>
              </View>
              <View className="h-10 w-10 rounded-2xl bg-white/15 items-center justify-center">
                <ChevronRight size={18} color="#FFFFFF" />
              </View>
            </View>

            <View className="mt-5">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-[11px] text-white/70 font-medium">{nextTierLabel}</Text>
                <Text className="text-[11px] font-bold text-white">
                  {pointsToNextTier > 0 ? `${formatPoints(pointsToNextTier)} puan kaldı` : 'En üst seviye'}
                </Text>
              </View>
              <View className="h-2 rounded-full bg-white/20 overflow-hidden">
                <View
                  className="h-full rounded-full bg-white"
                  style={{ width: `${tierProgress}%` }}
                />
              </View>
            </View>

            <View className="mt-4 flex-row items-center gap-2">
              <Stamp size={14} color="#FFFFFF" />
              <Text className="text-xs text-white/85 font-medium">Damga kartı</Text>
              <View className="flex-row gap-1.5 ml-1">
                {Array.from({ length: STAMP_CARD_SIZE }).map((_, i) => (
                  <View
                    key={i}
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: i < stampFilled ? '#FFFFFF' : 'rgba(255,255,255,0.25)' }}
                  />
                ))}
              </View>
              <Text className="text-[10px] text-white/70 ml-auto">{stampCount % STAMP_CARD_SIZE}/{STAMP_CARD_SIZE}</Text>
            </View>
          </LinearGradient>
        </Card>
      </Pressable>

      <View className="mt-4 flex-row gap-3">
        <Pressable onPress={onOrder} className="flex-1 active:scale-[0.97]">
          <Card className="p-4">
            <View className="h-11 w-11 rounded-2xl bg-ex-red/10 items-center justify-center">
              <Coffee size={20} color={accent} />
            </View>
            <Text className="text-sm font-bold text-ink-900 mt-3">Sipariş Ver</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">Hızlı sipariş</Text>
          </Card>
        </Pressable>
        <Pressable onPress={onOpenQr} className="flex-1 active:scale-[0.97]">
          <Card className="p-4">
            <View className="h-11 w-11 rounded-2xl bg-ink-900 items-center justify-center">
              <QrCode size={20} color="#FFFFFF" />
            </View>
            <Text className="text-sm font-bold text-ink-900 mt-3">QR Kartım</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">Okut, puan kazan</Text>
          </Card>
        </Pressable>
      </View>
    </View>
  );
}
