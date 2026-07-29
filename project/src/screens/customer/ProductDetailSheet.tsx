import { useState, useMemo, useEffect } from 'react';
import { View, Text, Pressable, Image, TextInput as RNTextInput, ScrollView } from 'react-native';
import { Heart, Star, Minus, Plus, Check, Info, Flame } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { formatPrice, cn } from '@/lib/utils';
import type { ProductOption } from '@/types';

export function ProductDetailSheet() {
  const { sheet, closeSheet, selectedProduct, addToCart, favorites, toggleFavorite } = useApp();
  const open = sheet === 'product';

  const p = selectedProduct;
  const [size, setSize] = useState<ProductOption | null>(null);
  const [milk, setMilk] = useState<ProductOption | null>(null);
  const [syrup, setSyrup] = useState<ProductOption | null>(null);
  const [topping, setTopping] = useState<ProductOption | null>(null);
  const [temp, setTemp] = useState<ProductOption | null>(null);
  const [iceLevel, setIceLevel] = useState<string | null>(null);
  const [extraEspresso, setExtraEspresso] = useState(0);
  const [notes, setNotes] = useState('');
  const [qty, setQty] = useState(1);
  const [showNutrition, setShowNutrition] = useState(false);

  useEffect(() => {
    if (open && p) {
      setSize(p.sizes[0]); setMilk(p.milks[0]); setSyrup(p.syrups[0]);
      setTopping(p.toppings[0]); setTemp(p.temperature[0]); setIceLevel(p.iceLevels[0]);
      setExtraEspresso(0); setNotes(''); setQty(1); setShowNutrition(false);
    }
  }, [open, p]);

  const fav = p ? favorites.includes(p.id) : false;

  const unitPrice = useMemo(() => {
    if (!p || !size || !milk || !temp) return p?.price ?? 0;
    return p.price + size.priceModifier + milk.priceModifier +
      (syrup?.priceModifier ?? 0) + (topping?.priceModifier ?? 0) +
      temp.priceModifier + extraEspresso * 12;
  }, [p, size, milk, temp, syrup, topping, extraEspresso]);

  if (!p) return null;
  const canAdd = size && milk && temp;

  const handleAdd = () => {
    if (!canAdd || !size || !milk || !temp) return;
    for (let i = 0; i < qty; i++) {
      addToCart(p, { size, milk, syrup, topping, temperature: temp, iceLevel: iceLevel ?? 'Buz Yok', extraEspresso, notes });
    }
    closeSheet();
  };

  const Pill = ({ opt, selected, onPress, price }: { opt: ProductOption; selected: boolean; onPress: () => void; price?: boolean }) => (
    <Pressable
      onPress={onPress}
      className={cn(
        'flex-row items-center justify-between px-3.5 py-2.5 rounded-xl border active:opacity-80',
        selected ? 'border-ex-red bg-red-50' : 'border-ink-100',
      )}
    >
      <View className="flex-row items-center gap-2">
        {selected && <Check size={13} color="#C8102E" />}
        <Text className={cn('text-sm', selected ? 'text-ink-900' : 'text-ink-500')}>{opt.label}</Text>
      </View>
      {price && opt.priceModifier > 0 && <Text className="text-xs text-ex-red">+{formatPrice(opt.priceModifier)}</Text>}
    </Pressable>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View className="mb-5">
      <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2.5">{title}</Text>
      {children}
    </View>
  );

  return (
    <Sheet open={open} onClose={closeSheet}>
      <View className="relative -mx-5 -mt-5 h-56 overflow-hidden">
        <Image source={{ uri: p.image }} className="h-full w-full" resizeMode="cover" />
        <View className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent" />
        <Pressable
          onPress={() => toggleFavorite(p.id)}
          className="absolute top-4 right-4 h-10 w-10 rounded-full bg-ink-950/40 items-center justify-center active:scale-110"
        >
          <Heart size={18} color={fav ? '#C8102E' : '#fff'} fill={fav ? '#C8102E' : 'transparent'} />
        </Pressable>
        {p.aiRecommended && (
          <View className="absolute top-4 left-4 px-2.5 py-1 rounded-full bg-ex-red">
            <Text className="text-[10px] font-bold text-white">AI ÖNERİSİ</Text>
          </View>
        )}
      </View>

      <View className="-mt-8 relative">
        <View className="flex-row items-center gap-1.5 mb-1">
          <Star size={13} color="#C8102E" fill="#C8102E" />
          <Text className="text-xs text-ink-400">{p.rating} · {p.calories} kal</Text>
        </View>
        <Text className="text-2xl font-bold text-ink-900 tracking-tight">{p.name}</Text>
        <Text className="text-sm text-ink-500 mt-1.5 leading-relaxed">{p.description}</Text>

        {p.allergens.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mt-3">
            {p.allergens.map(a => (
              <View key={a} className="px-2.5 py-1 rounded-full bg-ink-50"><Text className="text-[10px] font-medium text-ink-500">{a}</Text></View>
            ))}
          </View>
        )}
      </View>

      <View className="mt-6">
        <Section title="Boy">
          <View className="flex-row gap-2">
            {p.sizes.map(o => <View key={o.id} className="flex-1"><Pill opt={o} selected={size?.id === o.id} onPress={() => setSize(o)} price /></View>)}
          </View>
        </Section>

        {p.milks.length > 1 && (
          <Section title="Süt">
            <View className="flex-row flex-wrap gap-2">
              {p.milks.map(o => <View key={o.id} className="w-[48%]"><Pill opt={o} selected={milk?.id === o.id} onPress={() => setMilk(o)} price /></View>)}
            </View>
          </Section>
        )}

        {p.temperature.length > 1 && (
          <Section title="Sıcaklık">
            <View className="flex-row gap-2">
              {p.temperature.map(o => <View key={o.id} className="flex-1"><Pill opt={o} selected={temp?.id === o.id} onPress={() => setTemp(o)} price /></View>)}
            </View>
          </Section>
        )}

        {p.iceLevels.length > 1 && (
          <Section title="Buz seviyesi">
            <View className="flex-row flex-wrap gap-2">
              {p.iceLevels.map(o => (
                <Pressable
                  key={o}
                  onPress={() => setIceLevel(o)}
                  className={cn('px-3.5 py-2 rounded-xl border active:opacity-80', iceLevel === o ? 'border-ex-red bg-red-50' : 'border-ink-100')}
                >
                  <Text className={cn('text-sm', iceLevel === o ? 'text-ink-900' : 'text-ink-500')}>{o}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        {p.syrups.length > 1 && (
          <Section title="Şurup">
            <View className="flex-row flex-wrap gap-2">
              {p.syrups.map(o => <View key={o.id} className="w-[48%]"><Pill opt={o} selected={syrup?.id === o.id} onPress={() => setSyrup(o)} price /></View>)}
            </View>
          </Section>
        )}

        {p.toppings.length > 1 && (
          <Section title="Üst Malzeme">
            <View className="flex-row flex-wrap gap-2">
              {p.toppings.map(o => <View key={o.id} className="w-[48%]"><Pill opt={o} selected={topping?.id === o.id} onPress={() => setTopping(o)} price /></View>)}
            </View>
          </Section>
        )}

        <Section title="Ekstra espresso shot">
          <View className="flex-row items-center justify-between px-3.5 py-2.5 rounded-xl border border-ink-100">
            <Text className="text-sm text-ink-500">Shot başına +{formatPrice(12)}</Text>
            <View className="flex-row items-center gap-3">
              <Pressable onPress={() => setExtraEspresso(e => Math.max(0, e - 1))} className="h-7 w-7 rounded-full bg-ink-100 items-center justify-center"><Minus size={14} color="#525258" /></Pressable>
              <Text className="text-sm font-semibold text-ink-900">{extraEspresso}</Text>
              <Pressable onPress={() => setExtraEspresso(e => Math.min(4, e + 1))} className="h-7 w-7 rounded-full bg-ink-900 items-center justify-center"><Plus size={14} color="#fff" /></Pressable>
            </View>
          </View>
        </Section>

        <Section title="Özel notlar">
          <RNTextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Örn. ekstra sıcak, kafeinsiz, laktozsuz…"
            placeholderTextColor="#9494A0"
            multiline
            className="w-full px-3.5 py-2.5 rounded-xl bg-cream-50 border border-ink-100 text-sm text-ink-900"
          />
        </Section>

        <Pressable onPress={() => setShowNutrition(s => !s)} className="flex-row items-center gap-2 mb-3">
          <Info size={14} color="#C8102E" />
          <Text className="text-xs font-medium text-ex-red">Beslenme & detaylar {showNutrition ? '−' : '+'}</Text>
        </Pressable>
        {showNutrition && (
          <View className="flex-row gap-2 mb-2">
            {[
              { label: 'Kalori', value: p.nutrition.calories, unit: 'kal' },
              { label: 'Yağ', value: p.nutrition.fat, unit: 'g' },
              { label: 'Karb', value: p.nutrition.carbs, unit: 'g' },
              { label: 'Protein', value: p.nutrition.protein, unit: 'g' },
            ].map(n => (
              <View key={n.label} className="flex-1 p-2 rounded-xl bg-cream-50 items-center">
                <Text className="text-lg font-bold text-ink-900">{n.value}</Text>
                <Text className="text-[9px] text-ink-400">{n.label} · {n.unit}</Text>
              </View>
            ))}
          </View>
        )}
        {showNutrition && p.nutrition.caffeine > 0 && (
          <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl bg-red-50">
            <Flame size={13} color="#C8102E" />
            <Text className="text-xs text-ex-red">{p.nutrition.caffeine}mg kafein</Text>
          </View>
        )}
      </View>

      <View className="mt-4 p-4 border-t border-ink-100 flex-row items-center gap-3">
        <View className="flex-row items-center gap-2 bg-white rounded-2xl border border-ink-100 px-1">
          <Pressable onPress={() => setQty(q => Math.max(1, q - 1))} className="h-9 w-9 items-center justify-center"><Minus size={16} color="#525258" /></Pressable>
          <Text className="text-sm font-semibold text-ink-900">{qty}</Text>
          <Pressable onPress={() => setQty(q => Math.min(9, q + 1))} className="h-9 w-9 items-center justify-center"><Plus size={16} color="#525258" /></Pressable>
        </View>
        <Button variant="gold" size="lg" full onPress={handleAdd} disabled={!canAdd}>
          Ekle · {formatPrice(unitPrice * qty)}
        </Button>
      </View>
    </Sheet>
  );
}
