import { useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput as RNTextInput } from 'react-native';
import { Search, Users, Crown, TrendingDown, Cake, Star, Edit2, Trash2, Download, Ban, CheckCircle2 } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, FormField, TextInput, Select } from '@/components/ui/Modal';
import { useAdmin, type AdminCustomer } from '@/context/AdminContext';
import { cn, tierColor } from '@/lib/utils';

const segments = [
  { id: 'all', label: 'Tüm müşteriler', icon: Users },
  { id: 'vip', label: 'VIP müşteriler', icon: Crown },
  { id: 'mvp', label: 'En değerli', icon: Star },
  { id: 'inactive', label: 'Pasif', icon: TrendingDown },
  { id: 'birthday', label: 'Bu ay doğum günü', icon: Cake },
  { id: 'repeat', label: 'Tekrar eden', icon: Users },
];

const statusColors: Record<string, string> = {
  vip: 'bg-red-50 text-ex-red',
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-ink-100 text-ink-500',
};
const statusLabels: Record<string, string> = { vip: 'VIP', active: 'Aktif', inactive: 'Pasif' };

const tierOptions = ['Bronz', 'Gümüş', 'Altın', 'Siyah', 'VIP'].map(t => ({ label: t, value: t }));
const statusOptions = [
  { label: 'Aktif', value: 'active' },
  { label: 'VIP', value: 'vip' },
  { label: 'Pasif', value: 'inactive' },
];

