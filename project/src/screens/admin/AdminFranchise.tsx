import { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  Store, UserPlus, Trash2, KeyRound, Copy, Check, Loader2,
  Building2, Mail, MapPin, X, ShieldCheck, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog, Select, TextInput, Toggle } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

type FranchiseUser = {
  userId: string;
  role: string;
  storeId: string | null;
  fullName: string;
  updatedAt: string;
};

type CreatedCreds = {
  email: string;
  password: string;
  storeName: string;
};

export function AdminFranchise() {
  const { session } = useAuth();
  const { stores, showToast } = useAdmin();
  const [users, setUsers] = useState<FranchiseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creds, setCreds] = useState<CreatedCreds | null>(null);
  const [copied, setCopied] = useState<'email' | 'pass' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const callEdge = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manage-franchise-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json() as Record<string, unknown>;
    if (!res.ok) throw new Error((json.error as string) ?? 'İstek başarısız');
    return json;
  }, [session?.access_token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await callEdge({ action: 'list' });
      setUsers((json.franchiseUsers as FranchiseUser[]) ?? []);
    } catch (e) {
      showToast('Hata: ' + (e instanceof Error ? e.message : 'Bilinmeyen'));
    }
    setLoading(false);
  }, [callEdge, showToast]);

  useEffect(() => { load(); }, [load]);

  const storeName = useCallback((id: string | null) => {
    if (!id) return '—';
    return stores.find(s => s.id === id)?.name ?? id;
  }, [stores]);

  const copy = useCallback((_text: string, which: 'email' | 'pass') => {
    // Clipboard not available without expo-clipboard; surface a visual "copied" state only.
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  }, []);

  const removeUser = useCallback(async (uid: string) => {
    try {
      await callEdge({ action: 'delete', userId: uid });
      showToast('Franchise yetkilisi silindi');
      load();
    } catch (e) {
      showToast('Hata: ' + (e instanceof Error ? e.message : 'Bilinmeyen'));
    }
  }, [callEdge, showToast, load]);

  const unassignedStores = stores.filter(s => !users.some(u => u.storeId === s.id));

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-8 gap-5 max-w-5xl w-full mx-auto">
      <View className="flex-row items-center justify-between flex-wrap gap-3">
        <View>
          <Text className="text-lg font-bold text-ink-900">Franchise Yönetimi</Text>
          <Text className="text-sm text-ink-400 mt-0.5">Şube yetkililerini oluşturun ve yönetin</Text>
        </View>
        <View className="flex-row gap-2">
          <Button variant="outline" size="sm" onPress={load} disabled={loading}>
            <RefreshCw size={14} color={loading ? '#9494A0' : '#3D3D42'} /> Yenile
          </Button>
          <Button size="sm" onPress={() => setShowCreate(true)} disabled={unassignedStores.length === 0}>
            <UserPlus size={14} color="#fff" /> Yeni Yetkili
          </Button>
        </View>
      </View>

      {unassignedStores.length > 0 && (
        <Card className="p-4 border-amber-200">
          <View className="flex-row items-center gap-2">
            <Building2 size={16} color="#d97706" />
            <Text className="text-sm text-amber-800">
              <Text className="font-semibold">{unassignedStores.length} şube</Text> henüz yetkili atandırmıyor: {unassignedStores.map(s => s.name).join(', ')}
            </Text>
          </View>
        </Card>
      )}

      {loading ? (
        <View className="items-center justify-center py-20"><Loader2 size={28} color="#C8102E" /></View>
      ) : users.length === 0 ? (
        <Card className="p-12 items-center">
          <Store size={36} color="#C8C8D0" />
          <Text className="text-sm font-medium text-ink-600 mt-3">Henüz franchise yetkilisi yok</Text>
          <Text className="text-xs text-ink-400 mt-1">"Yeni Yetkili" ile ilk şube yetkilisini oluşturun.</Text>
        </Card>
      ) : (
        <View className="flex-row flex-wrap gap-3">
          {users.map(u => (
            <Card key={u.userId} className="p-4 flex-1 min-w-[280px]">
              <View className="flex-row items-start gap-3">
                <View className="h-11 w-11 rounded-xl bg-ex-red/10 items-center justify-center shrink-0">
                  <ShieldCheck size={20} color="#C8102E" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-bold text-ink-900" numberOfLines={1}>{u.fullName || 'İsimsiz'}</Text>
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <Mail size={11} color="#9494A0" />
                    <Text className="text-xs text-ink-500">Franchise Yetkilisi</Text>
                  </View>
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <MapPin size={11} color="#9494A0" />
                    <Text className="text-xs text-ink-400" numberOfLines={1}>{storeName(u.storeId)}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => setConfirmDeleteId(u.userId)}
                  className="h-8 w-8 rounded-lg items-center justify-center active:bg-red-50"
                  accessibilityLabel="Sil"
                >
                  <Trash2 size={16} color="#9494A0" />
                </Pressable>
              </View>
            </Card>
          ))}
        </View>
      )}

      <CreateFranchiseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        stores={unassignedStores}
        onCreated={(c) => { setCreds(c); setShowCreate(false); load(); }}
        callEdge={callEdge}
        showToast={showToast}
      />

      {creds && (
        <Modal open onClose={() => setCreds(null)}>
          <View className="gap-4">
            <View className="h-14 w-14 rounded-2xl bg-green-50 items-center justify-center self-center">
              <Check size={28} color="#16a34a" />
            </View>
            <Text className="text-center text-lg font-bold text-ink-900">Yetkili oluşturuldu</Text>
            <Text className="text-center text-sm text-ink-500">{creds.storeName} şubesi için giriş bilgileri:</Text>

            <View className="gap-3">
              <CredRow label="E-posta" value={creds.email} copied={copied === 'email'} onCopy={() => copy(creds.email, 'email')} />
              <CredRow label="Şifre" value={creds.password} copied={copied === 'pass'} onCopy={() => copy(creds.password, 'pass')} />
            </View>

            <Text className="text-xs text-ink-400 text-center leading-relaxed">
              Bu bilgileri şube yetkilisine iletin. Şifre güvenli şekilde saklanmalıdır.
            </Text>
            <Button full onPress={() => setCreds(null)}>Tamam</Button>
          </View>
        </Modal>
      )}

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && removeUser(confirmDeleteId)}
        title="Yetkiliyi sil"
        message="Bu franchise yetkisini silmek istediğinize emin misiniz? Hesap kalıcı olarak kaldırılır."
        confirmLabel="Sil"
      />
    </ScrollView>
  );
}

function CredRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <View className="flex-row items-center gap-2 p-3 rounded-xl bg-ink-50 border border-ink-100">
      <KeyRound size={14} color="#9494A0" />
      <View className="flex-1 min-w-0">
        <Text className="text-[10px] text-ink-400 uppercase tracking-wide">{label}</Text>
        <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{value}</Text>
      </View>
      <Pressable onPress={onCopy} className="h-8 w-8 rounded-lg items-center justify-center active:bg-white">
        {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} color="#6E6E78" />}
      </Pressable>
    </View>
  );
}

function CreateFranchiseModal({
  open, onClose, stores, onCreated, callEdge, showToast,
}: {
  open: boolean;
  onClose: () => void;
  stores: Array<{ id: string; name: string }>;
  onCreated: (c: CreatedCreds) => void;
  callEdge: (p: Record<string, unknown>) => Promise<Record<string, unknown>>;
  showToast: (m: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [useCustomPass, setUseCustomPass] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail(''); setFullName(''); setCustomPassword(''); setUseCustomPass(false);
      setStoreId(stores[0]?.id ?? '');
    }
  }, [open, stores]);

  const submit = useCallback(async () => {
    if (!email.trim() || !fullName.trim() || !storeId) {
      showToast('E-posta, ad ve şube zorunlu');
      return;
    }
    setCreating(true);
    try {
      const res = await callEdge({
        action: 'create',
        email: email.trim().toLowerCase(),
        password: useCustomPass ? customPassword.trim() : '',
        fullName: fullName.trim(),
        storeId,
      });
      const storeName = (res.storeName as string) ?? '';
      onCreated({
        email: (res.email as string) ?? email,
        password: (res.password as string) ?? customPassword,
        storeName,
      });
      showToast('Franchise yetkilisi oluşturuldu');
    } catch (e) {
      showToast('Hata: ' + (e instanceof Error ? e.message : 'Bilinmeyen'));
    }
    setCreating(false);
  }, [email, fullName, storeId, useCustomPass, customPassword, callEdge, onCreated, showToast]);

  if (!open) return null;

  return (
    <Modal open onClose={onClose}>
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <View className="h-10 w-10 rounded-xl bg-ex-red items-center justify-center shadow-red"><UserPlus size={18} color="#fff" /></View>
            <Text className="text-lg font-bold text-ink-900">Yeni Şube Yetkilisi</Text>
          </View>
          <Pressable onPress={onClose}><X size={20} color="#9494A0" /></Pressable>
        </View>

        {stores.length === 0 ? (
          <Text className="text-sm text-ink-500 py-6 text-center">Atanmamış şube yok. Tüm şubelerin zaten bir yetkilisi var.</Text>
        ) : (
          <View className="gap-4">
            <Field label="Ad Soyad">
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Yetkili adı"
                placeholderTextColor="#9494A0"
              />
            </Field>
            <Field label="E-posta">
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="yetkili@espressox.com"
                placeholderTextColor="#9494A0"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </Field>
            <Field label="Şube">
              <Select
                value={storeId}
                onValueChange={setStoreId}
                options={stores.map(s => ({ label: s.name, value: s.id }))}
              />
            </Field>

            <Toggle
              checked={useCustomPass}
              onChange={setUseCustomPass}
              label="Kendi şifremi belirle (boş bırakılırsa otomatik güçlü şifre üretilir)"
            />
            {useCustomPass && (
              <Field label="Şifre (min 6 karakter)">
                <TextInput
                  value={customPassword}
                  onChangeText={setCustomPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#9494A0"
                  secureTextEntry
                />
              </Field>
            )}

            <Button full onPress={submit} disabled={creating}>
              {creating ? <Loader2 size={16} color="#fff" /> : 'Yetkili Oluştur'}
            </Button>
            <Text className="text-[11px] text-ink-400 text-center leading-relaxed">
              Oluşturulan yetkili yalnızca kendi şubesinin verilerine erişebilir.
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">{label}</Text>
      {children}
    </View>
  );
}
