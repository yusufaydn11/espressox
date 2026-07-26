import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput as RNTextInput } from 'react-native';
import { Search, Coffee, UtensilsCrossed, Store as StoreIcon, CalendarClock, Edit2, Trash2 } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, FormField, Select } from '@/components/ui/Modal';
import { useAdmin, type AdminOrder } from '@/context/AdminContext';
import { cn } from '@/lib/utils';

const typeIcons: Record<string, typeof Coffee> = { pickup: StoreIcon, table: UtensilsCrossed, delivery: Coffee, scheduled: CalendarClock };
const typeLabels: Record<string, string> = { pickup: 'Gel-Al', table: 'Masa', delivery: 'Teslimat', scheduled: 'Planlı' };

const orderStatuses = ['Hazırlanıyor', 'Hazır', 'Teslim Edildi', 'Teslim Alındı', 'İptal Edildi'];

const statusColors: Record<string, string> = {
  'Hazırlanıyor': 'bg-red-50 text-ex-red',
  'Hazır': 'bg-green-100 text-green-700',
  'Teslim Edildi': 'bg-ink-100 text-ink-500',
  'Teslim Alındı': 'bg-ink-100 text-ink-500',
  'İptal Edildi': 'bg-red-100 text-ex-red',
};

const filterMap: Record<string, string> = { all: 'Tümü', preparing: 'Hazırlanıyor', ready: 'Hazır', delivered: 'Teslim Edildi' };
const statusToFilter: Record<string, string> = {
  'Hazırlanıyor': 'preparing', 'Hazır': 'ready',
  'Teslim Edildi': 'delivered', 'Teslim Alındı': 'delivered',
};

export function AdminOrders() {
  const { orders, updateOrder, deleteOrder } = useAdmin();
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminOrder | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [statusField, setStatusField] = useState('');

  const filters = ['all', 'preparing', 'ready', 'delivered'];

  const filtered = orders.filter(o => {
    if (filter !== 'all' && statusToFilter[o.status] !== filter) return false;
    if (query && !o.customer.toLowerCase().includes(query.toLowerCase()) && !o.id.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const openEdit = (o: AdminOrder) => { setEditing(o); setStatusField(o.status); };
  const saveEdit = () => {
    if (editing) updateOrder(editing.id, { status: statusField });
    setEditing(null);
  };

  return (
    <View className="max-w-4xl w-full mx-auto gap-4">
      <View className="flex-row gap-3">
        <View className="flex-1 flex-row items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-ink-100">
          <Search size={18} color="#9494A0" />
          <RNTextInput value={query} onChangeText={setQuery} placeholder="Sipariş ID veya müşteri ara…" placeholderTextColor="#9494A0" className="flex-1 text-sm text-ink-900" />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {filters.map(f => (
          <Pressable key={f} onPress={() => setFilter(f)} className={cn(
            'px-4 py-2.5 rounded-2xl border',
            filter === f ? 'bg-ink-900 border-ink-900' : 'bg-white border-ink-100',
          )}>
            <Text className={cn('text-xs font-medium', filter === f ? 'text-white' : 'text-ink-700')}>{filterMap[f]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Card className="p-0 overflow-hidden">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View className="flex-row border-b border-ink-100 px-2">
              {['Sipariş', 'Müşteri', 'Tür', 'Mağaza', 'Adet', 'Toplam', 'Durum', 'Saat', ''].map(h => (
                <View key={h} className="px-3 py-3 min-w-[80px]">
                  <Text className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">{h}</Text>
                </View>
              ))}
            </View>
            {filtered.map(o => {
              const Icon = typeIcons[o.type] ?? Coffee;
              return (
                <View key={o.id} className="flex-row border-b border-ink-100 px-2 items-center">
                  <View className="px-3 py-3.5 min-w-[80px]"><Text className="text-xs font-semibold text-ink-900">{o.id}</Text></View>
                  <View className="px-3 py-3.5 min-w-[100px]"><Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{o.customer}</Text></View>
                  <View className="px-3 py-3.5 min-w-[80px]"><View className="flex-row items-center gap-1.5"><Icon size={13} color="#3D3D42" /><Text className="text-xs text-ink-700">{typeLabels[o.type] ?? o.type}</Text></View></View>
                  <View className="px-3 py-3.5 min-w-[80px]"><Text className="text-xs text-ink-500" numberOfLines={1}>{o.store}</Text></View>
                  <View className="px-3 py-3.5 min-w-[50px]"><Text className="text-xs text-ink-700">{o.items}</Text></View>
                  <View className="px-3 py-3.5 min-w-[70px]"><Text className="text-sm font-semibold text-ex-red">₺{o.total}</Text></View>
                  <View className="px-3 py-3.5 min-w-[100px]"><View className={cn('px-2.5 py-1 rounded-full', statusColors[o.status] ?? 'bg-ink-100')}><Text className={cn('text-[10px] font-bold uppercase', statusColors[o.status]?.includes('ex-red') ? 'text-ex-red' : statusColors[o.status]?.includes('green') ? 'text-green-700' : 'text-ink-500')}>{o.status}</Text></View></View>
                  <View className="px-3 py-3.5 min-w-[60px]"><Text className="text-xs text-ink-400">{o.time}</Text></View>
                  <View className="px-3 py-3.5 min-w-[70px] flex-row items-center gap-1.5">
                    <Pressable onPress={() => openEdit(o)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center"><Edit2 size={13} color="#6E6E78" /></Pressable>
                    <Pressable onPress={() => setConfirmDelete(o.id)} className="h-7 w-7 rounded-lg items-center justify-center"><Trash2 size={13} color="#C8102E" /></Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </Card>

      <Text className="text-xs text-ink-400">{orders.length} siparişin {filtered.length} tanesi gösteriliyor</Text>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Sipariş durumunu güncelle">
        {editing && (
          <View className="gap-4">
            <View className="p-3 rounded-xl bg-cream-100">
              <Text className="text-xs text-ink-400">Sipariş</Text>
              <Text className="text-sm font-semibold text-ink-900">{editing.id} — {editing.customer}</Text>
              <Text className="text-xs text-ink-500 mt-1">{editing.items} ürün · ₺{editing.total} · {editing.store}</Text>
            </View>
            <FormField label="Durum">
              <Select value={statusField} onValueChange={setStatusField} options={orderStatuses.map(s => ({ label: s, value: s }))} />
            </FormField>
            <View className="flex-row gap-3">
              <Button variant="outline" full onPress={() => setEditing(null)}>Vazgeç</Button>
              <Button variant="gold" full onPress={saveEdit}>Kaydet</Button>
            </View>
          </View>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && deleteOrder(confirmDelete)}
        title="Siparişi sil"
        message="Bu siparişi silmek istediğine emin misin?"
      />
    </View>
  );
}
