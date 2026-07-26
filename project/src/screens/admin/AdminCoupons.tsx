import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Plus, Tag, Copy, Check, Calendar, Percent, Gift, Edit2, Trash2, TrendingUp } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, FormField, TextInput, Select } from '@/components/ui/Modal';
import { useAdmin, genId, type Coupon } from '@/context/AdminContext';
import { cn } from '@/lib/utils';

const typeIcons: Record<string, typeof Tag> = { percent: Percent, fixed: Tag, bogo: Gift, gift: Gift };
const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-ink-100 text-ink-400',
  scheduled: 'bg-blue-100 text-blue-700',
};
const statusLabels: Record<string, string> = { active: 'Aktif', expired: 'Süresi Doldu', scheduled: 'Planlandı' };

const blankCoupon = (): Coupon => ({
  id: genId('co'), code: '', title: '', type: 'percent', value: '%0', redeemed: 0, limit: 1000, expires: '30 gün', status: 'active',
});

export function AdminCoupons() {
  const { coupons, addCoupon, updateCoupon, deleteCoupon } = useAdmin();
  const [copied, setCopied] = useState<string | null>(null);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [form, setForm] = useState<Coupon>(blankCoupon());

  const totalRedeemed = coupons.reduce((s, c) => s + c.redeemed, 0);

  const copy = (code: string) => { setCopied(code); setTimeout(() => setCopied(null), 2000); };
  const openCreate = () => { setForm(blankCoupon()); setCreating(true); };
  const openEdit = (c: Coupon) => { setForm({ ...c }); setEditing(c); };
  const closeForm = () => { setEditing(null); setCreating(false); };
  const save = () => {
    if (!form.code.trim() || !form.title.trim()) return;
    if (creating) addCoupon(form); else if (editing) updateCoupon(editing.id, form);
    closeForm();
  };
  const set = <K extends keyof Coupon>(k: K, v: Coupon[K]) => setForm(f => ({ ...f, [k]: v }));

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[160px]">
          <Card className="p-4 flex-row items-center gap-3">
            <View className="h-10 w-10 rounded-2xl bg-red-50 items-center justify-center"><Tag size={18} color="#C8102E" /></View>
            <View><Text className="text-xl font-semibold text-ink-900 leading-none">{coupons.length}</Text><Text className="text-xs text-ink-400 mt-1">Toplam kupon</Text></View>
          </Card>
        </View>
        <View className="flex-1 min-w-[160px]">
          <Card className="p-4 flex-row items-center gap-3">
            <View className="h-10 w-10 rounded-2xl bg-red-50 items-center justify-center"><Tag size={18} color="#C8102E" /></View>
            <View><Text className="text-xl font-semibold text-ink-900 leading-none">{coupons.filter(c => c.status === 'active').length}</Text><Text className="text-xs text-ink-400 mt-1">Aktif</Text></View>
          </Card>
        </View>
        <View className="flex-1 min-w-[160px]">
          <Card className="p-4 flex-row items-center gap-3">
            <View className="h-10 w-10 rounded-2xl bg-red-50 items-center justify-center"><TrendingUp size={18} color="#C8102E" /></View>
            <View><Text className="text-xl font-semibold text-ink-900 leading-none">{totalRedeemed.toLocaleString('tr-TR')}</Text><Text className="text-xs text-ink-400 mt-1">Kullanılan</Text></View>
          </Card>
        </View>
        <View className="flex-1 min-w-[160px]">
          <Card className="p-4 flex-row items-center gap-3">
            <View className="h-10 w-10 rounded-2xl bg-red-50 items-center justify-center"><Percent size={18} color="#C8102E" /></View>
            <View><Text className="text-xl font-semibold text-ink-900 leading-none">%12,8</Text><Text className="text-xs text-ink-400 mt-1">Ort. dönüşüm</Text></View>
          </Card>
        </View>
      </View>

      <View className="flex-row justify-end">
        <Button variant="gold" onPress={openCreate}><Plus size={16} color="#fff" /> Kupon oluştur</Button>
      </View>

      <View className="flex-row flex-wrap gap-4">
        {coupons.map(c => {
          const Icon = typeIcons[c.type] ?? Tag;
          const pct = Math.min(100, Math.round((c.redeemed / c.limit) * 100));
          return (
            <View key={c.id} className="w-full sm:w-[48%] lg:w-[32%]">
              <Card className="p-5">
                <View className="flex-row items-start justify-between mb-3">
                  <View className="flex-row items-center gap-2">
                    <View className="h-9 w-9 rounded-xl bg-red-50 items-center justify-center">
                      <Icon size={16} color="#C8102E" />
                    </View>
                    <Pressable onPress={() => {
                      const next: Record<string, Coupon['status']> = { active: 'expired', expired: 'scheduled', scheduled: 'active' };
                      updateCoupon(c.id, { status: next[c.status] });
                    }}>
                      <Text className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold uppercase', statusColors[c.status])}>{statusLabels[c.status]}</Text>
                    </Pressable>
                  </View>
                  <View className="flex-row gap-1">
                    <Pressable onPress={() => openEdit(c)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center active:bg-ink-200"><Edit2 size={13} color="#6E6E78" /></Pressable>
                    <Pressable onPress={() => setConfirmDelete(c.id)} className="h-7 w-7 rounded-lg items-center justify-center active:bg-red-50"><Trash2 size={13} color="#E11D38" /></Pressable>
                  </View>
                </View>
                <Text className="text-sm font-semibold text-ink-900">{c.title}</Text>
                <Text className="text-lg font-semibold text-ex-red mt-1">{c.value}</Text>
                <View className="flex-row items-center gap-2 mt-3">
                  <View className="flex-1 px-3 py-2 rounded-lg bg-cream-100"><Text className="text-xs font-mono font-semibold text-ink-900 tracking-wider">{c.code}</Text></View>
                  <Pressable onPress={() => copy(c.code)} className="h-8 w-8 rounded-lg bg-ink-100 items-center justify-center active:bg-ink-200">
                    {copied === c.code ? <Check size={13} color="#16a34a" /> : <Copy size={13} color="#6E6E78" />}
                  </Pressable>
                </View>
                <View className="mt-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-[10px] text-ink-400">{c.redeemed.toLocaleString('tr-TR')} kullanıldı</Text>
                    <Text className="text-[10px] text-ink-400">%{pct}</Text>
                  </View>
                  <View className="h-1.5 rounded-full bg-ink-100 overflow-hidden">
                    <View className="h-full rounded-full bg-ex-red" style={{ width: `${pct}%` }} />
                  </View>
                </View>
                <View className="flex-row items-center gap-1 mt-2">
                  <Calendar size={10} color="#9494A0" />
                  <Text className="text-[10px] text-ink-400"> {c.expires} tarihinde sona erer</Text>
                </View>
              </Card>
            </View>
          );
        })}
      </View>

      <Modal open={creating || !!editing} onClose={closeForm} title={creating ? 'Yeni Kupon' : 'Kuponu Düzenle'}>
        <View className="gap-4">
          <FormField label="Kupon adı"><TextInput value={form.title} onChangeText={v => set('title', v)} placeholder="Örn. Sonbahar %20 İndirim" /></FormField>
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField label="Kupon kodu"><TextInput value={form.code} onChangeText={v => set('code', v.toUpperCase())} placeholder="SONBAHAR20" /></FormField></View>
            <View className="flex-1"><FormField label="Değer"><TextInput value={form.value} onChangeText={v => set('value', v)} placeholder="%20, 1+1, ₺50" /></FormField></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField label="Tür">
              <Select value={form.type} onValueChange={v => set('type', v as Coupon['type'])} options={[
                { label: 'Yüzde', value: 'percent' },
                { label: 'Sabit', value: 'fixed' },
                { label: '1+1', value: 'bogo' },
                { label: 'Hediye', value: 'gift' },
              ]} />
            </FormField></View>
            <View className="flex-1"><FormField label="Durum">
              <Select value={form.status} onValueChange={v => set('status', v as Coupon['status'])} options={[
                { label: 'Aktif', value: 'active' },
                { label: 'Süresi Doldu', value: 'expired' },
                { label: 'Planlandı', value: 'scheduled' },
              ]} />
            </FormField></View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1"><FormField label="Kullanılan"><TextInput value={String(form.redeemed)} onChangeText={v => set('redeemed', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
            <View className="flex-1"><FormField label="Limit"><TextInput value={String(form.limit)} onChangeText={v => set('limit', Number(v) || 0)} keyboardType="numeric" /></FormField></View>
          </View>
          <FormField label="Bitiş tarihi"><TextInput value={form.expires} onChangeText={v => set('expires', v)} placeholder="31 Eki, Sürekli, 30 gün" /></FormField>
          <View className="flex-row gap-3 pt-2">
            <Button variant="outline" full onPress={closeForm}>Vazgeç</Button>
            <Button variant="gold" full onPress={save} disabled={!form.code.trim() || !form.title.trim()}>Kaydet</Button>
          </View>
        </View>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => confirmDelete && deleteCoupon(confirmDelete)} title="Kuponu sil" message="Bu kuponu silmek istediğine emin misin?" />
    </View>
  );
}
