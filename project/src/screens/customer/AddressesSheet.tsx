import { useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TextInput, FormField } from '@/components/ui/Modal';
import { fetchAddresses, saveAddress, deleteAddress, type CustomerAddress } from '@/services/profile/addressService';

export function AddressesSheet() {
  const { sheet, closeSheet, showToast } = useApp();
  const open = sheet === 'addresses';
  const [rows, setRows] = useState<CustomerAddress[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [label, setLabel] = useState('Ev');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');

  const reload = async () => {
    setLoading(true);
    const { data, error } = await fetchAddresses();
    setLoading(false);
    if (error) showToast('Adresler yüklenemedi');
    else setRows(data);
  };

  useEffect(() => {
    if (open) void reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on sheet open only
  }, [open]);

  const submit = async () => {
    if (!line1.trim() || !city.trim()) { showToast('Adres ve şehir gerekli'); return; }
    const { error } = await saveAddress({ label, line1, line2: '', city, district: '', postal_code: '', is_default: rows.length === 0 });
    if (error) showToast('Kayıt başarısız');
    else { showToast('Adres kaydedildi'); setFormOpen(false); setLine1(''); setCity(''); void reload(); }
  };

  return (
    <Sheet open={open} onClose={closeSheet} title="Kayıtlı adresler">
      {loading ? <Text className="text-sm text-ink-400 py-8 text-center">Yükleniyor…</Text> : (
        <View className="gap-3">
          {rows.map(a => (
            <View key={a.id} className="flex-row gap-3 p-3 rounded-2xl border border-ink-100 bg-white">
              <MapPin size={18} color="#C8102E" />
              <View className="flex-1">
                <Text className="text-sm font-semibold text-ink-900">{a.label}</Text>
                <Text className="text-xs text-ink-500">{a.line1}, {a.city}</Text>
              </View>
              <Pressable onPress={() => void deleteAddress(a.id).then(() => reload())} hitSlop={8}>
                <Trash2 size={16} color="#C4C4CC" />
              </Pressable>
            </View>
          ))}
          {formOpen ? (
            <View className="gap-3 p-3 rounded-2xl bg-cream-50 border border-cream-200">
              <FormField label="Etiket"><TextInput value={label} onChangeText={setLabel} placeholder="Ev, İş…" /></FormField>
              <FormField label="Adres"><TextInput value={line1} onChangeText={setLine1} placeholder="Sokak, bina no" /></FormField>
              <FormField label="Şehir"><TextInput value={city} onChangeText={setCity} placeholder="İstanbul" /></FormField>
              <Button variant="gold" full onPress={() => void submit()}>Kaydet</Button>
            </View>
          ) : (
            <Pressable onPress={() => setFormOpen(true)} className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-ink-200">
              <Plus size={16} color="#C8102E" />
              <Text className="text-sm font-semibold text-ex-red">Yeni adres ekle</Text>
            </Pressable>
          )}
        </View>
      )}
    </Sheet>
  );
}
