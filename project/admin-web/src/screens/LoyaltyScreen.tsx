import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Crown, Zap, Save } from 'lucide-react';
import { fetchRewards, createReward, updateReward, deleteReward, fetchLoyaltySettings, updateLoyaltySettings } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import type { Reward, LoyaltySettings } from '../lib/supabase';

export function LoyaltyScreen() {
  const { success, error: toastError } = useToast();
  const [rewards, setRewards] = useState<Reward[] | null>(null);
  const [settings, setSettings] = useState<LoyaltySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [creating, setCreating] = useState(false);
  const [settingsForm, setSettingsForm] = useState<Partial<LoyaltySettings>>({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Reward | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [r, s] = await Promise.all([fetchRewards(), fetchLoyaltySettings()]);
      setRewards(r); setSettings(s); if (s) setSettingsForm(s);
    } catch (e) { setError(e instanceof Error ? e.message : 'Veriler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (r: Reward) => {
    try { await deleteReward(r.id); setRewards(prev => prev?.filter(x => x.id !== r.id) ?? null); success('Silindi'); setConfirmDel(null); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    try { await updateLoyaltySettings(settings.id, settingsForm); await load(); success('Ayarlar kaydedildi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSavingSettings(false); }
  };

  if (loading) return <Spinner />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tiers = [
    { name: 'Bronz', min: settings?.bronze_min ?? 0, color: '#a87f54' },
    { name: 'Silver', min: settings?.silver_min ?? 1000, color: '#9ca3af' },
    { name: 'Gold', min: settings?.gold_min ?? 3000, color: '#C8102E' },
    { name: 'VIP', min: settings?.vip_min ?? 15000, color: '#18181b' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Sadakat Sistemi" subtitle="Seviyeler, ödüller ve puan oranları" />

      {/* Settings */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Zap size={16} className="text-ex-red" /> Puan Oranları</h3>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="admin-label">Kazanma Oranı (₺/puan)</label><input type="number" step="0.01" className="admin-input" value={settingsForm.earn_rate ?? 0} onChange={e => setSettingsForm(f => ({ ...f, earn_rate: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">Kullanma Oranı</label><input type="number" step="0.01" className="admin-input" value={settingsForm.redeem_rate ?? 0} onChange={e => setSettingsForm(f => ({ ...f, redeem_rate: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">Damga Başına Puan</label><input type="number" className="admin-input" value={settingsForm.points_per_stamp ?? 0} onChange={e => setSettingsForm(f => ({ ...f, points_per_stamp: Number(e.target.value) }))} /></div>
            <div><label className="admin-label">Ücretsiz Kahve Damga</label><input type="number" className="admin-input" value={settingsForm.stamps_per_free_coffee ?? 0} onChange={e => setSettingsForm(f => ({ ...f, stamps_per_free_coffee: Number(e.target.value) }))} /></div>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-bold text-ink-900 dark:text-ink-100 mb-4 flex items-center gap-2"><Crown size={16} className="text-ex-red" /> Seviye Eşikleri</h3>
          <div className="grid grid-cols-2 gap-4">
            {tiers.map(t => (
              <div key={t.name} className="rounded-xl p-3 border border-ink-100 dark:border-ink-800">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: t.color }}><Crown size={14} color="#fff" /></div>
                  <span className="text-sm font-bold text-ink-900 dark:text-ink-100">{t.name}</span>
                </div>
                <input type="number" className="admin-input mt-2" value={settingsForm[`${t.name.toLowerCase() === 'bronze' ? 'bronze' : t.name.toLowerCase() === 'silver' ? 'silver' : t.name.toLowerCase() === 'gold' ? 'gold' : 'vip'}_min` as keyof LoyaltySettings] as number ?? t.min}
                  onChange={e => setSettingsForm(f => ({ ...f, [`${t.name.toLowerCase() === 'bronze' ? 'bronze' : t.name.toLowerCase() === 'silver' ? 'silver' : t.name.toLowerCase() === 'gold' ? 'gold' : 'vip'}_min`]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={savingSettings}><Save size={16} /> {savingSettings ? 'Kaydediliyor…' : 'Ayarları Kaydet'}</Button>
      </div>

      {/* Rewards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-ink-900 dark:text-ink-100">Ödüller</h3>
          <Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Ödül</Button>
        </div>
        {!rewards || rewards.length === 0 ? <EmptyState title="Ödül yok" subtitle="İlk ödülü ekleyin" /> :
         <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
           {rewards.map(r => (
             <Card key={r.id} className="p-4">
               <div className="flex items-start gap-3">
                 {r.image && <img src={r.image} alt="" className="h-14 w-14 rounded-xl object-cover" />}
                 <div className="flex-1 min-w-0">
                   <p className="text-sm font-bold text-ink-900 dark:text-ink-100">{r.title}</p>
                   <p className="text-xs text-ink-400 dark:text-ink-400 mt-0.5 line-clamp-2">{r.description}</p>
                   <Badge tone="red" className="mt-2"><Zap size={10} /> {r.points_cost} puan</Badge>
                 </div>
               </div>
               <div className="flex gap-1.5 mt-3 pt-3 border-t border-ink-100 dark:border-ink-800">
                 <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(r)}><Edit2 size={13} /> Düzenle</Button>
                 <Button variant="danger" size="sm" onClick={() => setConfirmDel(r)}><Trash2 size={13} /></Button>
               </div>
             </Card>
           ))}
         </div>
        }
      </div>

      <RewardModal open={editing !== null || creating} reward={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }} />
      <ConfirmDialog open={confirmDel !== null} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel && remove(confirmDel)} title="Ödülü Sil" message={`"${confirmDel?.title ?? ''}" silinsin mi?`} />
    </div>
  );
}

function RewardModal({ open, reward, onClose, onSaved }: { open: boolean; reward: Reward | null; onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<Reward>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(reward ? { ...reward } : { id: '', title: '', description: '', points_cost: 100, category: 'coffee', image: '', is_active: true });
  }, [open, reward]);
  const save = async () => {
    setSaving(true);
    try {
      const id = form.id || `r${Date.now()}`;
      if (reward) await updateReward(reward.id, form);
      else await createReward({ ...form, id });
      onSaved(); toastSuccess('Kaydedildi');
    } catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={reward ? 'Ödül Düzenle' : 'Yeni Ödül'}>
      <div className="space-y-4">
        <div><label className="admin-label">Başlık</label><input className="admin-input" value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div><label className="admin-label">Açıklama</label><textarea className="admin-input min-h-[70px]" value={form.description ?? ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="admin-label">Puan Maliyeti</label><input type="number" className="admin-input" value={form.points_cost ?? 0} onChange={e => setForm(f => ({ ...f, points_cost: Number(e.target.value) }))} /></div>
          <div><label className="admin-label">Kategori</label>
            <select className="admin-input" value={form.category ?? 'coffee'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="coffee">Kahve</option><option value="dessert">Tatlı</option><option value="discount">İndirim</option><option value="exclusive">Özel</option><option value="birthday">Doğum Günü</option>
            </select>
          </div>
        </div>
        <div><label className="admin-label">Görsel URL</label><input className="admin-input" value={form.image ?? ''} onChange={e => setForm(f => ({ ...f, image: e.target.value }))} /></div>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.is_active ?? true} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Aktif</label>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