export function AdminCustomers() {
  const { customers, updateCustomer, deleteCustomer, blockCustomer } = useAdmin();
  const [seg, setSeg] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<{ id: string; block: boolean } | null>(null);
  const [form, setForm] = useState<AdminCustomer | null>(null);

  const counts = (id: string) => id === 'all' ? customers.length
    : id === 'vip' ? customers.filter(c => c.status === 'vip').length
    : id === 'mvp' ? customers.filter(c => c.segment === 'En Değerli').length
    : id === 'inactive' ? customers.filter(c => c.status === 'inactive').length
    : id === 'birthday' ? customers.filter(c => c.segment === 'Bu Ay Doğum Günü').length
    : id === 'repeat' ? customers.filter(c => c.segment === 'Tekrar Eden').length : 0;

  const filtered = customers.filter(c => {
    if (seg === 'vip' && c.status !== 'vip') return false;
    if (seg === 'mvp' && c.segment !== 'En Değerli') return false;
    if (seg === 'inactive' && c.status !== 'inactive') return false;
    if (seg === 'birthday' && c.segment !== 'Bu Ay Doğum Günü') return false;
    if (seg === 'repeat' && c.segment !== 'Tekrar Eden') return false;
    if (query && !c.name.toLowerCase().includes(query.toLowerCase()) && !c.email.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const openEdit = (c: AdminCustomer) => { setForm({ ...c }); setEditing(c); };
  const closeForm = () => { setEditing(null); setForm(null); };
  const save = () => {
    if (editing && form) updateCustomer(editing.id, form);
    closeForm();
  };

  return (
    <View className="max-w-4xl w-full mx-auto gap-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3">
        {segments.map(s => (
          <Pressable
            key={s.id}
            onPress={() => setSeg(s.id)}
            className={cn(
              'shrink-0 p-3 rounded-2xl border w-28',
              seg === s.id ? 'border-ex-red bg-red-50' : 'border-ink-100 bg-white',
            )}
          >
            <s.icon size={18} color={seg === s.id ? '#C8102E' : '#9494A0'} />
            <Text className="text-lg font-semibold text-ink-900 mt-1.5 leading-none">{counts(s.id)}</Text>
            <Text className="text-[10px] text-ink-400 mt-1">{s.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="flex-row gap-3">
        <View className="flex-1 flex-row items-center gap-3 px-4 py-3 rounded-2xl bg-white border border-ink-100">
          <Search size={18} color="#9494A0" />
          <RNTextInput value={query} onChangeText={setQuery} placeholder="Müşteri ara…" placeholderTextColor="#9494A0" className="flex-1 text-sm text-ink-900" />
        </View>
        <Button variant="outline"><Download size={16} /> Dışa Aktar</Button>
      </View>

      <Card className="p-0 overflow-hidden">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View>
            <View className="flex-row border-b border-ink-100">
              {['Müşteri', 'Seviye', 'Sipariş', 'Harcama', 'Son giriş', 'Durum', ''].map(h => (
                <View key={h} className="px-4 py-3 min-w-[90px]">
                  <Text className="text-[11px] font-semibold text-ink-400 uppercase tracking-wide">{h}</Text>
                </View>
              ))}
            </View>
            {filtered.map(c => (
              <View key={c.id} className="flex-row border-b border-ink-100 items-center">
                <View className="px-4 py-3.5 min-w-[120px]">
                  <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{c.name}</Text>
                  <Text className="text-[11px] text-ink-400" numberOfLines={1}>{c.email}</Text>
                </View>
                <View className="px-4 py-3.5 min-w-[80px]">
                  <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: `${tierColor(c.tier)}20` }}>
                    <Crown size={10} color={tierColor(c.tier)} />
                    <Text className="text-[10px] font-bold" style={{ color: tierColor(c.tier) }}>{c.tier}</Text>
                  </View>
                </View>
                <View className="px-4 py-3.5 min-w-[60px]"><Text className="text-xs text-ink-600">{c.orders}</Text></View>
                <View className="px-4 py-3.5 min-w-[80px]"><Text className="text-sm font-semibold text-ex-red">₺{c.spent.toLocaleString('tr-TR')}</Text></View>
                <View className="px-4 py-3.5 min-w-[90px]"><Text className="text-xs text-ink-500">{c.last_sign_in_at ? new Date(c.last_sign_in_at).toLocaleDateString('tr-TR') : 'Yok'}</Text></View>
                <View className="px-4 py-3.5 min-w-[70px]"><View className={cn('px-2 py-0.5 rounded-full', statusColors[c.status])}><Text className="text-[10px] font-bold uppercase">{statusLabels[c.status]}</Text></View></View>
                <View className="px-4 py-3.5 min-w-[90px] flex-row items-center gap-1.5">
                  <Pressable onPress={() => openEdit(c)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center"><Edit2 size={13} color="#6E6E78" /></Pressable>
                  <Pressable onPress={() => setConfirmBlock({ id: c.id, block: !c.is_blocked })} className="h-7 w-7 rounded-lg items-center justify-center">
                    {c.is_blocked ? <CheckCircle2 size={13} color="#16a34a" /> : <Ban size={13} color="#d97706" />}
                  </Pressable>
                  <Pressable onPress={() => setConfirmDelete(c.id)} className="h-7 w-7 rounded-lg items-center justify-center"><Trash2 size={13} color="#C8102E" /></Pressable>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </Card>

      {filtered.length === 0 && (
        <View className="py-16 items-center">
          <Users size={40} color="#E0E0E4" />
          <Text className="text-xl text-ink-400 mt-3">Müşteri bulunamadı</Text>
        </View>
      )}

      <Modal open={!!editing} onClose={closeForm} title="Müşteriyi Düzenle">
        {form && (
          <View className="gap-4">
            <View className="flex-row items-center gap-3 p-3 rounded-xl bg-ink-50">
              <View className="h-12 w-12 rounded-2xl bg-ex-red items-center justify-center"><Text className="text-lg font-bold text-white">{form.name.charAt(0)}</Text></View>
              <View><Text className="text-sm font-semibold text-ink-900">{form.name}</Text><Text className="text-xs text-ink-400">{form.email}</Text></View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Seviye"><Select value={form.tier} onValueChange={v => setForm({ ...form, tier: v })} options={tierOptions} /></FormField></View>
              <View className="flex-1"><FormField label="Durum"><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as AdminCustomer['status'] })} options={statusOptions} /></FormField></View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Segment"><TextInput value={form.segment} onChangeText={v => setForm({ ...form, segment: v })} /></FormField></View>
              <View className="flex-1"><FormField label="Son sipariş"><TextInput value={form.lastOrder} onChangeText={v => setForm({ ...form, lastOrder: v })} /></FormField></View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Toplam sipariş"><TextInput value={String(form.orders)} onChangeText={v => setForm({ ...form, orders: Number(v) || 0 })} keyboardType="numeric" /></FormField></View>
              <View className="flex-1"><FormField label="Harcama (₺)"><TextInput value={String(form.spent)} onChangeText={v => setForm({ ...form, spent: Number(v) || 0 })} keyboardType="numeric" /></FormField></View>
            </View>
            <View className="flex-row gap-3 pt-2">
              <Button variant="outline" full onPress={closeForm}>Vazgeç</Button>
              <Button variant="gold" full onPress={save}>Kaydet</Button>
            </View>
          </View>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && deleteCustomer(confirmDelete)} title="Müşteriyi sil" message="Bu müşteriyi silmek istediğine emin misin? Bu işlem geri alınamaz." />
      <ConfirmDialog open={!!confirmBlock} onClose={() => setConfirmBlock(null)} onConfirm={() => confirmBlock && blockCustomer(confirmBlock.id, confirmBlock.block)} title={confirmBlock?.block ? 'Müşteriyi engelle' : 'Engeli kaldır'} message={confirmBlock?.block ? 'Bu müşteri engellenecek ve uygulamaya giriş yapamayacak.' : 'Bu müşterinin engeli kaldırılacak.'} confirmLabel={confirmBlock?.block ? 'Engelle' : 'Engeli kaldır'} />
    </View>
  );
}
