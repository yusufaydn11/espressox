import { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import { Plus, Mail, Phone, Clock, Edit2, Trash2, UserCog } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, FormField, TextInput, Select } from '@/components/ui/Modal';
import { useAdmin, genId } from '@/context/AdminContext';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  break: 'bg-red-50 text-ex-red',
  off: 'bg-ink-100 text-ink-500',
};
const statusLabels: Record<string, string> = { active: 'Vardiyada', break: 'Mola', off: 'İzinli' };

const defaultAvatar = 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=200';

const blankEmployee = (): Employee => ({
  id: genId('e'), name: '', role: 'Barista', store: '', status: 'active', avatar: defaultAvatar, shift: '08:00 – 16:00',
});

export function AdminEmployees() {
  const { employees, addEmployee, updateEmployee, deleteEmployee, stores } = useAdmin();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Employee>(blankEmployee());

  const openCreate = () => { setForm(blankEmployee()); setCreating(true); };
  const openEdit = (e: Employee) => { setForm({ ...e }); setEditing(e); };
  const closeForm = () => { setEditing(null); setCreating(false); };
  const save = () => {
    if (!form.name.trim()) return;
    if (creating) addEmployee(form); else if (editing) updateEmployee(editing.id, form);
    closeForm();
  };
  const set = <K extends keyof Employee>(k: K, v: Employee[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[160px]"><StatBox label="Toplam personel" value={String(employees.length)} /></View>
        <View className="flex-1 min-w-[160px]"><StatBox label="Vardiyada" value={String(employees.filter(e => e.status === 'active').length)} /></View>
        <View className="flex-1 min-w-[160px]"><StatBox label="Molada" value={String(employees.filter(e => e.status === 'break').length)} /></View>
        <View className="flex-1 min-w-[160px]"><StatBox label="İzinli" value={String(employees.filter(e => e.status === 'off').length)} /></View>
      </View>

      <View className="flex-row justify-end">
        <Button variant="gold" onPress={openCreate}><Plus size={16} color="#fff" /> Personel ekle</Button>
      </View>

      <View className="flex-row flex-wrap gap-4">
        {employees.map(emp => (
          <Card key={emp.id} className="p-5 w-full sm:w-[48%] lg:w-[32%]">
            <View className="flex-row items-start gap-3">
              <Image source={{ uri: emp.avatar }} className="h-14 w-14 rounded-2xl shrink-0" resizeMode="cover" />
              <View className="flex-1 min-w-0">
                <Text className="text-sm font-semibold text-ink-900" numberOfLines={1}>{emp.name}</Text>
                <Text className="text-xs text-ex-red mt-0.5">{emp.role}</Text>
                <View className="flex-row items-center gap-1 mt-1">
                  <View className="h-2.5 w-2.5 rounded-full bg-ex-red" />
                  <Text className="text-[11px] text-ink-500" numberOfLines={1}> {emp.store}</Text>
                </View>
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-ink-100">
              <View>
                <Pressable onPress={() => {
                  const next: Record<string, Employee['status']> = { active: 'break', break: 'off', off: 'active' };
                  updateEmployee(emp.id, { status: next[emp.status] });
                }}>
                  <Text className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase', statusColors[emp.status])}>{statusLabels[emp.status]}</Text>
                </Pressable>
                <View className="flex-row items-center gap-1 mt-1.5"><Clock size={11} color="#9494A0" /><Text className="text-[11px] text-ink-400"> {emp.shift}</Text></View>
              </View>
              <View className="flex-row gap-1.5">
                <View className="h-8 w-8 rounded-xl bg-ink-100 items-center justify-center"><Mail size={14} color="#6E6E78" /></View>
                <View className="h-8 w-8 rounded-xl bg-ink-100 items-center justify-center"><Phone size={14} color="#6E6E78" /></View>
                <Pressable onPress={() => openEdit(emp)} className="h-8 w-8 rounded-xl bg-ink-100 items-center justify-center active:bg-ink-200"><Edit2 size={14} color="#6E6E78" /></Pressable>
                <Pressable onPress={() => setConfirmDelete(emp.id)} className="h-8 w-8 rounded-xl items-center justify-center active:bg-red-50"><Trash2 size={14} color="#E11D38" /></Pressable>
              </View>
            </View>
          </Card>
        ))}
      </View>

      {employees.length === 0 && (
        <View className="py-16 items-center">
          <UserCog size={40} color="#E0E0E4" />
          <Text className="text-xl text-ink-400 mt-3">Personel bulunamadı</Text>
        </View>
      )}

      <Modal open={creating || !!editing} onClose={closeForm} title={creating ? 'Yeni Personel' : 'Personeli Düzenle'}>
        <View className="gap-4">
          <FormField label="Ad Soyad"><TextInput value={form.name} onChangeText={v => set('name', v)} placeholder="Örn. Ahmet Yılmaz" /></FormField>
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField label="Görev">
              <Select value={form.role} onValueChange={v => set('role', v)} options={['Mağaza Müdürü', 'Baş Barista', 'Barista', 'Vardiya Lideri', 'Kasiyer', 'Servis Personeli'].map(r => ({ label: r, value: r }))} />
            </FormField></View>
            <View className="flex-1"><FormField label="Durum">
              <Select value={form.status} onValueChange={v => set('status', v as Employee['status'])} options={[
                { label: 'Vardiyada', value: 'active' },
                { label: 'Mola', value: 'break' },
                { label: 'İzinli', value: 'off' },
              ]} />
            </FormField></View>
          </View>
          <FormField label="Mağaza">
            <Select value={form.store} onValueChange={v => set('store', v)} options={[{ label: 'Seçiniz', value: '' }, ...stores.map(s => ({ label: s.name, value: s.name }))]} />
          </FormField>
          <FormField label="Vardiya saatleri"><TextInput value={form.shift} onChangeText={v => set('shift', v)} placeholder="08:00 – 16:00" /></FormField>
          <FormField label="Avatar URL"><TextInput value={form.avatar} onChangeText={v => set('avatar', v)} placeholder="https://…" /></FormField>
          <View className="flex-row gap-3 pt-2">
            <Button variant="outline" full onPress={closeForm}>Vazgeç</Button>
            <Button variant="gold" full onPress={save} disabled={!form.name.trim()}>Kaydet</Button>
          </View>
        </View>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && deleteEmployee(confirmDelete)} title="Personeli sil" message="Bu personeli silmek istediğine emin misin?" />
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <Text className="text-2xl font-semibold text-ink-900 leading-none">{value}</Text>
      <Text className="text-xs text-ink-400 mt-1.5">{label}</Text>
    </Card>
  );
}
