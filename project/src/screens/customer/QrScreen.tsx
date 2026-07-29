import { Crown, Maximize2, Gift, Coffee } from 'lucide-react';
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useQrCode, useLoyaltyStamps } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { QrCodeImage } from '@/components/customer/QrCodeImage';
import { PageHeader, ScreenWrapper } from '@/components/customer';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { STAMP_CARD_SIZE } from '@shared/constants/loyalty';
import { computeStampProgress, formatPoints } from '@shared/utils/loyalty';
import { cn } from '@/lib/utils';
import { colors } from '@shared/design/tokens';

export function QrScreen() {
  const { profile } = useAuth();
  const { openSheet } = useApp();
  const { data: qrCode, loading } = useQrCode();
  const { data: stamps } = useLoyaltyStamps();
  const [qrFullOpen, setQrFullOpen] = useState(false);

  const points = profile?.points ?? 0;
  const tier = profile?.tier ?? 'Bronz';
  const stampsActive = stamps?.filter(s => !s.redeemed) ?? [];
  const stampProgress = computeStampProgress(stampsActive.length, STAMP_CARD_SIZE);
  const freeCoffees = stampProgress.freeCoffees;
  const currentStamps = stampProgress.currentStamps;

  return (
    <ScreenWrapper width="default">
      <PageHeader title="QR Kartım" subtitle="Mağazada okut, puan kazan" />

      <View className="flex-row gap-6">
        <View className="flex-1">
          <Pressable onPress={() => setQrFullOpen(true)} className="active:scale-[0.98]">
            <View className="bg-white rounded-[1.75rem] p-8 items-center shadow-premium border border-cream-200">
              <LinearGradient colors={[colors.ex.red, colors.ex.redDark]} className="absolute top-0 left-0 right-0 h-1.5 rounded-t-[1.75rem]" />
              {loading ? (
                <Text className="text-sm text-ink-400 py-12">QR kod oluşturuluyor…</Text>
              ) : qrCode ? (
                <>
                  <View className="px-3 py-1 rounded-full bg-ex-red/10 mb-5 mt-1">
                    <Text className="text-[10px] font-bold text-ex-red uppercase tracking-widest">Okut · Puan Kazan</Text>
                  </View>
                  <View className="rounded-2xl bg-white p-3 border-2 border-cream-200 items-center justify-center">
                    <QrCodeImage value={qrCode.code} size={220} />
                  </View>
                  <View className="mt-5 flex-row items-center gap-2 px-4 py-2 rounded-full bg-ex-red/5">
                    <Maximize2 size={14} color={colors.ex.red} />
                    <Text className="text-sm font-semibold text-ex-red">Büyütmek için dokun</Text>
                  </View>
                </>
              ) : (
                <Text className="text-sm text-ex-red py-12">QR kod yüklenemedi</Text>
              )}
            </View>
          </Pressable>
        </View>

        <View className="w-52 gap-3">
          {[
            { icon: Crown, label: 'Seviye', value: tier, accent: true },
            { icon: Gift, label: 'Puan', value: formatPoints(points), accent: false },
            { icon: Coffee, label: 'Ücretsiz', value: String(freeCoffees), accent: false },
          ].map(({ icon: Icon, label, value, accent }) => (
            <Card key={label} className={cn('p-5 items-center', accent && 'border-ex-red/20 bg-ex-red/5')}>
              <View className={cn('h-10 w-10 rounded-xl items-center justify-center mb-2', accent ? 'bg-ex-red' : 'bg-cream-100')}>
                <Icon size={18} color={accent ? '#fff' : colors.ex.red} />
              </View>
              <Text className="text-xl font-bold text-ink-900 font-display leading-none">{value}</Text>
              <Text className="text-[10px] text-ink-400 mt-1 uppercase tracking-wide">{label}</Text>
            </Card>
          ))}
        </View>
      </View>

      <View className="mt-8 mb-6">
        <SectionHeader title="Damga Kartı" subtitle={`${STAMP_CARD_SIZE} kahve al, 1 ücretsiz`} />
        <Card className="p-5 border border-cream-200">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <Coffee size={16} color={colors.ex.red} />
              <Text className="text-sm font-bold text-ink-900">{currentStamps} / {STAMP_CARD_SIZE}</Text>
            </View>
            {freeCoffees > 0 && (
              <View className="px-3 py-1 rounded-full bg-ex-red">
                <Text className="text-[10px] font-bold text-white">{freeCoffees} ücretsiz kahve hazır!</Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-2.5">
            {Array.from({ length: STAMP_CARD_SIZE }).map((_, i) => (
              <View
                key={i}
                className={cn(
                  'flex-1 aspect-square rounded-xl items-center justify-center',
                  i < currentStamps ? 'bg-ex-red shadow-red' : 'bg-cream-100 border border-cream-200',
                )}
              >
                {i < currentStamps && <Coffee size={16} color="#fff" />}
              </View>
            ))}
          </View>
          <Text className="text-[11px] text-ink-400 mt-3 text-center">
            {currentStamps >= STAMP_CARD_SIZE
              ? '5 damga tamam! Ödülünü almak için QR kodunu tekrar okut.'
              : `${STAMP_CARD_SIZE - currentStamps} kahve daha al, bir ücretsiz kahve kazan`}
          </Text>
        </Card>
      </View>

      <Button variant="primary" full onPress={() => openSheet('rewards')}>
        <Gift size={16} /> Ödüllerimi gör
      </Button>

      <Sheet open={qrFullOpen} onClose={() => setQrFullOpen(false)} title="Üyelik QR">
        <View className="items-center py-4">
          {loading ? (
            <Text className="text-sm text-ink-400 py-8">QR kod oluşturuluyor…</Text>
          ) : qrCode ? (
            <>
              <View className="rounded-2xl bg-white p-4 border border-cream-200 items-center justify-center">
                <QrCodeImage value={qrCode.code} size={260} />
              </View>
              <Text className="text-lg font-bold text-ink-900 mt-5 font-display">{profile?.full_name}</Text>
              <Text className="text-sm text-ex-red mt-0.5 font-semibold">{tier} Üye · {formatPoints(points)} puan</Text>
              <Text className="text-xs text-ink-400 mt-1">{qrCode.code}</Text>
              <View className="mt-4 p-3.5 rounded-xl bg-cream-100">
                <Text className="text-[11px] text-ink-500 text-center">
                  Bu QR kod size özeldir. Puan kazanmak, ödül kullanmak veya ödemek için mağazada tara.
                </Text>
              </View>
            </>
          ) : (
            <Text className="text-sm text-ex-red py-8">QR kod yüklenemedi</Text>
          )}
        </View>
      </Sheet>
    </ScreenWrapper>
  );
}
