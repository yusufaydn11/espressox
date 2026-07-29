import { useEffect, useState } from 'react';
import { Settings, Save, Database, Shield, Building } from 'lucide-react';
import { fetchLoyaltySettings, updateLoyaltySettings } from '../lib/api';
import { Card, Spinner, ErrorState, PageHeader, Button } from '../lib/ui';
import { useToast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import type { LoyaltySettings } from '../lib/supabase';

export function SettingsScreen() {
  const { success, error: toastError } = useToast();
  const { profile, primaryRole } = useAuth();
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [form, setForm] = useState<Partial<LoyaltySettings>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try { const s = await fetchLoyaltySettings(); setSettings(s); if (s) setForm(s); }
      catch (e) { setError(e instanceof Error ? e.message : 'Ayarlar yüklenemedi'); }
      finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try { await updateLoyaltySettings(settings.id, form); success('Ayarlar kaydedildi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <PageHeader title="Ayarlar" subtitle="Sistem yapılandırması" />

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Shield size={16} className="text-ex-red" /> Hesap Bilgileri</h3>
          <div className="space-y-3">
            <Row label="Ad Soyad" value={profile?.full_name ?? '—'} />
            <Row label="Rol" value={primaryRole ?? '—'} />
            <Row label="Telefon" value={profile?.phone || '—'} />
            <Row label="Üyelik" value={new Date(profile?.created_at ?? Date.now()).toLocaleDateString('tr-TR')} />
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Settings size={16} className="text-ex-red" /> Sadakat Ayarları</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="admin-label">Kazanma Oranı</label><input type="number" step="0.01" className="admin-input" value={form.earn_rate ?? 0} onChange={e => setForm(f => ({ ...f, earn_rate: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">Kullanma Oranı</label><input type="number" step="0.01" className="admin-input" value={form.redeem_rate ?? 0} onChange={e => setForm(f => ({ ...f, redeem_rate: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">Bronz Min.</label><input type="number" className="admin-input" value={form.bronze_min ?? 0} onChange={e => setForm(f => ({ ...f, bronze_min: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">Silver Min.</label><input type="number" className="admin-input" value={form.silver_min ?? 0} onChange={e => setForm(f => ({ ...f, silver_min: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">Gold Min.</label><input type="number" className="admin-input" value={form.gold_min ?? 0} onChange={e => setForm(f => ({ ...f, gold_min: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">VIP Min.</label><input type="number" className="admin-input" value={form.vip_min ?? 0} onChange={e => setForm(f => ({ ...f, vip_min: Number(e.target.value) }))} /></div>
          </div>
          <Button className="mt-4" disabled={saving} onClick={save}><Save size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Database size={16} className="text-ex-red" /> Sistem Durumu</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatusItem label="Veritabanı" status="Bağlı" tone="green" />
          <StatusItem label="Auth" status="Aktif" tone="green" />
          <StatusItem label="Push Servis" status="Hazır" tone="green" />
          <StatusItem label="RLS" status="Etkin" tone="green" />
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Building size={16} className="text-ex-red" /> Hakkında</h3>
        <p className="text-sm text-ink-500 dark:text-ink-400">Espresso X Merkez Yönetim Paneli v1.0. Bu platform tüm Espresso X şubelerini, franchise operasyonlarını, ürün ve kampanya yönetimini tek noktadan kontrol etmenizi sağlar. 50+ şube ölçeğine uygun olarak tasarlanmıştır.</p>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-2 border-b border-ink-100 dark:border-ink-800 last:border-0"><span className="text-sm text-ink-400 dark:text-ink-400">{label}</span><span className="text-sm font-semibold text-ink-900 dark:text-ink-100">{value}</span></div>;
}

function StatusItem({ label, status, tone }: { label: string; status: string; tone: 'green' | 'amber' | 'red' }) {
  const colors = { green: 'bg-green-500', amber: 'bg-amber-500', red: 'bg-red-500' };
  return (
    <div className="flex items-center gap-2.5 bg-cream-50 dark:bg-ink-800 rounded-xl px-3.5 py-3">
      <span className={`h-2.5 w-2.5 rounded-full ${colors[tone]} animate-pulse`} />
      <div><p className="text-sm font-semibold text-ink-900 dark:text-ink-100">{status}</p><p className="text-[10px] text-ink-400 dark:text-ink-400">{label}</p></div>
    </div>
  );
}
