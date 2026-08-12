import { useState } from 'react';
import { View, Text, Pressable, Image } from 'react-native';
import Constants from 'expo-constants';
import {
  Heart, Receipt, CreditCard, MapPin, FileText, Crown, Zap,
  Bell, Inbox, Globe, ChevronRight, Settings, LogOut, Wallet, Gift, Camera,
  UserX, Sparkles,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LegalEntryButtons } from '@/screens/customer/LegalSheet';
import { Sheet } from '@/components/ui/Sheet';
import { TextInput, FormField } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { PageHeader, ScreenWrapper, SectionLabel } from '@/components/customer';
import { colors } from '@shared/design/tokens';

export function ProfileScreen() {
  const { openSheet, showToast } = useApp();
  const { profile, signOut, updateProfile } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name ?? '');
  const [editPhone, setEditPhone] = useState(profile?.phone ?? '');
  const [editBirthday, setEditBirthday] = useState(profile?.birthday ?? '');
  const [saving, setSaving] = useState(false);
  const [lang, setLang] = useState('Türkçe');

  const handleLogout = async () => { await signOut(); };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfile({ full_name: editName, phone: editPhone, birthday: editBirthday });
    setSaving(false);
    if (error) showToast('Güncelleme başarısız');
    else { showToast('Profil güncellendi'); setEditOpen(false); }
  };

  const stats = [
    { label: 'Puan', value: (profile?.points ?? 0).toLocaleString('tr-TR'), icon: Zap, accent: true },
    { label: 'Seri', value: `${profile?.streak ?? 0}g`, icon: Sparkles },
    { label: 'Seviye', value: profile?.tier ?? 'Bronz', icon: Crown },
  ];

  const menuSections = [
    {
      title: 'Hesap',
      items: [
        { icon: CreditCard, label: 'Ödeme yöntemleri', value: '', action: () => showToast('Ödeme yöntemleri yakında') },
        { icon: MapPin, label: 'Kayıtlı adresler', value: '', action: () => openSheet('addresses') },
        { icon: FileText, label: 'Faturalar', value: '', action: () => showToast('Faturalar yakında') },
      ],
    },
    {
      title: 'Sadakat',
      items: [
        { icon: Crown, label: 'Sadakat & ödüller', value: profile?.tier ?? 'Bronz', action: () => openSheet('rewards') },
        { icon: Zap, label: 'Puan geçmişi', value: `${(profile?.points ?? 0).toLocaleString('tr-TR')} puan`, action: () => openSheet('rewards') },
        { icon: Gift, label: 'Promosyonlar & kuponlar', value: '', action: () => openSheet('promotions') },
        { icon: Wallet, label: 'Cüzdan kredisi', value: `₺${(profile?.wallet_credits ?? 0).toFixed(0)}`, action: () => showToast('Cüzdan') },
      ],
    },
    {
      title: 'Tercihler',
      items: [
        { icon: Inbox, label: 'Bildirimler', value: 'Merkez', action: () => openSheet('notification-inbox') },
        { icon: Bell, label: 'Bildirim ayarları', value: 'Tercihler', action: () => openSheet('notifications') },
        { icon: Sparkles, label: 'AI Barista', value: 'Canlı menü', action: () => openSheet('ai') },
        { icon: Globe, label: 'Dil', value: lang, action: () => setLang(l => l === 'Türkçe' ? 'English' : 'Türkçe') },
      ],
    },
  ];

  return (
    <ScreenWrapper width="narrow">
      <PageHeader title="Profilim" subtitle="Hesap ve sadakat ayarların" />
      <View className="bg-white rounded-2xl p-5 shadow-soft mb-5 border border-cream-100">
        <View className="flex-row items-center gap-4">
          <View className="relative">
            <View className="rounded-full bg-ex-red/10 items-center justify-center overflow-hidden" style={{ height: 64, width: 64 }}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <Text className="text-xl font-bold text-ex-red">{(profile?.full_name ?? '?').charAt(0).toUpperCase()}</Text>
              )}
            </View>
            <Pressable onPress={() => showToast('Profil fotoğrafı yakında')} className="absolute -bottom-0.5 -right-0.5 h-6 w-6 rounded-full bg-white shadow-soft items-center justify-center">
              <Camera size={11} color={colors.ex.red} />
            </Pressable>
          </View>
          <View className="flex-1 min-w-0">
            <Text className="text-lg font-bold text-ink-900 font-display" numberOfLines={1}>{profile?.full_name || 'Üye'}</Text>
            <Text className="text-xs text-ink-400 mt-0.5" numberOfLines={1}>{profile?.phone || 'Espresso X Üyesi'}</Text>
            <View className="flex-row items-center gap-1 mt-2 px-2.5 py-1 rounded-full bg-ex-red/10 self-start">
              <Crown size={10} color={colors.ex.red} fill={colors.ex.red} />
              <Text className="text-[10px] font-semibold text-ex-red">{profile?.tier ?? 'Bronz'}</Text>
            </View>
          </View>
          <Pressable onPress={() => { setEditName(profile?.full_name ?? ''); setEditPhone(profile?.phone ?? ''); setEditBirthday(profile?.birthday ?? ''); setEditOpen(true); }} className="h-9 w-9 rounded-full bg-cream-50 items-center justify-center active:bg-cream-100">
            <Settings size={16} color={colors.ink[500]} />
          </Pressable>
        </View>
      </View>

      {/* Stats row */}
      <View className="flex-row gap-3 mb-4">
        {stats.map(s => (
          <Card key={s.label} className={cn('flex-1 p-3.5 items-center', s.accent && 'border-ex-red/20')}>
            <View className={cn('h-9 w-9 rounded-xl items-center justify-center', s.accent ? 'bg-ex-red/10' : 'bg-cream-100')}>
              <s.icon size={15} color={s.accent ? colors.ex.red : colors.ink[600]} fill={s.accent ? colors.ex.red : 'transparent'} />
            </View>
            <Text className="text-lg font-bold text-ink-900 leading-none mt-2.5">{s.value}</Text>
            <Text className="text-[10px] text-ink-400 mt-1">{s.label}</Text>
          </Card>
        ))}
      </View>

      {/* Quick actions */}
      <View className="flex-row gap-3 mb-6">
        <Card onPress={() => openSheet('orders')} className="flex-1 p-4 relative overflow-hidden">
          <View className="absolute top-0 right-0 h-14 w-14 rounded-full bg-ex-red/5 -mr-7 -mt-7" />
          <View className="relative">
            <View className="h-10 w-10 rounded-2xl bg-ex-red/10 items-center justify-center">
              <Receipt size={18} color="#C8102E" />
            </View>
            <Text className="text-sm font-bold text-ink-900 mt-2.5">Siparişlerim</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">Geçmiş siparişler</Text>
          </View>
        </Card>
        <Card onPress={() => openSheet('rewards')} className="flex-1 p-4 relative overflow-hidden">
          <View className="absolute top-0 right-0 h-14 w-14 rounded-full bg-ex-red/5 -mr-7 -mt-7" />
          <View className="relative">
            <View className="h-10 w-10 rounded-2xl bg-ex-red/10 items-center justify-center">
              <Heart size={18} color="#C8102E" fill="#C8102E" />
            </View>
            <Text className="text-sm font-bold text-ink-900 mt-2.5">Ödüllerim</Text>
            <Text className="text-[11px] text-ink-400 mt-0.5">Puanları kullan</Text>
          </View>
        </Card>
      </View>

      {/* Menu sections */}
      {menuSections.map(section => (
        <View key={section.title} className="mb-5">
          <SectionLabel>{section.title}</SectionLabel>
          <Card className="p-0 overflow-hidden">
            {section.items.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={item.action}
                className={cn(
                  'flex-row items-center gap-3 px-4 py-3.5 active:bg-ink-50',
                  i < section.items.length - 1 && 'border-b border-ink-100',
                )}
              >
                <View className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center shrink-0">
                  <item.icon size={17} color="#C8102E" />
                </View>
                <Text className="flex-1 text-sm font-medium text-ink-900">{item.label}</Text>
                {item.value ? <Text className="text-xs text-ink-400">{item.value}</Text> : null}
                <ChevronRight size={16} color="#C4C4CC" />
              </Pressable>
            ))}
          </Card>
        </View>
      ))}

      {/* Legal & account */}
      <View className="mb-6">
        <SectionLabel>Yasal & Hesap</SectionLabel>
        <Card className="p-0 overflow-hidden">
          <LegalEntryButtons />
          <Pressable
            onPress={() => openSheet('account')}
            className="flex-row items-center gap-3 px-4 py-3.5 active:bg-ink-50 border-b border-ink-100"
          >
            <View className="h-9 w-9 rounded-xl bg-cream-100 items-center justify-center shrink-0">
              <UserX size={17} color="#C8102E" />
            </View>
            <Text className="flex-1 text-sm font-medium text-ink-900">Hesap ve veri yönetimi</Text>
            <ChevronRight size={16} color="#C4C4CC" />
          </Pressable>
        </Card>
      </View>

      <Pressable
        onPress={handleLogout}
        className="flex-row items-center justify-center gap-2 w-full py-4 rounded-2xl bg-ex-red/10 border border-ex-red/20 active:bg-ex-red/15 active:scale-[0.98] mb-4"
      >
        <LogOut size={20} color="#C8102E" />
        <Text className="text-base font-bold text-ex-red">Çıkış Yap</Text>
      </Pressable>

      <View className="mt-8 mb-2 flex-row items-center gap-2 justify-center">
        <View className="h-7 w-7 rounded-lg bg-ex-red items-center justify-center shadow-red">
          <Text className="text-xs font-bold text-white leading-none">X</Text>
        </View>
        <Text className="text-xs text-ink-300">Espresso X · v{Constants.expoConfig?.version ?? '1.0.0'} · Kahvenin Sanatı</Text>
      </View>

      <Sheet open={editOpen} onClose={() => setEditOpen(false)} title="Profili Düzenle">
        <View className="gap-4">
          <FormField label="Ad Soyad">
            <TextInput value={editName} onChangeText={setEditName} placeholder="Adın Soyadın" />
          </FormField>
          <FormField label="Telefon">
            <TextInput value={editPhone} onChangeText={setEditPhone} placeholder="+90 5xx xxx xx xx" />
          </FormField>
          <FormField label="Doğum günü">
            <TextInput value={editBirthday} onChangeText={setEditBirthday} placeholder="21 Ağustos" />
          </FormField>
          <Button variant="primary" full onPress={handleSave} disabled={saving}>
            {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </Button>
        </View>
      </Sheet>
    </ScreenWrapper>
  );
}
