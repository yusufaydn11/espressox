import { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { Gift, Crown, Zap, Trophy, Users, TrendingUp, Star, Plus, Edit2, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, FormField, TextInput, TextArea, Select } from '@/components/ui/Modal';
import { StatCard } from '@/components/ui/Charts';
import { useAdmin, genId } from '@/context/AdminContext';
import { REWARD_CATEGORY_LABELS } from '@shared/constants/loyalty';
import { cn } from '@/lib/utils';
import type { Reward } from '@/lib/supabase';
import type { Challenge } from '@/types';

const categoryLabels = REWARD_CATEGORY_LABELS;
const categoryOptions = Object.entries(categoryLabels).map(([k, v]) => ({ label: v, value: k }));
const challengeTypeOptions = [
  { label: 'Haftalık', value: 'weekly' }, { label: 'Aylık', value: 'monthly' }, { label: 'Seri', value: 'streak' },
];

const tierCounts = [
  { label: 'Bronz', value: 1420 }, { label: 'Gümüş', value: 2890 }, { label: 'Altın', value: 1640 },
  { label: 'Siyah', value: 612 }, { label: 'VIP', value: 184 },
];

export function AdminLoyalty() {
  const { tiers, updateTier, rewards, addReward, updateReward, deleteReward, challenges, addChallenge, updateChallenge, deleteChallenge } = useAdmin();
  const [editingTier, setEditingTier] = useState<typeof tiers[0] | null>(null);
  const [tierForm, setTierForm] = useState<{ minPoints: number; perks: string }>({ minPoints: 0, perks: '' });

  const [editingReward, setEditingReward] = useState<Reward | null>(null);
  const [creatingReward, setCreatingReward] = useState(false);
  const [confirmRewardDelete, setConfirmRewardDelete] = useState<string | null>(null);
  const [rewardForm, setRewardForm] = useState<Reward | null>(null);

  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [creatingChallenge, setCreatingChallenge] = useState(false);
  const [confirmChallengeDelete, setConfirmChallengeDelete] = useState<string | null>(null);
  const [challengeForm, setChallengeForm] = useState<Challenge | null>(null);

  const openTierEdit = (t: typeof tiers[0]) => { setTierForm({ minPoints: t.minPoints, perks: t.perks.join(', ') }); setEditingTier(t); };
  const saveTier = () => {
    if (editingTier) updateTier(editingTier.name, { minPoints: tierForm.minPoints, perks: tierForm.perks.split(',').map(p => p.trim()).filter(Boolean) });
    setEditingTier(null);
  };

  const blankReward = (): Reward => ({ id: genId('r'), title: '', description: '', points_cost: 100, category: 'coffee', image: 'https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=800', is_active: true });
  const openRewardCreate = () => { setRewardForm(blankReward()); setCreatingReward(true); };
  const openRewardEdit = (r: Reward) => { setRewardForm({ ...r }); setEditingReward(r); };
  const saveReward = () => {
    if (!rewardForm?.title.trim()) return;
    if (creatingReward) addReward(rewardForm); else if (editingReward) updateReward(editingReward.id, rewardForm);
    setEditingReward(null); setCreatingReward(false);
  };

  const blankChallenge = (): Challenge => ({ id: genId('c'), title: '', description: '', progress: 0, target: 5, rewardPoints: 100, expires: '7 gün', type: 'weekly' });
  const openChallengeCreate = () => { setChallengeForm(blankChallenge()); setCreatingChallenge(true); };
  const openChallengeEdit = (c: Challenge) => { setChallengeForm({ ...c }); setEditingChallenge(c); };
  const saveChallenge = () => {
    if (!challengeForm?.title.trim()) return;
    if (creatingChallenge) addChallenge(challengeForm); else if (editingChallenge) updateChallenge(editingChallenge.id, challengeForm);
    setEditingChallenge(null); setCreatingChallenge(false);
  };

  return (
    <View className="max-w-4xl w-full mx-auto gap-5">
      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[160px]"><StatCard label="Sadakat üyesi" value="6.746" change="+8.4%" icon={<Users size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Dağıtılan puan" value="1,2M" change="+12%" icon={<Zap size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Kullanılan ödül" value="3.840" change="+18%" icon={<Gift size={18} color="#C8102E" />} /></View>
        <View className="flex-1 min-w-[160px]"><StatCard label="Etkileşim" value="%78,4" change="+5.6%" icon={<TrendingUp size={18} color="#C8102E" />} /></View>
      </View>

      <Card className="p-5">
        <View className="mb-4"><Text className="text-lg font-semibold text-ink-900">Seviye dağılımı</Text><Text className="text-xs text-ink-400">Seviyeye göre üye sayısı</Text></View>
        <View className="flex-row flex-wrap gap-3">
          {tierCounts.map(t => (
            <View key={t.label} className="flex-1 min-w-[100px] p-4 rounded-2xl bg-cream-100 items-center">
              <Text className="text-2xl font-semibold text-ink-900 leading-none">{t.value.toLocaleString('tr-TR')}</Text>
              <Text className="text-xs text-ink-400 mt-1.5">{t.label}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card className="p-5">
        <View className="mb-4"><Text className="text-lg font-semibold text-ink-900">Seviye yapılandırması</Text><Text className="text-xs text-ink-400">Puan eşikleri & avantajlar</Text></View>
        <View className="flex-row flex-wrap gap-3">
          {tiers.map(t => (
            <View key={t.name} className="flex-1 min-w-[140px] p-4 rounded-2xl border border-ink-100">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center gap-2">
                  <View className="h-8 w-8 rounded-xl items-center justify-center" style={{ backgroundColor: t.color }}><Crown size={14} color="#fff" /></View>
                  <Text className="text-base font-semibold text-ink-900">{t.name}</Text>
                </View>
                <Pressable onPress={() => openTierEdit(t)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center"><Edit2 size={12} color="#6E6E78" /></Pressable>
              </View>
              <Text className="text-xs text-ink-500 mb-2">{t.minPoints.toLocaleString('tr-TR')}+ puan</Text>
              <View className="gap-1">
                {t.perks.map(perk => (
                  <View key={perk} className="flex-row items-center gap-1"><Star size={9} color="#C8102E" /><Text className="text-[10px] text-ink-700 flex-1">{perk}</Text></View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </Card>

      <View className="flex-row flex-wrap gap-5">
        <View className="flex-1 min-w-[300px]">
          <Card className="p-5">
            <View className="flex-row items-center justify-between mb-4">
              <View><Text className="text-lg font-semibold text-ink-900">Ödül kataloğu</Text><Text className="text-xs text-ink-400">{rewards.length} ödül</Text></View>
              <Button size="sm" variant="gold" onPress={openRewardCreate}><Plus size={14} /> Ekle</Button>
            </View>
            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              {rewards.map(r => (
                <View key={r.id} className="flex-row items-center gap-3 py-2.5 border-b border-ink-100">
                  <Image source={{ uri: r.image }} className="h-10 w-10 rounded-xl shrink-0" resizeMode="cover" />
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{r.title}</Text>
                    <Text className="text-[11px] text-ink-400">{categoryLabels[r.category] ?? r.category}</Text>
                  </View>
                  <Text className="text-sm font-semibold text-ex-red">{r.points_cost === 0 ? 'Ücretsiz' : `${r.points_cost} puan`}</Text>
                  <Pressable onPress={() => openRewardEdit(r)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center"><Edit2 size={12} color="#6E6E78" /></Pressable>
                  <Pressable onPress={() => setConfirmRewardDelete(r.id)} className="h-7 w-7 items-center justify-center"><Trash2 size={12} color="#C8102E" /></Pressable>
                </View>
              ))}
            </ScrollView>
          </Card>
        </View>

        <View className="flex-1 min-w-[300px]">
          <Card className="p-5">
            <View className="flex-row items-center justify-between mb-4">
              <View><Text className="text-lg font-semibold text-ink-900">Aktif görevler</Text><Text className="text-xs text-ink-400">{challenges.length} görev</Text></View>
              <Button size="sm" variant="gold" onPress={openChallengeCreate}><Plus size={14} /> Ekle</Button>
            </View>
            <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
              {challenges.map(c => (
                <View key={c.id} className="py-2.5 border-b border-ink-100">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-sm font-medium text-ink-900 flex-1">{c.title}</Text>
                    <Text className="text-xs font-semibold text-ex-red">+{c.rewardPoints} puan</Text>
                    <Pressable onPress={() => openChallengeEdit(c)} className="h-7 w-7 rounded-lg bg-ink-100 items-center justify-center ml-2"><Edit2 size={12} color="#6E6E78" /></Pressable>
                    <Pressable onPress={() => setConfirmChallengeDelete(c.id)} className="h-7 w-7 items-center justify-center"><Trash2 size={12} color="#C8102E" /></Pressable>
                  </View>
                  <Text className="text-[11px] text-ink-400 mb-1.5">{c.description}</Text>
                  <View className="flex-row items-center gap-2">
                    <View className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                      <View className="h-full rounded-full bg-ex-red" style={{ width: `${Math.min(100, (c.progress / c.target) * 100)}%` }} />
                    </View>
                    <Text className="text-[10px] text-ink-500">{c.progress}/{c.target}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </Card>
        </View>
      </View>

      <Modal open={!!editingTier} onClose={() => setEditingTier(null)} title="Seviyeyi Düzenle">
        {editingTier && (
          <View className="gap-4">
            <View className="flex-row items-center gap-3">
              <View className="h-10 w-10 rounded-2xl items-center justify-center" style={{ backgroundColor: editingTier.color }}><Crown size={18} color="#fff" /></View>
              <Text className="text-lg font-semibold text-ink-900">{editingTier.name}</Text>
            </View>
            <FormField label="Minimum puan"><TextInput value={String(tierForm.minPoints)} onChangeText={v => setTierForm({ ...tierForm, minPoints: Number(v) || 0 })} keyboardType="numeric" /></FormField>
            <FormField label="Avantajlar" hint="Virgülle ayır"><TextArea value={tierForm.perks} onChangeText={v => setTierForm({ ...tierForm, perks: v })} /></FormField>
            <View className="flex-row gap-3">
              <Button variant="outline" full onPress={() => setEditingTier(null)}>Vazgeç</Button>
              <Button variant="gold" full onPress={saveTier}>Kaydet</Button>
            </View>
          </View>
        )}
      </Modal>

      <Modal open={creatingReward || !!editingReward} onClose={() => { setEditingReward(null); setCreatingReward(false); }} title={creatingReward ? 'Yeni Ödül' : 'Ödülü Düzenle'}>
        {rewardForm && (
          <View className="gap-4">
            <FormField label="Ödül adı"><TextInput value={rewardForm.title} onChangeText={v => setRewardForm({ ...rewardForm, title: v })} /></FormField>
            <FormField label="Açıklama"><TextArea value={rewardForm.description} onChangeText={v => setRewardForm({ ...rewardForm, description: v })} /></FormField>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Puan maliyeti"><TextInput value={String(rewardForm.points_cost)} onChangeText={v => setRewardForm({ ...rewardForm, points_cost: Number(v) || 0 })} keyboardType="numeric" /></FormField></View>
              <View className="flex-1"><FormField label="Kategori"><Select value={rewardForm.category} onValueChange={v => setRewardForm({ ...rewardForm, category: v })} options={categoryOptions} /></FormField></View>
            </View>
            <FormField label="Görsel URL"><TextInput value={rewardForm.image} onChangeText={v => setRewardForm({ ...rewardForm, image: v })} /></FormField>
            <View className="flex-row gap-3">
              <Button variant="outline" full onPress={() => { setEditingReward(null); setCreatingReward(false); }}>Vazgeç</Button>
              <Button variant="gold" full onPress={saveReward} disabled={!rewardForm.title.trim()}>Kaydet</Button>
            </View>
          </View>
        )}
      </Modal>

      <Modal open={creatingChallenge || !!editingChallenge} onClose={() => { setEditingChallenge(null); setCreatingChallenge(false); }} title={creatingChallenge ? 'Yeni Görev' : 'Görevi Düzenle'}>
        {challengeForm && (
          <View className="gap-4">
            <FormField label="Görev adı"><TextInput value={challengeForm.title} onChangeText={v => setChallengeForm({ ...challengeForm, title: v })} /></FormField>
            <FormField label="Açıklama"><TextArea value={challengeForm.description} onChangeText={v => setChallengeForm({ ...challengeForm, description: v })} /></FormField>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="İlerleme"><TextInput value={String(challengeForm.progress)} onChangeText={v => setChallengeForm({ ...challengeForm, progress: Number(v) || 0 })} keyboardType="numeric" /></FormField></View>
              <View className="flex-1"><FormField label="Hedef"><TextInput value={String(challengeForm.target)} onChangeText={v => setChallengeForm({ ...challengeForm, target: Number(v) || 0 })} keyboardType="numeric" /></FormField></View>
              <View className="flex-1"><FormField label="Ödül puanı"><TextInput value={String(challengeForm.rewardPoints)} onChangeText={v => setChallengeForm({ ...challengeForm, rewardPoints: Number(v) || 0 })} keyboardType="numeric" /></FormField></View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1"><FormField label="Tür"><Select value={challengeForm.type} onValueChange={v => setChallengeForm({ ...challengeForm, type: v as Challenge['type'] })} options={challengeTypeOptions} /></FormField></View>
              <View className="flex-1"><FormField label="Bitiş"><TextInput value={challengeForm.expires} onChangeText={v => setChallengeForm({ ...challengeForm, expires: v })} /></FormField></View>
            </View>
            <View className="flex-row gap-3">
              <Button variant="outline" full onPress={() => { setEditingChallenge(null); setCreatingChallenge(false); }}>Vazgeç</Button>
              <Button variant="gold" full onPress={saveChallenge} disabled={!challengeForm.title.trim()}>Kaydet</Button>
            </View>
          </View>
        )}
      </Modal>

      <ConfirmDialog open={!!confirmRewardDelete} onClose={() => setConfirmRewardDelete(null)} onConfirm={() => confirmRewardDelete && deleteReward(confirmRewardDelete)} title="Ödülü sil" message="Bu ödülü silmek istediğine emin misin?" />
      <ConfirmDialog open={!!confirmChallengeDelete} onClose={() => setConfirmChallengeDelete(null)} onConfirm={() => confirmChallengeDelete && deleteChallenge(confirmChallengeDelete)} title="Görevi sil" message="Bu görevi silmek istediğine emin misin?" />

      <Card className="p-5">
        <View className="mb-4"><Text className="text-lg font-semibold text-ink-900">Rozet sistemi</Text><Text className="text-xs text-ink-400">Başarım tanımları</Text></View>
        <View className="flex-row flex-wrap gap-3">
          {Array.from({ length: 9 }).map((_, i) => {
            const unlocked = i < 6;
            return (
              <View key={i} className={cn('flex-1 min-w-[100px] p-3 rounded-2xl border items-center', unlocked ? 'border-ex-red bg-red-50' : 'border-ink-100 opacity-60')}>
                <View className={cn('h-10 w-10 rounded-xl items-center justify-center mb-1.5', unlocked ? 'bg-ex-red' : 'bg-ink-200')}>
                  <Trophy size={18} color={unlocked ? '#fff' : '#9494A0'} />
                </View>
                <Text className="text-xs font-semibold text-ink-900">Rozet {i + 1}</Text>
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}
