import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus, Megaphone, Mail, MessageSquare, Cake, MapPin, Edit2, Trash2, TrendingUp, Users, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button, ButtonRow } from '@/components/ui/Button';
import { Modal, ConfirmDialog, FormField, TextInput, Select } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/Charts';
import { useAdmin, genId, type CampaignRow } from '@/context/AdminContext';
import { cn } from '@/lib/utils';

type Campaign = CampaignRow & { start?: string };

const typeIcons: Record<string, typeof Megaphone> = { push: Megaphone, email: Mail, sms: MessageSquare, birthday: Cake, location: MapPin };
const typeLabels: Record<string, string> = { push: 'Bildirim', email: 'E-posta', sms: 'SMS', birthday: 'Doğum Günü', location: 'Konum' };

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  scheduled: 'bg-blue-100 text-blue-700',
  draft: 'bg-ink-100 text-ink-500',
  ended: 'bg-ink-100 text-ink-400',
};
const statusLabels: Record<string, string> = { active: 'Aktif', scheduled: 'Planlandı', draft: 'Taslak', ended: 'Bitti' };

const typeOptions = [
  { label: 'Bildirim', value: 'push' }, { label: 'E-posta', value: 'email' },
  { label: 'SMS', value: 'sms' }, { label: 'Doğum Günü', value: 'birthday' }, { label: 'Konum', value: 'location' },
];
const statusOptions = [
  { label: 'Taslak', value: 'draft' }, { label: 'Aktif', value: 'active' },
  { label: 'Planlandı', value: 'scheduled' }, { label: 'Bitti', value: 'ended' },
];

const blankCampaign = (): Campaign => ({
  id: genId('cm'), name: '', type: 'push', status: 'draft', reach: 0, conversion: 0, revenue: 0,
  start: 'Bugün', title: '', message: '', target_segment: 'all', start_date: null, end_date: null,
  store_id: null, created_at: '', updated_at: '',
});

export function AdminCampaigns() {
  const { campaigns, addCampaign, updateCampaign, deleteCampaign } = useAdmin();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Campaign>(blankCampaign());

  const totalReach = campaigns.reduce((s, c) => s + c.reach, 0);
  const totalRevenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const avgConv = campaigns.length ? (campaigns.reduce((s, c) => s + c.conversion, 0) / campaigns.length).toFixed(1) : '0';

  const openCreate = () => { setForm(blankCampaign()); setCreating(true); };
  const openEdit = (c: Campaign) => { setForm({ ...c }); setEditing(c); };
  const closeForm = () => { setEditing(null); setCreating(false); };
  const save = () => {
    if (!form.name.trim()) return;
    if (creating) addCampaign(form); else if (editing) updateCampaign(editing.id, form);
    closeForm();
  };
  const set = <K extends keyof Campaign>(k: K, v: Campaign[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[160px]"><StatCard label="Toplam erişim" value={totalReach.toLocaleString('tr-TR')} icon={<Users size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Ort. dönüşüm" value={`%${avgConv}`} icon={<TrendingUp size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Kampanya cirosu" value={`₺${totalRevenue.toLocaleString('tr-TR')}`} icon={<DollarSign size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Aktif kampanya" value={String(campaigns.filter(c => c.status === 'active').length)} icon={<Megaphone size={18} color="#C8102E" />} /></View>
      </View>

      <View className="flex-row justify-end">
        <Button variant="gold" onPress={openCreate}><Plus size={16} /> Yeni kampanya</Button>
      </View>

      <View className="flex-row flex-wrap gap-4">
        {campaigns.map(c => {
          const Icon = typeIcons[c.type] ?? Megaphone;
          return (
            <View key={c.id} className="w-full sm:w-[48%]">
              <Card className="p-5">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-row items-center gap-3">
                    <View className="h-10 w-10 rounded-2xl bg-red-50 items-center justify-center"><Icon size={18} color="#C8102E" /></View>
                    <View>
                      <Text className="text-sm font-semibold text-ink-900">{c.name}</Text>
                      <Text className="text-[11px] text-ink-400">{typeLabels[c.type]} · {c.start_date ?? c.created_at}</Text>
                    </View>
                  </View>
                  <Pressable onPress={() => {
                    const next: Record<string, Campaign['status']> = { draft: 'active', active: 'ended', ended: 'scheduled', scheduled: 'active' };
                    updateCampaign(c.id, { status: next[c.status] });
                  }}>
                    <View className={cn('px-2.5 py-1 rounded-full', statusColors[c.status])}><Text className="text-[10px] font-bold uppercase">{statusLabels[c.status]}</Text></View>
                  </Pressable>
                </View>
                <View className="flex-row pt-3 border-t border-ink-100">
                  <View className="flex-1"><Text className="text-[10px] text-ink-400 uppercase">Erişim</Text><Text className="text-lg font-semibold text-ink-900 mt-1">{c.reach > 1000 ? `${(c.reach / 1000).toFixed(1)}b` : c.reach}</Text></View>
                  <View className="flex-1"><Text className="text-[10px] text-ink-400 uppercase">Dönüşüm</Text><Text className="text-lg font-semibold text-ink-900 mt-1">%{c.conversion}</Text></View>
                  <View className="flex-1"><Text className="text-[10px] text-ink-400 uppercase">Ciro</Text><Text className="text-lg font-semibold text-ex-red mt-1">₺{c.revenue.toLocaleString('tr-TR')}</Text></View>
                </View>
                <View className="flex-row gap-2 mt-3 pt-3 border-t border-ink-100">
                  <Button variant="outline" size="sm" full onPress={() => openEdit(c)}><Edit2 size={13} /> Düzenle</Button>
                  <Button variant="ghost" size="sm" onPress={() => setConfirmDelete(c.id)}><Trash2 size={14} /></Button>
                </View>
              </Card>
            </View>
          );
        })}
      </View>

      <Modal open={creating || !!editing} onClose={closeForm} title={creating ? 'Yeni Kampanya' : 'Kampanyayı Düzenle'}>
        <View className="gap-4">
          <FormField label="Kampanya adı"><TextInput value={form.name} onChangeText={v => set('name', v)} placeholder="Örn. Kış Baharat Lansmanı" /></FormField>
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField label="Tür"><Select value={form.type} onValueChange={v => set('type', v as Campaign['type'])} options={typeOptions} /></FormField></View>
            <View className="flex-1"><FormField label="Durum"><Select value={form.status} onValueChange={v => set('status', v)} options={statusOptions} /></FormField></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField label="Erişim"><TextInput value={String(form.reach)} onChangeText={v => set('reach', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
            <View className="flex-1"><FormField label="Dönüşüm (%)"><TextInput value={String(form.conversion)} onChangeText={v => set('conversion', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
            <View className="flex-1"><FormField label="Ciro (₺)"><TextInput value={String(form.revenue)} onChangeText={v => set('revenue', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
          </View>
          <FormField label="Başlangıç"><TextInput value={form.start ?? ''} onChangeText={v => set('start', v)} placeholder="Örn. 1 Eki" /></FormField>
          <ButtonRow className="pt-2">
            <Button variant="outline" flex onPress={closeForm}>Vazgeç</Button>
            <Button variant="gold" flex onPress={save} disabled={!form.name.trim()}>Kaydet</Button>
          </ButtonRow>
        </View>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && deleteCampaign(confirmDelete)} title="Kampanyayı sil" message="Bu kampanyayı silmek istediğine emin misin?" />
    </View>
  );
}
