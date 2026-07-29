import { useEffect, useState, useCallback } from 'react';
import { Store as StoreIcon, MapPin, Phone, Wifi, Car, Edit2, AlertTriangle } from 'lucide-react';
import { fetchStores, updateStore, fetchFranchises } from '../lib/api';
import { Card, Spinner, ErrorState, EmptyState, Badge, Button, PageHeader, Modal, SearchInput } from '../lib/ui';
import { useToast } from '../lib/toast';
import type { Store, Franchise } from '../lib/supabase';

export function StoresScreen() {
  const [items, setItems] = useState<Store[] | null>(null);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Store | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [stores, frs] = await Promise.all([fetchStores(), fetchFranchises()]);
      setItems(stores);
      setFranchises(frs);
    } catch (e) { setError(e instanceof Error ? e.message : 'Şubeler yüklenemedi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const unlinkedCount = (items ?? []).filter(s => !s.franchise_id).length;

  return (
    <div>
      <PageHeader title="Şube Yönetimi" subtitle="Tüm Espresso X şubeleri" />

      {!loading && !error && items && unlinkedCount > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4">
          <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">{unlinkedCount} şube franchise ile ilişkilendirilmemiş</p>
            <p className="text-xs mt-0.5">Bu şubelerden verilen B2B siparişleri başarısız olur. Şubeyi düzenleyip bir franchise atayın.</p>
          </div>
        </div>
      )}

      {loading ? <Spinner /> :
       error ? <ErrorState message={error} onRetry={load} /> :
       !items || items.length === 0 ? <EmptyState title="Şube yok" /> :
       <>
       <div className="mb-4"><SearchInput value={search} onChange={setSearch} placeholder="Şube ara…" /></div>
       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
         {(items ?? []).filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.address.toLowerCase().includes(search.toLowerCase())).map(s => (
           <Card key={s.id} className="p-5">
             <div className="flex items-start justify-between">
               <div className="h-11 w-11 rounded-xl bg-ex-red/10 flex items-center justify-center"><StoreIcon size={20} className="text-ex-red" /></div>
               <Badge tone={s.open ? 'green' : 'red'}>{s.open ? 'Açık' : 'Kapalı'}</Badge>
             </div>
             <h3 className="text-base font-bold text-ink-900 dark:text-ink-100 mt-3">{s.name}</h3>
             {!s.franchise_id && (
               <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-700 dark:text-amber-400 font-medium">
                 <AlertTriangle size={12} className="shrink-0" /> Franchise atanmamış
               </div>
             )}
             <div className="space-y-1.5 mt-2 text-xs text-ink-400 dark:text-ink-400">
               <p className="flex items-start gap-1.5"><MapPin size={12} className="mt-0.5 shrink-0" /> {s.address}</p>
               <p className="flex items-center gap-1.5"><StoreIcon size={12} /> {s.hours}</p>
               {s.phone && <p className="flex items-center gap-1.5"><Phone size={12} /> {s.phone}</p>}
             </div>
             <div className="flex items-center gap-2 mt-3">
               {s.wifi && <Badge tone="neutral"><Wifi size={10} /> WiFi</Badge>}
               {s.parking && <Badge tone="neutral"><Car size={10} /> Otopark</Badge>}
               {s.drive_thru && <Badge tone="neutral">Drive-thru</Badge>}
             </div>
             <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setEditing(s)}><Edit2 size={13} /> Düzenle</Button>
           </Card>
         ))}
       </div>
       </>
      }

      <StoreModal store={editing} franchises={franchises} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />
    </div>
  );
}

function StoreModal({ store, franchises, onClose, onSaved }: { store: Store | null; franchises: Franchise[]; onClose: () => void; onSaved: () => void }) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [form, setForm] = useState<Partial<Store>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (store) setForm({ ...store }); }, [store]);
  if (!store) return null;

  const save = async () => {
    setSaving(true);
    try { await updateStore(store.id, form); onSaved(); toastSuccess('Kaydedildi'); }
    catch (e) { toastError(e instanceof Error ? e.message : 'Kaydedilemedi'); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={!!store} onClose={onClose} title="Şube Düzenle" size="lg">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2"><label className="admin-label">Şube Adı</label><input className="admin-input" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
        <div className="col-span-2"><label className="admin-label">Adres</label><input className="admin-input" value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
        <div><label className="admin-label">Telefon</label><input className="admin-input" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
        <div><label className="admin-label">Çalışma Saatleri</label><input className="admin-input" value={form.hours ?? ''} onChange={e => setForm(f => ({ ...f, hours: e.target.value }))} /></div>
        <div className="col-span-2">
          <label className="admin-label">Franchise</label>
          <select className="admin-input" value={form.franchise_id ?? ''} onChange={e => setForm(f => ({ ...f, franchise_id: e.target.value || null }))}>
            <option value="">Franchise seçiniz…</option>
            {franchises.map(f => <option key={f.id} value={f.id}>{f.company_name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.open ?? false} onChange={e => setForm(f => ({ ...f, open: e.target.checked }))} /> Açık</label>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.wifi ?? false} onChange={e => setForm(f => ({ ...f, wifi: e.target.checked }))} /> WiFi</label>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.parking ?? false} onChange={e => setForm(f => ({ ...f, parking: e.target.checked }))} /> Otopark</label>
        <label className="flex items-center gap-2 text-sm text-ink-700 dark:text-ink-300"><input type="checkbox" checked={form.drive_thru ?? false} onChange={e => setForm(f => ({ ...f, drive_thru: e.target.checked }))} /> Drive-thru</label>
      </div>
      <div className="flex gap-3 mt-5">
        <Button variant="outline" full onClick={onClose}>İptal</Button>
        <Button full disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</Button>
      </div>
    </Modal>
  );
}
