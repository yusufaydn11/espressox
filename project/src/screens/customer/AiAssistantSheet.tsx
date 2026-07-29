import { useState, useRef, useEffect, useMemo } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput, ScrollView } from 'react-native';
import { Sparkles, Send, Coffee, Cake, TrendingUp, Lightbulb } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Sheet } from '@/components/ui/Sheet';
import { useProducts, useOrders } from '@/lib/hooks';
import { mapRetailDbProductsToUi, filterRetailPopularProducts } from '@shared/utils/products';
import type { RetailProductDbRow } from '@shared/types/products';
import { cn } from '@/lib/utils';

interface Msg { role: 'ai' | 'user'; text: string; }

const quickActions = [
  { label: 'Kahve öner', icon: Coffee },
  { label: 'Popüler ürünler', icon: TrendingUp },
  { label: 'Beni şaşırt', icon: Lightbulb },
  { label: 'Tatlı eşleştir', icon: Cake },
];

const GREETING = 'Merhaba! Menüden gerçek ürünleri inceleyebilir, popüler içecekleri önerebilirim. Ne içmek istersin?';

export function AiAssistantSheet() {
  const { sheet, closeSheet, setSelectedProduct, openSheet, points } = useApp();
  const { profile } = useAuth();
  const open = sheet === 'ai';
  const { data: dbProducts, loading: productsLoading } = useProducts();
  const { data: orders } = useOrders();
  const [messages, setMessages] = useState<Msg[]>([{ role: 'ai', text: GREETING }]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const products = useMemo(
    () => mapRetailDbProductsToUi((dbProducts ?? []) as RetailProductDbRow[]),
    [dbProducts],
  );
  const popular = useMemo(() => filterRetailPopularProducts(products).slice(0, 4), [products]);

  const suggestions = useMemo(() => popular.map((p, i) => ({
    id: p.id,
    text: `${p.name} — ₺${p.price.toLocaleString('tr-TR')}`,
    productId: p.id,
    confidence: 95 - i * 5,
  })), [popular]);

  useEffect(() => {
    if (open) {
      setMessages([{ role: 'ai', text: GREETING }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, open]);

  const aiRespond = (userText: string): string => {
    const lower = userText.toLowerCase();
    if (productsLoading) return 'Menü yükleniyor, bir saniye…';
    if (products.length === 0) return 'Şu an menüde ürün bulunamadı. Lütfen daha sonra tekrar dene.';

    if (lower.includes('kahve') || lower.includes('içecek') || lower.includes('öner') || lower.includes('popüler')) {
      const pick = popular[0] ?? products[0];
      return pick
        ? `Sana ${pick.name} öneririm — ₺${pick.price.toLocaleString('tr-TR')}. Menüden eklemek ister misin?`
        : 'Menüden bir ürün seçebilirsin.';
    }
    if (lower.includes('alışkanlık') || lower.includes('analiz')) {
      const orderCount = orders?.length ?? 0;
      const name = profile?.full_name?.split(' ')[0] ?? 'Üye';
      return `${name}, ${orderCount} siparişin var ve ${points} sadakat puanın bulunuyor. ${profile?.tier ?? 'Bronz'} seviyesindesin.`;
    }
    if (lower.includes('şaşırt') || lower.includes('sürpriz')) {
      const pick = products[Math.floor(Math.random() * Math.min(products.length, 8))];
      return pick
        ? `Sürpriz önerim: ${pick.name} — ₺${pick.price.toLocaleString('tr-TR')}. Dene bakalım!`
        : 'Menüye göz at, harika seçenekler var.';
    }
    if (lower.includes('tatlı') || lower.includes('eşleştir')) {
      const dessert = products.find(p => /tatlı|pasta|kruvasan|tiramisu/i.test(p.name)) ?? products[0];
      return dessert
        ? `${dessert.name} (₺${dessert.price.toLocaleString('tr-TR')}) kahvenle güzel gider.`
        : 'Menüden tatlı kategorisine bakabilirsin.';
    }
    return 'Kahve öner, popüler ürünleri sor veya "beni şaşırt" de — hepsi gerçek menüden.';
  };

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = { role: 'user', text };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setTimeout(() => {
      const aiMsg: Msg = { role: 'ai', text: aiRespond(text) };
      setMessages(m => [...m, aiMsg]);
    }, 500);
  };

  const handleSuggestion = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      closeSheet();
      setSelectedProduct(product);
      openSheet('product');
    }
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="">
      <View className="flex-row items-center gap-3 -mt-2 mb-4 pb-4 border-b border-ink-100">
        <View className="h-11 w-11 rounded-2xl bg-ex-red items-center justify-center shadow-red">
          <Sparkles size={20} color="#fff" />
        </View>
        <View>
          <Text className="text-lg font-semibold text-ink-900">AI Barista</Text>
          <View className="flex-row items-center gap-1 mt-0.5">
            <View className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <Text className="text-[11px] text-green-600">Canlı menü önerileri</Text>
          </View>
        </View>
      </View>

      <ScrollView ref={scrollRef} className="max-h-[400px] mb-4" showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          {messages.map((m, i) => (
            <View key={i} className={cn('flex-row', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <View className={cn(
                'max-w-[85%] px-4 py-2.5 rounded-2xl',
                m.role === 'user' ? 'bg-ink-900' : 'bg-cream-100',
              )}>
                <Text className={cn('text-sm leading-relaxed', m.role === 'user' ? 'text-white' : 'text-ink-900')}>{m.text}</Text>
              </View>
            </View>
          ))}

          {suggestions.length > 0 && (
            <View className="gap-2 pt-2">
              <Text className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Popüler ürünler</Text>
              {suggestions.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => handleSuggestion(s.productId)}
                  className="p-3 rounded-2xl border border-ex-red/20 bg-red-50 active:opacity-80"
                >
                  <View className="flex-row items-start gap-2">
                    <Sparkles size={14} color="#C8102E" />
                    <View className="flex-1">
                      <Text className="text-xs text-ink-700 leading-relaxed">{s.text}</Text>
                      <Text className="text-[10px] text-ex-red mt-1 font-medium">Sipariş etmek için dokun</Text>
                    </View>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pb-3 mb-2">
        {quickActions.map(qa => (
          <Pressable
            key={qa.label}
            onPress={() => send(qa.label)}
            className="shrink-0 flex-row items-center gap-1.5 px-3 py-2 rounded-full bg-cream-100 active:bg-red-50"
          >
            <qa.icon size={13} color="#525258" />
            <Text className="text-xs font-medium text-ink-600">{qa.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="flex-row items-center gap-2">
        <RNTextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => send(input)}
          placeholder="AI baristana sor…"
          placeholderTextColor="#9494A0"
          className="flex-1 px-4 py-3 rounded-2xl bg-white border border-ink-100 text-sm text-ink-900"
        />
        <Pressable
          onPress={() => send(input)}
          className="h-11 w-11 rounded-2xl bg-ex-red items-center justify-center shrink-0 shadow-red"
        >
          <Send size={17} color="#fff" />
        </Pressable>
      </View>
    </Sheet>
  );
}
