import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ScanLine, Camera, CameraOff, Keyboard, CheckCircle2, XCircle,
  User, Gift, Award, RotateCcw, Sparkles, Loader2,
} from 'lucide-react-native';
import { supabase, type Profile, type QrCodeRow } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useAdmin } from '@/context/AdminContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

const POINTS_PER_STAMP = 10;
const STAMPS_TO_REWARD = 5;

type ScanStatus = 'idle' | 'processing' | 'success' | 'error';

type ScanResult = {
  ok: boolean;
  title: string;
  message: string;
  customerName?: string;
  newPoints?: number;
  newStampCount?: number;
};

export function AdminScanner() {
  const { user } = useAuth();
  const { showToast, stores } = useAdmin();

  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [storeId, setStoreId] = useState('');
  const [recent, setRecent] = useState<Array<{ name: string; points: number; time: string; ok: boolean }>>([]);
  const [camPerm, requestCamPerm] = useCameraPermissions();
  const lastScanRef = useRef<string>('');
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    if (stores.length > 0 && !storeId) setStoreId(stores[0].id);
  }, [stores, storeId]);

  const processCode = useCallback(async (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    if (!code.startsWith('EX-')) {
      setResult({ ok: false, title: 'Geçersiz kod', message: 'Bu bir Espresso X QR kodu değil.' });
      setStatus('error');
      return;
    }

    setStatus('processing');
    setResult(null);

    try {
      const { data: qrRow, error: qrErr } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .maybeSingle();

      if (qrErr) throw qrErr;
      if (!qrRow) {
        const r: ScanResult = { ok: false, title: 'Kod bulunamadı', message: 'Bu QR kodu kayıtlı değil veya pasif.' };
        setResult(r);
        setStatus('error');
        setRecent(prev => [{ name: 'Bilinmiyor', points: 0, time: now(), ok: false }, ...prev].slice(0, 6));
        return;
      }

      const qr = qrRow as QrCodeRow;

      const { data: profileRow, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', qr.user_id)
        .maybeSingle();

      if (profErr) throw profErr;
      if (!profileRow) {
        setResult({ ok: false, title: 'Müşteri bulunamadı', message: 'Bu koda ait müşteri kaydı yok.' });
        setStatus('error');
        return;
      }
      const profile = profileRow as Profile;

      if (profile.is_blocked) {
        setResult({ ok: false, title: 'Hesap engelli', message: `${profile.full_name || 'Müşteri'} engellenmiş durumda.` });
        setStatus('error');
        setRecent(prev => [{ name: profile.full_name || 'Müşteri', points: 0, time: now(), ok: false }, ...prev].slice(0, 6));
        return;
      }

      const dedupToken = `${qr.user_id}:${code}:${Date.now()}`;

      const { error: stampErr } = await supabase
        .from('loyalty_stamps')
        .insert({ user_id: qr.user_id, store_id: storeId || null });

      if (stampErr) throw stampErr;

      const { error: scanErr } = await supabase.from('qr_scans').insert({
        user_id: qr.user_id,
        qr_code_id: qr.id,
        store_id: storeId || null,
        action: 'stamp',
        points_awarded: POINTS_PER_STAMP,
        dedup_token: dedupToken,
        scanned_by: user?.id ?? null,
      });
      if (scanErr) throw scanErr;

      const { error: histErr } = await supabase.from('points_history').insert({
        user_id: qr.user_id,
        title: 'QR Damga Puanı',
        points: POINTS_PER_STAMP,
        type: 'earn',
        store_id: storeId || null,
      });
      if (histErr) throw histErr;

      const newPoints = (profile.points ?? 0) + POINTS_PER_STAMP;
      const newLifetime = (profile.lifetime_points ?? 0) + POINTS_PER_STAMP;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ points: newPoints, lifetime_points: newLifetime })
        .eq('user_id', qr.user_id);
      if (updErr) throw updErr;

      const { count: stampCount, error: cntErr } = await supabase
        .from('loyalty_stamps')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', qr.user_id)
        .eq('redeemed', false);
      if (cntErr) throw cntErr;

      const earnedReward = stampCount !== null && stampCount >= STAMPS_TO_REWARD;

      const r: ScanResult = {
        ok: true,
        title: 'Damga eklendi!',
        message: earnedReward
          ? `${STAMPS_TO_REWARD} damga tamamlandı! Ödül talep edebilir.`
          : `${stampCount ?? 0} / ${STAMPS_TO_REWARD} damga`,
        customerName: profile.full_name || 'Müşteri',
        newPoints,
        newStampCount: stampCount ?? 0,
      };
      setResult(r);
      setStatus('success');
      setRecent(prev => [{ name: profile.full_name || 'Müşteri', points: POINTS_PER_STAMP, time: now(), ok: true }, ...prev].slice(0, 6));
      showToast('Damga ve puan eklendi');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Bilinmeyen hata';
      setResult({ ok: false, title: 'Hata', message: msg });
      setStatus('error');
      showToast('Hata: ' + msg);
    }
  }, [storeId, user?.id, showToast]);

  const handleManualSubmit = useCallback(() => {
    if (!manualCode.trim()) return;
    void processCode(manualCode);
    setManualCode('');
  }, [manualCode, processCode]);

  const reset = useCallback(() => {
    setResult(null);
    setStatus('idle');
  }, []);

  const storeOptions = [
    ...(stores.length === 0 ? [{ label: 'Genel', value: '' }] : []),
    ...stores.map(s => ({ label: s.name, value: s.id })),
  ];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="px-4 pb-8 gap-5 max-w-2xl w-full mx-auto">
      {/* Store selector */}
      <Card className="p-4">
        <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Mağaza</Text>
        <View className="mt-1.5">
          <Select value={storeId} onValueChange={setStoreId} options={storeOptions} />
        </View>
      </Card>

      {/* Mode toggle */}
      <View className="flex-row gap-2 p-1 bg-ink-100 rounded-2xl">
        <Pressable
          onPress={() => { setMode('camera'); }}
          className={cn('flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl', mode === 'camera' ? 'bg-white shadow-card' : '')}
        >
          <Camera size={16} color={mode === 'camera' ? '#18181B' : '#6E6E78'} />
          <Text className={cn('text-sm font-medium', mode === 'camera' ? 'text-ink-900' : 'text-ink-500')}>Kamera</Text>
        </Pressable>
        <Pressable
          onPress={() => { setMode('manual'); setStatus('idle'); setResult(null); }}
          className={cn('flex-1 flex-row items-center justify-center gap-2 py-2.5 rounded-xl', mode === 'manual' ? 'bg-white shadow-card' : '')}
        >
          <Keyboard size={16} color={mode === 'manual' ? '#18181B' : '#6E6E78'} />
          <Text className={cn('text-sm font-medium', mode === 'manual' ? 'text-ink-900' : 'text-ink-500')}>Manuel</Text>
        </Pressable>
      </View>

      {/* Camera view with live barcode scanning */}
      {mode === 'camera' && (
        <Card className="p-0 overflow-hidden">
          <View className="relative aspect-square bg-ink-950 items-center justify-center">
            {Platform.OS === 'web' ? (
              <View className="items-center px-6">
                <CameraOff size={40} color="#6E6E78" />
                <Text className="text-sm text-ink-400 mt-3 text-center">
                  Kamera tarayıcı mobil cihazlarda kullanılabilir. Manuel giriş ile damga ekleyebilirsiniz.
                </Text>
                <Pressable
                  onPress={() => { setMode('manual'); }}
                  className="mt-4 flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-ink-800 active:bg-ink-700"
                >
                  <Keyboard size={16} color="#fff" />
                  <Text className="text-sm font-medium text-white">Manuel girişe geç</Text>
                </Pressable>
              </View>
            ) : !camPerm?.granted ? (
              <View className="items-center px-6">
                <CameraOff size={40} color="#6E6E78" />
                <Text className="text-sm text-ink-400 mt-3 text-center">
                  QR kod taramak için kamera izni gerekir.
                </Text>
                <Pressable
                  onPress={() => requestCamPerm()}
                  className="mt-4 flex-row items-center gap-2 px-4 py-2.5 rounded-xl bg-ex-red active:bg-ex-redDark"
                >
                  <Camera size={16} color="#fff" />
                  <Text className="text-sm font-medium text-white">Kamera izni ver</Text>
                </Pressable>
                <Pressable
                  onPress={() => { setMode('manual'); }}
                  className="mt-3"
                >
                  <Text className="text-xs text-ink-400">Manuel girişe geç</Text>
                </Pressable>
              </View>
            ) : (
              <CameraView
                style={{ width: '100%', height: '100%' }}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={({ data }) => {
                  const now = Date.now();
                  if (data === lastScanRef.current && now - lastScanTimeRef.current < 3000) return;
                  lastScanRef.current = data;
                  lastScanTimeRef.current = now;
                  void processCode(data);
                }}
              >
                <View className="flex-1 items-center justify-center">
                  <View className="w-48 h-48 border-2 border-white/80 rounded-2xl" />
                  <Text className="text-white text-sm font-medium mt-4 bg-black/40 px-3 py-1.5 rounded-full">
                    QR kodu kare içine hizalayın
                  </Text>
                </View>
              </CameraView>
            )}

            {status === 'processing' && (
              <View className="absolute inset-0 bg-ink-950/70 items-center justify-center">
                <View className="items-center">
                  <Loader2 size={32} color="#fff" />
                  <Text className="text-sm text-white font-medium mt-3">İşleniyor…</Text>
                </View>
              </View>
            )}
            {status === 'success' && (
              <View className="absolute inset-0 bg-green-500/20 items-center justify-center">
                <View className="items-center">
                  <View className="h-20 w-20 rounded-full bg-green-500 items-center justify-center mb-3">
                    <CheckCircle2 size={44} color="#fff" />
                  </View>
                  <Text className="text-lg font-bold text-white">{result?.title}</Text>
                </View>
              </View>
            )}
            {status === 'error' && (
              <View className="absolute inset-0 bg-ex-red/20 items-center justify-center">
                <View className="items-center">
                  <View className="h-20 w-20 rounded-full bg-ex-red items-center justify-center mb-3">
                    <XCircle size={44} color="#fff" />
                  </View>
                  <Text className="text-lg font-bold text-white">{result?.title}</Text>
                </View>
              </View>
            )}
          </View>
          {(status === 'success' || status === 'error') && (
            <View className="p-4 flex-row gap-2">
              <Button variant="subtle" full onPress={reset}>
                <RotateCcw size={16} color="#6E6E78" /> Yeni Tarama
              </Button>
            </View>
          )}
        </Card>
      )}

      {/* Manual entry */}
      {mode === 'manual' && (
        <Card className="p-5">
          <View className="gap-4">
            <View>
              <Text className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-1.5">QR Kodu</Text>
              <TextInput
                value={manualCode}
                onChangeText={setManualCode}
                placeholder="EX-XXXXXXXX-XXXX"
                placeholderTextColor="#9494A0"
                autoCapitalize="characters"
              />
              <Text className="text-[11px] text-ink-400 mt-2">Müşterinin QR kodunun altındaki harf-rakam dizisini girin.</Text>
            </View>
            <Button full onPress={handleManualSubmit} disabled={!manualCode.trim() || status === 'processing'}>
              {status === 'processing' ? <Loader2 size={16} color="#fff" /> : <><ScanLine size={16} color="#fff" /> Damga Ekle</>}
            </Button>
          </View>
        </Card>
      )}

      {/* Result detail */}
      {result && (status === 'success' || status === 'error') && (
        <Card className={cn('p-5', result.ok ? 'border-green-200' : 'border-ex-red/30')}>
          <View className="flex-row items-start gap-3">
            <View className={cn('h-11 w-11 rounded-xl items-center justify-center shrink-0', result.ok ? 'bg-green-50' : 'bg-red-50')}>
              {result.ok ? <CheckCircle2 size={22} color="#16a34a" /> : <XCircle size={22} color="#C8102E" />}
            </View>
            <View className="flex-1 min-w-0">
              <Text className="font-bold text-ink-900">{result.title}</Text>
              <Text className="text-sm text-ink-500 mt-0.5">{result.message}</Text>
              {result.ok && result.customerName && (
                <View className="flex-row flex-wrap gap-3 mt-3">
                  <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ink-50">
                    <User size={13} color="#6E6E78" />
                    <Text className="text-xs font-medium text-ink-700">{result.customerName}</Text>
                  </View>
                  {result.newPoints !== undefined && (
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50">
                      <Award size={13} color="#d97706" />
                      <Text className="text-xs font-medium text-amber-700">{result.newPoints} puan</Text>
                    </View>
                  )}
                  {result.newStampCount !== undefined && (
                    <View className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-lg bg-ex-red/10">
                      <Gift size={13} color="#C8102E" />
                      <Text className="text-xs font-medium text-ex-red">{result.newStampCount}/{STAMPS_TO_REWARD} damga</Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </View>
        </Card>
      )}

      {/* Recent scans */}
      {recent.length > 0 && (
        <View>
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-2">Son Taramalar</Text>
          <Card className="p-0">
            {recent.map((r, i) => (
              <View key={i} className={cn('flex-row items-center gap-3 px-4 py-3', i > 0 && 'border-t border-ink-50')}>
                <View className={cn('h-8 w-8 rounded-lg items-center justify-center shrink-0', r.ok ? 'bg-green-50' : 'bg-red-50')}>
                  {r.ok ? <CheckCircle2 size={16} color="#16a34a" /> : <XCircle size={16} color="#C8102E" />}
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-sm font-medium text-ink-900" numberOfLines={1}>{r.name}</Text>
                  <Text className="text-[11px] text-ink-400">{r.time}</Text>
                </View>
                {r.ok && (
                  <View className="flex-row items-center gap-1">
                    <Sparkles size={12} color="#d97706" />
                    <Text className="text-xs font-semibold text-amber-600">+{r.points}</Text>
                  </View>
                )}
              </View>
            ))}
          </Card>
        </View>
      )}

      <Text className="text-center text-[11px] text-ink-300 leading-relaxed px-4">
        Müşterinin telefonundaki QR kodunu kameraya gösterin veya kodu manuel girin. Her tarama bir damga ve {POINTS_PER_STAMP} puan kazandırır. {STAMPS_TO_REWARD} damgada ücretsiz ödül.
      </Text>
    </ScrollView>
  );
}

function now(): string {
  return new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}
