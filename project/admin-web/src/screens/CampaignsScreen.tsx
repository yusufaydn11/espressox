import { useEffect, useState, useCallback } from 'react';
import { Plus, Edit2, Trash2, Megaphone, Users, Store, Crown } from 'lucide-react';
import { fetchCampaigns, createCampaign, updateCampaign, deleteCampaign } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput, ConfirmDialog } from '../lib/ui';
import { useToast } from '../lib/toast';
import { formatDate } from '../lib/utils';
import type { CampaignRow } from '../lib/supabase';

const segments: Record<string, { label: string; icon: typeof Users }> = {
  all: { label: 'Tüm Müşteriler', icon: Users },
  vip: { label: 'VIP Müşteriler', icon: Crown },
  new: { label: 'Yeni Müşteriler', icon: Users },
  store: { label: 'Şube Müşterileri', icon: Store },
};

export function CampaignsScreen() {
  const { success, error: toastError } = useToast();
  const [items, setItems] = useState<CampaignRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDel, setConfirmDel] = useState<CampaignRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(await fetchCampaigns()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Kampanyalar yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (c: CampaignRow) => {
    try { await deleteCampaign(c.id); setItems(prev => prev?.filter(x => x.id !== c.id) ?? null); success('Silindi'); setConfirmDel(null); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Silinemedi'); }
  };

  return (
    <div>
      <PageHeader title="Kampanya Yönetimi" subtitle="Pazarlama kampanyaları oluşturun ve takip edin"
        action={<Button size="sm" onClick={() => setCreating(true)}><Plus size={16} /> Yeni Kampanya</Button>} />

      {loading ? <Spinner /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       <>
       <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Kampanya ara…" /></div>
       {!items || items.length === 0 ? <EmptyState title="Kampanya yok" subtitle="İlk kampanyanızı oluşturun" /> :
       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
         {(items ?? []).filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => {
           const seg = segments[c.target_segment] ?? segments.all;
           const SegIcon = seg.icon;
           return (
             <Card key={c.id} className="p-5">
               <div className="flex items-start justify-between">
                 <div className="h-10 w-10 rounded-xl bg-ex-red/10 flex items-center justify-center"><Megaphone size={18} className="text-ex-red" /></div>
                 <Badge tone={c.status === 'active' ? 'green' : c.status === 'scheduled' ? 'amber' : 'neutral'}>
                   {c.status === 'active' ? 'Aktif' : c.status === 'scheduled' ? 'Planlandı' : 'Bitti'}
                 </Badge>
               </div>
               <h3 className="text-base font-bold text-ink-900 dark:text-ink-100 mt-3">{c.name}</h3>
               <p className="text-xs text-ink-400 dark:text-ink-400 mt-1 line-clamp-2">{c.message || c.title}</p>
               <div className="flex items-center gap-2 mt-3">
                 <Badge tone="dark"><SegIcon size={11} /> {seg.label}</Badge>
               </div>
               <div className="flex items-center justify-between mt-3 pt-3 border-t border-ink-100 dark:border-ink-800 text-xs text-ink-400 dark:text-ink-400">
                 <span>{c.start_date ? formatDate(c.start_date) : '—'} → {c.end_date ? formatDate(c.end_date) : '—'}</span>
                 <span>Erişim: {c.reach ?? 0}</span>
               </div>
               <div className="flex gap-1.5 mt-3">
                 <Button variant="outline" size="sm" className="flex-1" onClick={() => setEditing(c)}><Edit2 size={13} /> Düzenle</Button>
                 <Button variant="danger" size="sm" onClick={() => setConfirmDel(c)}><Trash2 size={13} /></Button>
               </div>
             </Card>
           );
         })}
       </div>
       }
       </>
      }

      <CampaignModal open={editing !== null || creating} campaign={editing}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={async () => { setEditing(null); setCreating(false); await load(); }} />
      <ConfirmDialog open={confirmDel !== null} onClose={() => setConfirmDel(null)} onConfirm={() => confirmDel && remove(confirmDel)} title="Kampanyayı Sil" message={`"${confirmDel?.name ?? ''}" silinsin mi?`} />
    </div>
  );
}

function CampaignModal({ open, campaign, onClose, onSaved }: { open: boolean; campaign: CampaignRow | null; onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<CampaignRow>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) setForm(campaign ? { ...campaign } : { name: '', type: 'push', status: 'draft', target_segment: 'all', title: '', message: '', reach: 0, conversion: 0, revenue: 0 });
  }, [open, campaign]);

  const save = async () => {
    setSaving(true);
    try {
      if (campaign) await updateCampaign(campaign.id, form);
      else await createCampaign(form);
      onSaved(); toastSuccess('Kaydedildi');
    } catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={campaign ? 'Kampanya Düzenle' : 'Yeni Kampanya'} size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="admin-label">Kampanya Adı</label><input className="admin-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="col-span-2"><label className="admin-label">Başlık</label><input className="admin-input" value={form.title ?? ''} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
        <div className="col-span-2"><label className="admin-label">Mesaj</label><textarea className="admin-input min-h-[70px]" value={form.message ?? ''} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} /></div>
        <div><label className="admin-label">Hedef Kitle</label>
          <select className="admin-input" value={form.target_segment ?? 'all'} onChange={e => setForm(f => ({ ...f, target_segment: e.target.value }))}>
            {Object.entries(segments).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div><label className="admin-label">Durum</label>
          <select className="admin-input" value={form.status ?? 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
            <option value="draft">Taslak</option><option value="scheduled">Planlandı</option><option value="active">Aktif</option><option value="ended">Bitti</option>
          </select>
        </div>
        <div><label className="admin-label">Başlangıç</label><input type="date" className="admin-input" value={form.start_date ?? ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></div>
        <div><label className="admin-label">Bitiş</label><input type="date" className="admin-input" value={form.end_date ?? ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></div>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
