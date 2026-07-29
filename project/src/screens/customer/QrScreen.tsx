import { Crown, Maximize2, Gift, Coffee } from 'lucide-react';
import { useState, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import QRCode from 'qrcode';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { useQrCode, useLoyaltyStamps } from '@/lib/hooks';
import { Sheet } from '@/components/ui/Sheet';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const STAMP_CARD_SIZE = 5;

export function QrScreen() {
  const { profile } = useAuth();
  const { openSheet } = useApp();
  const { data: qrCode, loading } = useQrCode();
  const { data: stamps } = useLoyaltyStamps();
  const [qrFullOpen, setQrFullOpen] = useState(false);

  const points = profile?.points ?? 0;
  const tier = profile?.tier ?? 'Bronz';
  const stampsActive = stamps?.filter(s => !s.redeemed) ?? [];
  const freeCoffees = Math.floor(stampsActive.length / STAMP_CARD_SIZE);
  const currentStamps = stampsActive.length % STAMP_CARD_SIZE;

  return (
    <View className="mx-auto max-w-md px-5 pt-4 pb-32 w-full">
      <SectionHeader title="QR Kartım" subtitle="Mağazada okut, puan kazan" />

      <Pressable onPress={() => setQrFullOpen(true)} className="active:opacity-90">
        <Card className="p-6 items-center mb-6">
          {loading ? (
            <Text className="text-sm text-ink-400 py-8">QR kod oluşturuluyor…</Text>
          ) : qrCode ? (
            <>
              <View className="w-52 h-52 rounded-2xl bg-white p-4 shadow-soft border border-ink-100 items-center justify-center">
                <QrSvg value={qrCode.code} size={180} />
              </View>
              <View className="mt-5 flex-row items-center justify-center gap-2">
                <Maximize2 size={15} color="#C8102E" />
                <Text className="text-sm font-medium text-ex-red">Büyütmek için dokun</Text>
              </View>
            </>
          ) : (
            <Text className="text-sm text-ex-red py-8">QR kod yüklenemedi</Text>
          )}
        </Card>
      </Pressable>

      <View className="flex-row gap-3 mb-6">
        <Card className="flex-1 p-4 items-center">
          <Crown size={18} color="#C8102E" />
          <Text className="text-base font-bold text-ink-900 leading-none mt-1.5">{tier}</Text>
          <Text className="text-[10px] text-ink-400 mt-1">Seviye</Text>
        </Card>
        <Card className="flex-1 p-4 items-center">
          <Gift size={18} color="#C8102E" />
          <Text className="text-base font-bold text-ink-900 leading-none mt-1.5">{points.toLocaleString('tr-TR')}</Text>
          <Text className="text-[10px] text-ink-400 mt-1">Puan</Text>
        </Card>
        <Card className="flex-1 p-4 items-center">
          <Coffee size={18} color="#C8102E" />
          <Text className="text-base font-bold text-ink-900 leading-none mt-1.5">{freeCoffees}</Text>
          <Text className="text-[10px] text-ink-400 mt-1">Ücretsiz</Text>
        </Card>
      </View>

      <View className="mb-6">
        <SectionHeader title="Damga Kartı" subtitle={`${STAMP_CARD_SIZE} kahve al, 1 ücretsiz`} />
        <Card className="p-5">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-2">
              <Coffee size={16} color="#C8102E" />
              <Text className="text-sm font-semibold text-ink-900">{currentStamps} / {STAMP_CARD_SIZE}</Text>
            </View>
            {freeCoffees > 0 && (
              <View className="px-2.5 py-1 rounded-full bg-red-50">
                <Text className="text-[10px] font-bold text-ex-red">{freeCoffees} ücretsiz kahve hazır!</Text>
              </View>
            )}
          </View>
          <View className="flex-row gap-2.5">
            {Array.from({ length: STAMP_CARD_SIZE }).map((_, i) => (
              <View
                key={i}
                className={cn(
                  'flex-1 aspect-square rounded-xl items-center justify-center',
                  i < currentStamps ? 'bg-ex-red shadow-red' : 'bg-cream-100 border border-ink-100',
                )}
              >
                {i < currentStamps && <Coffee size={16} color="#fff" />}
              </View>
            ))}
          </View>
          <Text className="text-[11px] text-ink-400 mt-3 text-center">
            {STAMP_CARD_SIZE - currentStamps} kahve daha al, bir ücretsiz kahve kazan
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
              <View className="w-64 h-64 rounded-2xl bg-white p-5 shadow-lifted border border-ink-100 items-center justify-center">
                <QrSvg value={qrCode.code} size={224} />
              </View>
              <Text className="text-lg font-bold text-ink-900 mt-5">{profile?.full_name}</Text>
              <Text className="text-sm text-ex-red mt-0.5">{tier} Üye · {points.toLocaleString('tr-TR')} puan</Text>
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
    </View>
  );
}

function QrSvg({ value, size }: { value: string; size: number }) {
  const matrix = useMemo(() => {
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
      return qr.modules.data;
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) return <View style={{ width: size, height: size }} />;

  const count = Math.sqrt(matrix.length);
  const cellSize = size / count;

  return (
    <Svg width={size} height={size}>
      {Array.from({ length: matrix.length }).map((_, i) => {
        const row = Math.floor(i / count);
        const col = i % count;
        if (!matrix[i]) return null;
        return (
          <Rect
            key={i}
            x={col * cellSize}
            y={row * cellSize}
            width={cellSize}
            height={cellSize}
            fill="#0B0F19"
          />
        );
      })}
    </Svg>
  );
}
