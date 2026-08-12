import { useState, useCallback, useEffect, useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import {
  Store, UserPlus, Trash2, KeyRound, Copy, Check, Loader2,
  Building2, Mail, MapPin, ShieldCheck, RefreshCw, AlertTriangle, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { supabase, type Store as StoreRow } from '@/lib/supabase';
import { Card } from '@/components/ui/Card';
import { Button, ButtonRow } from '@/components/ui/Button';
import { ConfirmDialog, TextInput, Toggle } from '@/components/ui/Modal';
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
  password?: string;
  storeName: string;
};

function mapEdgeError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('genel merkez') || m.includes('yetki')) {
    return 'Bu işlem için Admin veya Super Admin ile giriş yapmalısınız.';
  }
  if (m.includes('already') || m.includes('registered') || m.includes('duplicate')) {
    return 'Bu e-posta adresi zaten kayıtlı.';
  }
  if (m.includes('zaten bir franchise')) {
    return 'Seçilen şubenin zaten bir yetkilisi var.';
  }
  if (m.includes('şube bulunamadı')) {
    return 'Şube bulunamadı. Önce Mağazalar ekranından şube oluşturun.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.';
  }
  return message;
}

export function AdminFranchise() {
  const { session, role } = useAuth();
  const { stores: contextStores, showToast } = useAdmin();
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [users, setUsers] = useState<FranchiseUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creds, setCreds] = useState<CreatedCreds | null>(null);
  const [copied, setCopied] = useState<'email' | 'pass' | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const callEdge = useCallback(async (payload: Record<string, unknown>) => {
    if (!session?.access_token) {
      throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
    }
    const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manage-franchise-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token ?? ''}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      },
      body: JSON.stringify(payload),
    });
    let json: Record<string, unknown> = {};
    try {
      json = await res.json() as Record<string, unknown>;
    } catch {
      json = { error: `Sunucu yanıtı okunamadı (HTTP ${res.status})` };
    }
    if (!res.ok) throw new Error(mapEdgeError((json.error as string) ?? `HTTP ${res.status}`));
    return json;
  }, [session?.access_token]);

  const loadStores = useCallback(async () => {
    setStoresLoading(true);
    setStoresError(null);
    const { data, error } = await supabase.from('stores').select('*').order('name');
    if (error) {
      setStoresError(error.message);
      setStores(contextStores);
    } else {
      setStores((data ?? []) as StoreRow[]);
    }
    setStoresLoading(false);
  }, [contextStores]);

  useEffect(() => {
    if (contextStores.length > 0) {
      setStores(contextStores);
      setStoresLoading(false);
    } else {
      void loadStores();
    }
  }, [contextStores, loadStores]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await callEdge({ action: 'list' });
      setUsers((json.franchiseUsers as FranchiseUser[]) ?? []);
    } catch (e) {
      showToast('Hata: ' + (e instanceof Error ? mapEdgeError(e.message) : 'Bilinmeyen'));
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
      showToast('Hata: ' + (e instanceof Error ? mapEdgeError(e.message) : 'Bilinmeyen'));
    }
  }, [callEdge, showToast, load]);

  const assignedStoreIds = new Set(
    users.map(u => u.storeId).filter((id): id is string => Boolean(id)),
  );
  const unassignedStores = stores.filter(s => !assignedStoreIds.has(s.id));
  const canManage = role === 'admin' || role === 'super_admin';

  return (
    <View className="px-4 pb-8 gap-5 max-w-5xl w-full mx-auto">
      {!canManage && (
        <Card className="p-4 border-red-200 bg-red-50">
          <View className="flex-row items-start gap-2">
            <AlertTriangle size={18} color="#C8102E" />
            <Text className="text-sm text-red-800 flex-1">
              Franchise yetkilisi oluşturmak için Admin veya Super Admin hesabıyla HQ paneline giriş yapmalısınız.
            </Text>
          </View>
        </Card>
      )}

      <View className="flex-row items-center justify-between flex-wrap gap-3">
        <View>
          <Text className="text-lg font-bold text-ink-900">Franchise Yönetimi</Text>
          <Text className="text-sm text-ink-400 mt-0.5">Şube yetkililerini oluşturun ve yönetin</Text>
        </View>
        <View className="flex-row gap-2">
          <Button variant="outline" size="sm" onPress={load} disabled={loading}>
            <RefreshCw size={14} color={loading ? '#9494A0' : '#3D3D42'} /> Yenile
          </Button>
          <Button size="sm" onPress={() => setShowCreate(true)} disabled={!canManage || unassignedStores.length === 0 || storesLoading}>
            <UserPlus size={14} color="#fff" /> Yeni Yetkili
          </Button>
        </View>
      </View>

      {storesLoading ? (
        <Card className="p-4">
          <Text className="text-sm text-ink-500">Şubeler yükleniyor…</Text>
        </Card>
      ) : storesError ? (
        <Card className="p-4 border-red-200">
          <Text className="text-sm text-red-700">Şubeler yüklenemedi: {storesError}</Text>
        </Card>
      ) : stores.length === 0 ? (
        <Card className="p-4 border-amber-200">
          <Text className="text-sm text-amber-800">
            Henüz şube yok. Önce <Text className="font-semibold">Operasyonlar → Mağazalar → Mağaza ekle</Text> ile şube oluşturun (Super Admin gerekir).
          </Text>
        </Card>
      ) : unassignedStores.length > 0 ? (
        <Card className="p-4 border-amber-200">
          <View className="flex-row items-center gap-2">
            <Building2 size={16} color="#d97706" />
            <Text className="text-sm text-amber-800 flex-1">
              <Text className="font-semibold">{unassignedStores.length} şube</Text>
              {' '}için henüz franchise yetkilisi yok: {unassignedStores.map(s => s.name).join(', ')}.
              {'\n'}
              <Text className="text-amber-700">Yeni Yetkili</Text> ile her şubeye bir giriş hesabı oluşturun.
            </Text>
          </View>
        </Card>
      ) : (
        <Card className="p-4 border-ink-200">
          <Text className="text-sm text-ink-600">Tüm şubelerin zaten bir yetkilisi var.</Text>
        </Card>
      )}

      {showCreate && canManage && (
        <CreateFranchiseForm
          key="create-franchise-user"
          stores={stores}
          assignedStoreIds={assignedStoreIds}
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { setCreds(c); setShowCreate(false); load(); void loadStores(); }}
          callEdge={callEdge}
          showToast={showToast}
        />
      )}

      {creds && (
        <Card className="p-5 border-green-200 bg-green-50/50 gap-4">
          <View className="flex-row items-center gap-3">
            <View className="h-12 w-12 rounded-2xl bg-green-100 items-center justify-center">
              <Check size={24} color="#16a34a" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-ink-900">Yetkili oluşturuldu</Text>
              <Text className="text-sm text-ink-500">{creds.storeName} şubesi</Text>
            </View>
            <Pressable onPress={() => setCreds(null)} hitSlop={8}>
              <X size={20} color="#9494A0" />
            </Pressable>
          </View>
          <CredRow label="E-posta" value={creds.email} copied={copied === 'email'} onCopy={() => copy(creds.email, 'email')} />
          {creds.password ? (
            <CredRow label="Şifre" value={creds.password} copied={copied === 'pass'} onCopy={() => copy(creds.password!, 'pass')} />
          ) : (
            <Text className="text-xs text-ink-500 leading-relaxed">
              Otomatik şifre üretildi. Bir sonraki oluşturmada &quot;Kendi şifremi belirle&quot; seçeneğini işaretleyin.
            </Text>
          )}
          <Button full onPress={() => setCreds(null)}>Tamam</Button>
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

      <ConfirmDialog
        open={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => confirmDeleteId && removeUser(confirmDeleteId)}
        title="Yetkiliyi sil"
        message="Bu franchise yetkisini silmek istediğinize emin misiniz? Hesap kalıcı olarak kaldırılır."
        confirmLabel="Sil"
      />
    </View>
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

function CreateFranchiseForm({
  stores, assignedStoreIds, onClose, onCreated, callEdge, showToast,
}: {
  stores: Array<{ id: string; name: string }>;
  assignedStoreIds: Set<string>;
  onClose: () => void;
  onCreated: (c: CreatedCreds) => void;
  callEdge: (p: Record<string, unknown>) => Promise<Record<string, unknown>>;
  showToast: (m: string) => void;
}) {
  const selectableStores = useMemo(
    () => stores.filter(s => !assignedStoreIds.has(s.id)),
    [stores, assignedStoreIds],
  );

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [useCustomPass, setUseCustomPass] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (storeId) return;
    const first = selectableStores[0]?.id;
    if (first) setStoreId(first);
  }, [selectableStores, storeId]);

  const submit = useCallback(async () => {
    if (!email.trim() || !fullName.trim() || !storeId) {
      showToast('E-posta, ad ve şube zorunlu');
      return;
    }
    if (assignedStoreIds.has(storeId)) {
      showToast('Bu şubenin zaten bir yetkilisi var');
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
        ...(useCustomPass && customPassword.trim() ? { password: customPassword.trim() } : {}),
        storeName,
      });
      showToast('Franchise yetkilisi oluşturuldu');
    } catch (e) {
      showToast('Hata: ' + (e instanceof Error ? mapEdgeError(e.message) : 'Bilinmeyen'));
    }
    setCreating(false);
  }, [email, fullName, storeId, useCustomPass, customPassword, assignedStoreIds, callEdge, onCreated, showToast]);

  return (
    <Card className="p-5 border-ex-red/20 gap-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className="h-10 w-10 rounded-xl bg-ex-red items-center justify-center">
            <UserPlus size={18} color="#fff" />
          </View>
          <Text className="text-lg font-bold text-ink-900">Yeni Şube Yetkilisi</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Kapat">
          <X size={20} color="#9494A0" />
        </Pressable>
      </View>

      {stores.length === 0 ? (
        <Text className="text-sm text-ink-500 py-4 text-center">
          Şube bulunamadı. Önce Mağazalar ekranından şube ekleyin.
        </Text>
      ) : selectableStores.length === 0 ? (
        <Text className="text-sm text-ink-500 py-4 text-center">
          Tüm şubelerin zaten bir yetkilisi var.
        </Text>
      ) : (
        <View className="gap-4">
          <Field label="Ad Soyad">
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Yetkili adı"
              autoComplete="name"
            />
          </Field>
          <Field label="E-posta">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="yetkili@espressox.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </Field>
          <Field label="Şube">
            <View className="gap-2">
              {selectableStores.map(s => (
                <Pressable
                  key={s.id}
                  onPress={() => setStoreId(s.id)}
                  className={cn(
                    'px-4 py-3 rounded-xl border',
                    storeId === s.id ? 'border-ex-red bg-ex-red/5' : 'border-ink-200 bg-cream-50',
                  )}
                >
                  <Text className={cn('text-sm', storeId === s.id ? 'text-ex-red font-semibold' : 'text-ink-700')}>
                    {s.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Field>

          <Toggle
            checked={useCustomPass}
            onChange={setUseCustomPass}
            label="Kendi şifremi belirle"
          />
          {useCustomPass && (
            <Field label="Şifre (min 6 karakter)">
              <TextInput
                value={customPassword}
                onChangeText={setCustomPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="new-password"
              />
            </Field>
          )}

          <ButtonRow>
            <Button variant="outline" flex onPress={onClose}>Vazgeç</Button>
            <Button flex onPress={submit} disabled={creating}>
              {creating ? <Loader2 size={16} color="#fff" /> : 'Yetkili Oluştur'}
            </Button>
          </ButtonRow>
        </View>
      )}
    </Card>
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
