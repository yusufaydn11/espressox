import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Bell, Mail, MessageSquare, Send, Users, Sparkles, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TextInput, TextArea } from '@/components/ui/Modal';
import { useAdmin } from '@/context/AdminContext';
import { cn } from '@/lib/utils';

export function AdminPush() {
  const { sendPushNotification, customers, totalCustomers } = useAdmin();
  const [channel, setChannel] = useState<'push' | 'email' | 'sms'>('push');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [segment, setSegment] = useState('all');
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const channels = [
    { id: 'push' as const, label: 'Bildirim', icon: Bell, desc: 'Anlık mobil bildirim' },
    { id: 'email' as const, label: 'E-posta', icon: Mail, desc: 'Zengin HTML kampanya' },
    { id: 'sms' as const, label: 'SMS', icon: MessageSquare, desc: 'Toplu SMS gönderimi' },
  ];

  const segments = [
    { id: 'all', label: 'Tüm müşteriler', count: totalCustomers.toLocaleString('tr-TR') },
    { id: 'vip', label: 'VIP üyeler', count: customers.filter(c => c.status === 'vip').length.toLocaleString('tr-TR') },
    { id: 'gold', label: 'Altın seviye', count: customers.filter(c => c.tier === 'Altın').length.toLocaleString('tr-TR') },
    { id: 'inactive', label: 'Pasif olmayan', count: customers.filter(c => !c.is_blocked).length.toLocaleString('tr-TR') },
    { id: 'birthday', label: 'Doğum günü ayı', count: '—' },
  ];

  const handleSend = async () => {
    if (!title || !body) return;
    setSending(true);
    try {
      if (channel === 'push') {
        await sendPushNotification(title, body, segment);
      }
      setSent(true);
      setTimeout(() => setSent(false), 3000);
      setTitle('');
      setBody('');
    } finally {
      setSending(false);
    }
  };

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      {/* Channel selector */}
      <View className="flex-row flex-wrap gap-3">
        {channels.map(c => (
          <Pressable
            key={c.id}
            onPress={() => setChannel(c.id)}
            className={cn(
              'flex-1 min-w-[100px] p-4 rounded-2xl border',
              channel === c.id ? 'border-ex-red bg-red-50' : 'border-ink-100 bg-white',
            )}
          >
            <c.icon size={20} color={channel === c.id ? '#C8102E' : '#6E6E78'} />
            <Text className="text-sm font-semibold text-ink-900 mt-2">{c.label}</Text>
            <Text className="text-[11px] text-ink-500">{c.desc}</Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-row flex-wrap gap-5">
        {/* Composer */}
        <View className="flex-[2] min-w-[280px]">
          <Card className="p-5">
            <View className="flex-row items-center gap-2 mb-4">
              <Send size={18} color="#C8102E" />
              <Text className="text-lg font-semibold text-ink-900">
                {channel === 'push' ? 'Bildirim oluştur' : channel === 'email' ? 'E-posta oluştur' : 'Mesaj oluştur'}
              </Text>
            </View>

            <View className="gap-4">
              <View>
                <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">Başlık / Konu</Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  placeholder={channel === 'sms' ? 'Gönderen adı' : 'Dikkat çekici başlık…'}
                />
              </View>
              <View>
                <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">Mesaj</Text>
                <TextArea
                  value={body}
                  onChangeText={setBody}
                  placeholder="Mesajını yaz…"
                />
                <Text className="text-[10px] text-ink-400 mt-1 self-end">{body.length} karakter</Text>
              </View>

              <View className="flex-row items-center gap-2 p-3 rounded-2xl bg-red-50">
                <Sparkles size={16} color="#C8102E" />
                <Text className="text-xs text-ex-red flex-1">AI önerisi: "Merhaba {`{name}`}, Rose Latte'n seni bekliyor — bugün 2x puan kazan!"</Text>
                <Button size="sm" variant="ghost" onPress={() => setBody('Merhaba {name}, Rose Latte\'n seni bekliyor — bugün 2x puan kazan!')}>Kullan</Button>
              </View>

              <Button variant="gold" size="lg" full onPress={handleSend} disabled={!title || !body || sending}>
                {sending ? <>{<Loader2 size={16} color="#fff" />} Gönderiliyor…</> : sent ? 'Başarıyla gönderildi!' : <>{segments.find(s => s.id === segment)?.count} alıcıya gönder {<Send size={16} color="#fff" />}</>}
              </Button>
            </View>
          </Card>
        </View>

        {/* Audience + preview */}
        <View className="flex-1 min-w-[200px] gap-5">
          <Card className="p-5">
            <View className="flex-row items-center gap-2 mb-3">
              <Users size={16} color="#C8102E" />
              <Text className="text-sm font-semibold text-ink-900">Hedef kitle</Text>
            </View>
            <View className="gap-2">
              {segments.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => setSegment(s.id)}
                  className={cn(
                    'w-full flex-row items-center justify-between px-3 py-2.5 rounded-xl border',
                    segment === s.id ? 'border-ex-red bg-red-50' : 'border-ink-100',
                  )}
                >
                  <Text className="text-sm text-ink-700">{s.label}</Text>
                  <Text className="text-xs text-ink-400">{s.count}</Text>
                </Pressable>
              ))}
            </View>
          </Card>

          {/* Preview */}
          <Card className="p-5">
            <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Önizleme</Text>
            <View className="p-3 rounded-2xl bg-ink-900">
              <View className="flex-row items-center gap-2 mb-1.5">
                <View className="h-6 w-6 rounded-lg bg-ex-red items-center justify-center"><Text className="text-[10px] font-bold text-white">X</Text></View>
                <Text className="text-[11px] font-semibold text-white">Espresso X</Text>
                <Text className="text-[10px] text-ink-500 ml-auto">şimdi</Text>
              </View>
              <Text className="text-sm font-semibold text-white">{title || 'Başlığın burada görünecek'}</Text>
              <Text className="text-xs text-white/70 mt-0.5">{body || 'Mesaj önizlemen burada görünecek.'}</Text>
            </View>
          </Card>
        </View>
      </View>
    </View>
  );
}
