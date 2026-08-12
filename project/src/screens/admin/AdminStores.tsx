import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus, MapPin, Clock, Wifi, Car, Coffee, Edit2, Trash2, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button, ButtonRow } from '@/components/ui/Button';
import { ConfirmDialog, FormField, TextInput, Toggle } from '@/components/ui/Modal';
import { useAdmin, genId } from '@/context/AdminContext';
import { cn } from '@/lib/utils';
import type { Store } from '@/lib/supabase';

type StoreForm = Store & { distance?: number };

const blankStore = (): StoreForm => ({
  id: genId('s'), name: '', address: '', lat: 41.05, lng: 29.0, open: true, hours: '07:00 – 22:00',
  busy: 'moderate', amenities: ['WiFi'], drive_thru: false, wifi: true, parking: false, image_url: '',
  phone: '', whatsapp: '', franchise_id: null,
});

export function AdminStores() {
  const { stores, addStore, updateStore, deleteStore } = useAdmin();
  const [editing, setEditing] = useState<Store | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<StoreForm>(blankStore());

  const openCreate = () => { setForm(blankStore()); setCreating(true); };
  const openEdit = (s: Store) => { setForm({ ...s, distance: undefined }); setEditing(s); };
  const closeForm = () => { setEditing(null); setCreating(false); };
  const save = () => {
    if (!form.name.trim()) return;
    if (creating) addStore(form); else if (editing) updateStore(editing.id, form);
    closeForm();
  };
  const set = <K extends keyof StoreForm>(k: K, v: StoreForm[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row justify-end">
        <Button variant="gold" onPress={openCreate}><Plus size={16} color="#fff" /> Mağaza ekle</Button>
      </View>

      {(creating || editing) && (
        <Card className="p-5 border-ex-red/20 gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-ink-900">
              {creating ? 'Yeni Mağaza' : 'Mağazayı Düzenle'}
            </Text>
            <Pressable onPress={closeForm} hitSlop={8}><X size={20} color="#9494A0" /></Pressable>
          </View>
          <FormField label="Mağaza adı"><TextInput value={form.name} onChangeText={v => set('name', v)} placeholder="Örn. Levent Mağaza" /></FormField>
          <FormField label="Adres"><TextInput value={form.address} onChangeText={v => set('address', v)} placeholder="Cadde, No, İlçe, Şehir" /></FormField>
          <View className="flex-row gap-3 flex-wrap">
            <View className="flex-1 min-w-[140px]"><FormField label="Çalışma saatleri"><TextInput value={form.hours} onChangeText={v => set('hours', v)} placeholder="07:00 – 22:00" /></FormField></View>
            <View className="flex-1 min-w-[100px]"><FormField label="Enlem"><TextInput value={String(form.lat)} onChangeText={v => set('lat', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
            <View className="flex-1 min-w-[100px]"><FormField label="Boylam"><TextInput value={String(form.lng)} onChangeText={v => set('lng', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
          </View>
          <FormField label="Yoğunluk">
            <View className="flex-row gap-2">
              {([
                { label: 'Sakin', value: 'quiet' },
                { label: 'Orta', value: 'moderate' },
                { label: 'Yoğun', value: 'busy' },
              ] as const).map(opt => (
                <Pressable
                  key={opt.value}
                  onPress={() => set('busy', opt.value)}
                  className={cn(
                    'px-4 py-2.5 rounded-xl border',
                    form.busy === opt.value ? 'border-ex-red bg-ex-red/5' : 'border-ink-200 bg-cream-50',
                  )}
                >
                  <Text className={cn('text-sm', form.busy === opt.value ? 'text-ex-red font-semibold' : 'text-ink-700')}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </FormField>
          <View className="flex-row gap-3 flex-wrap">
            <View className="flex-1 min-w-[140px]"><FormField label="Telefon"><TextInput value={form.phone ?? ''} onChangeText={v => set('phone', v)} placeholder="+90 212 ..." /></FormField></View>
            <View className="flex-1 min-w-[140px]"><FormField label="WhatsApp"><TextInput value={form.whatsapp ?? ''} onChangeText={v => set('whatsapp', v)} placeholder="+90 532 ..." /></FormField></View>
          </View>
          <View className="flex-row flex-wrap gap-6">
            <Toggle checked={form.open} onChange={v => set('open', v)} label="Açık" />
            <Toggle checked={form.wifi} onChange={v => set('wifi', v)} label="WiFi" />
            <Toggle checked={form.parking} onChange={v => set('parking', v)} label="Otopark" />
            <Toggle checked={form.drive_thru} onChange={v => set('drive_thru', v)} label="Drive-thru" />
          </View>
          <ButtonRow className="pt-2">
            <Button variant="outline" flex onPress={closeForm}>Vazgeç</Button>
            <Button variant="gold" flex onPress={save} disabled={!form.name.trim()}>Kaydet</Button>
          </ButtonRow>
        </Card>
      )}

      <View className="flex-row flex-wrap gap-4">
        {stores.map(store => (
          <View key={store.id} className="w-full sm:w-[48%]">
            <Card className="p-5">
              <View className="flex-row items-start justify-between mb-3">
                <View>
                  <Text className="text-lg font-semibold text-ink-900">{store.name}</Text>
                  <View className="flex-row items-center gap-1 mt-0.5"><MapPin size={11} color="#9494A0" /><Text className="text-xs text-ink-500"> {store.address}</Text></View>
                </View>
                <View className="flex-row items-center gap-2">
                  <Pressable onPress={() => updateStore(store.id, { open: !store.open })}>
                    <Text className={cn(
                      'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase',
                      store.open ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700',
                    )}>{store.open ? 'Açık' : 'Kapalı'}</Text>
                  </Pressable>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-3 mb-3">
                <View className="flex-row items-center gap-1.5"><Clock size={13} color="#C8102E" /><Text className="text-xs text-ink-500"> {store.hours}</Text></View>
                <View className="flex-row items-center gap-1.5"><MapPin size={13} color="#C8102E" /><Text className="text-xs text-ink-500"> {store.lat.toFixed(2)}, {store.lng.toFixed(2)}</Text></View>
              </View>
              <View className="mb-3">
                <Text className="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-1.5">Yoğunluk</Text>
                <View className="flex-row gap-1">
                  {[0, 1, 2].map(i => (
                    <View key={i} className={cn(
                      'h-1.5 flex-1 rounded-full',
                      store.busy === 'quiet' && i < 1 ? 'bg-green-500' :
                      store.busy === 'moderate' && i < 2 ? 'bg-ex-red' :
                      store.busy === 'busy' ? 'bg-red-500' : 'bg-ink-200',
                    )} />
                  ))}
                </View>
              </View>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {store.wifi && <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-ink-100"><Wifi size={10} color="#6E6E78" /><Text className="text-[10px] text-ink-500"> WiFi</Text></View>}
                {store.parking && <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-ink-100"><Car size={10} color="#6E6E78" /><Text className="text-[10px] text-ink-500"> Otopark</Text></View>}
                {store.drive_thru && <View className="flex-row items-center gap-1 px-2 py-1 rounded-full bg-ink-100"><Coffee size={10} color="#6E6E78" /><Text className="text-[10px] text-ink-500"> Drive-thru</Text></View>}
              </View>
              <View className="flex-row gap-2 pt-3 border-t border-ink-100">
                <Button variant="outline" size="sm" full onPress={() => openEdit(store)}><Edit2 size={13} color="#C8102E" /> Düzenle</Button>
                <Button variant="ghost" size="sm" onPress={() => setConfirmDelete(store.id)}><Trash2 size={14} color="#E11D38" /></Button>
              </View>
            </Card>
          </View>
        ))}
      </View>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && deleteStore(confirmDelete)} title="Mağazayı sil" message="Bu mağazayı silmek istediğine emin misin?" />
    </View>
  );
}
