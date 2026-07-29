import { useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, TextInput as RNTextInput, ScrollView } from 'react-native';
import { Sparkles, Send, Coffee, Cake, TrendingUp, Lightbulb } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Sheet } from '@/components/ui/Sheet';
import { AI_CHAT, AI_SUGGESTIONS } from '@/data';
import { useProducts } from '@/lib/hooks';
import { mapRetailDbProductsToUi } from '@shared/utils/products';
import type { RetailProductDbRow } from '@shared/types/products';
import { cn } from '@/lib/utils';

interface Msg { role: 'ai' | 'user'; text: string; }

const quickActions = [
  { label: 'Kahve öner', icon: Coffee },
  { label: 'Tatlı eşleştir', icon: Cake },
  { label: 'Alışkanlık analiz et', icon: TrendingUp },
  { label: 'Beni şaşırt', icon: Lightbulb },
];

export function AiAssistantSheet() {
  const { sheet, closeSheet, setSelectedProduct, openSheet } = useApp();
  const open = sheet === 'ai';
  const { data: dbProducts } = useProducts();
  const [messages, setMessages] = useState<Msg[]>(AI_CHAT);
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  const products = mapRetailDbProductsToUi((dbProducts ?? []) as RetailProductDbRow[]);

  useEffect(() => {
    if (open) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, open]);

  const aiRespond = (userText: string): string => {
    const lower = userText.toLowerCase();
    if (lower.includes('kahve') || lower.includes('içecek') || lower.includes('öner')) {
      return `Sabah rutinine ve çiçeksi notlara olan sevgine göre, Rose Latte öneririm — bunu 9 kez sipariş ettin ve 5 yıldız verdin. Küçük ₺240, Büyük ₺250. Siparişine ekleyeyim mi?`;
    }
    if (lower.includes('tatlı') || lower.includes('eşleştir') || lower.includes('kek') || lower.includes('pasta')) {
      return `Tiramisu, her zamanki espressonla harika eşleşir — kremsi yapısı gül aromasını tamamlar. ₺165 ve bir misafir favorisi. Ekleyeyim mi?`;
    }
    if (lower.includes('alışkanlık') || lower.includes('analiz')) {
      return `Profilin şu şekilde: Çoğunlukla hafta içleri 09:00'dan önce sipariş veriyorsun (%78), yulaf sütü tercih ediyorsun ve ilk 3 içeceğin Rose Latte, Americano ve Matcha Tea Latte. Ortalama sepetin ₺245 — ortalamadan %18 yukarıda. Altın seviyedesin ve 14 günlük serin var!`;
    }
    if (lower.includes('şaşırt') || lower.includes('sürpriz')) {
      return `Sürpriz! Bugün sana ekstra shot ve pistachio cream kremalı Pistachio Creamy hazırlardım — Küçük ₺220'de sınırlı bir zevk. Henüz denemediğin bir misafir favorisi. Ekleyeyim mi?`;
    }
    return `Senin kişisel kahve küratörünüm. İçecek önerebilir, tatlı eşleştirebilir, alışkanlıklarını analiz edebilir veya her an için mükemmel seçimi bulabilirim. Ne dersin?`;
  };

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = { role: 'user', text };
    setMessages(m => [...m, userMsg]);
    setInput('');
    setTimeout(() => {
      const aiMsg: Msg = { role: 'ai', text: aiRespond(text) };
      setMessages(m => [...m, aiMsg]);
    }, 700);
  };

  const handleSuggestion = (suggestionId: string) => {
    const s = AI_SUGGESTIONS.find(x => x.id === suggestionId);
    if (!s) return;
    const product = products.find(p => p.id === s.product);
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
            <Text className="text-[11px] text-green-600">Senin kişisel kahve küratörün</Text>
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

          {messages.length <= 4 && (
            <View className="gap-2 pt-2">
              <Text className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide">Akıllı öneriler</Text>
              {AI_SUGGESTIONS.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => handleSuggestion(s.id)}
                  className="p-3 rounded-2xl border border-ex-red/20 bg-red-50 active:opacity-80"
                >
                  <View className="flex-row items-start gap-2">
                    <Sparkles size={14} color="#C8102E" />
                    <View className="flex-1">
                      <Text className="text-xs text-ink-700 leading-relaxed">{s.text}</Text>
                      <Text className="text-[10px] text-ex-red mt-1 font-medium">%{s.confidence} eşleşme · Sipariş etmek için dokun</Text>
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
          className="h-11 w-11 rounded-2xl bg-ex-red items-center justify-center shrink-0 shadow-red active:scale-105"
        >
          <Send size={17} color="#fff" />
        </Pressable>
      </View>
    </Sheet>
  );
}
