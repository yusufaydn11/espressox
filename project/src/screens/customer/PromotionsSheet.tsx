import { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Copy, Check, Tag, Gift, Users, Clock, Wallet, MapPin, Share2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { PROMOTIONS } from '@/data';
import { cn } from '@/lib/utils';

const typeIcons: Record<string, typeof Tag> = {
  'happy-hour': Clock, birthday: Gift, location: MapPin, referral: Users, gift: Gift, wallet: Wallet, campaign: Tag,
};

export function PromotionsSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (code: string) => {
    setCopied(code);
    showToast(`${code} kodu kopyalandı`);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Sheet open={sheet === 'promotions'} onClose={closeSheet} title="Promosyonlar">
      <View className="gap-3">
        {PROMOTIONS.map(promo => {
          const Icon = typeIcons[promo.type] ?? Tag;
          return (
            <View key={promo.id} className="rounded-2xl overflow-hidden border border-ink-100">
              <View className="relative h-28">
                <Image source={{ uri: promo.image }} className="h-full w-full" resizeMode="cover" />
                <View className="absolute inset-0 bg-gradient-to-t from-ink-950/80 to-transparent" />
                <View className="absolute top-3 left-3 flex-row items-center gap-1.5 px-2.5 py-1 rounded-full bg-ex-red">
                  <Icon size={11} color="#fff" />
                  <Text className="text-[10px] font-bold text-white">{promo.discount}</Text>
                </View>
                <View className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-ink-950/50">
                  <Text className="text-[9px] font-medium text-white">{promo.expires}</Text>
                </View>
                <View className="absolute bottom-3 left-3 right-3">
                  <Text className="text-white font-semibold text-sm">{promo.title}</Text>
                  <Text className="text-white/80 text-[11px]" numberOfLines={1}>{promo.subtitle}</Text>
                </View>
              </View>
              <View className="flex-row items-center justify-between p-3 bg-white">
                <View className="flex-row items-center gap-2">
                  <View className="px-2.5 py-1.5 rounded-lg bg-cream-100">
                    <Text className="text-xs font-semibold text-ink-900 tracking-wider">{promo.code}</Text>
                  </View>
                  <Pressable onPress={() => copy(promo.code)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center active:scale-110">
                    {copied === promo.code ? <Check size={13} color="#16a34a" /> : <Copy size={13} color="#525258" />}
                  </Pressable>
                </View>
                <Button size="sm" variant="gold" onPress={() => showToast(`${promo.title} uygulandı!`)}>
                  {promo.type === 'referral' || promo.type === 'gift' ? <><Share2 size={12} /> Paylaş</> : 'Kullan'}
                </Button>
              </View>
            </View>
          );
        })}
      </View>

      <View className="mt-5 p-5 rounded-2xl bg-ink-900 items-center">
        <Users size={24} color="#E11D38" />
        <Text className="text-lg font-semibold text-white mt-2">Arkadaşlarını davet et</Text>
        <Text className="text-xs text-white/60 mt-1 mb-3 text-center">İlk siparişlerini verdiklerinde ikiniz de 200 puan kazanırsınız</Text>
        <Button variant="gold" full onPress={() => showToast('Davet linki paylaşıldı!')}>
          <Share2 size={15} /> Davet linkini paylaş
        </Button>
      </View>
    </Sheet>
  );
}
